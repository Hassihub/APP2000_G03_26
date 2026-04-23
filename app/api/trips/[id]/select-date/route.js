// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten brukes når turleder/admin velger endelig dato for en fleksibel tur.
// Når dato velges:
// - ett datoalternativ markeres som valgt
// - en avgang opprettes i trip_departures
// - planning_status endres til binding_open
// - brukere som hadde meldt ikke-bindende interesse får varsel


// Denne hjelpefunksjonen sørger for at kolonnen turleder_user_id finnes i tiu_trips.
// Den brukes fordi eldre data kan ha turleder_navn uten kobling til users.id.
async function ensureTurlederUserIdColumn(client) {
  // Legger til kolonnen hvis den mangler.
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  // Lager indeks for raskere oppslag på turleder_user_id.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id)
  `);

  // Fyller inn turleder_user_id for gamle rader ved å matche username.
  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}


// Denne hjelpefunksjonen sørger for at user_notifications-tabellen finnes.
// Den brukes når brukere skal varsles i bjella om at dato er valgt.
async function ensureUserNotificationsTable(client) {
  // Oppretter tabellen hvis den ikke finnes.
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.user_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      action_url TEXT,
      metadata JSONB,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `);

  // Lager indeks for rask uthenting av varsler per bruker.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON public.user_notifications (user_id, created_at DESC)
  `);

  // Lager unik indeks slik at samme varsel ikke settes inn flere ganger.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notifications_reference
    ON public.user_notifications (user_id, type, reference_id)
    WHERE reference_id IS NOT NULL
  `);
}


// POST-ruta brukes for å velge endelig dato på en fleksibel tur.
export async function POST(request, context) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Sørger for at nødvendige databasefelter/tabeller finnes.
    await ensureTurlederUserIdColumn(client);
    await ensureUserNotificationsTable(client);

    // Leser tur-ID fra route-parametrene.
    const { id } = await context.params;
    const tripId = Number(id);

    // Returnerer feil hvis tur-ID ikke er gyldig.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Leser request body som JSON.
    const body = await request.json();

    // Leser valgt datoalternativ-ID.
    const dateOptionId = Number(body?.dateOptionId);

    // Leser minimum antall deltakere, med fallback til 1.
    const minParticipants = Number(body?.min_participants ?? 1);

    // Leser maksimum antall deltakere.
    // Hvis feltet er tomt/null/undefined brukes null.
    const maxParticipants =
      body?.max_participants === null ||
      body?.max_participants === undefined ||
      body?.max_participants === ""
        ? null
        : Number(body.max_participants);

    // Validerer at datoalternativ-ID er gyldig.
    if (!Number.isFinite(dateOptionId)) {
      return NextResponse.json(
        { error: "Ugyldig datoalternativ" },
        { status: 400 }
      );
    }

    // Validerer minParticipants.
    if (!Number.isFinite(minParticipants) || minParticipants < 1) {
      return NextResponse.json(
        { error: "Minste antall deltakere må være minst 1" },
        { status: 400 }
      );
    }

    // Hvis maxParticipants er satt, valider at den er gyldig og >= minimum.
    if (maxParticipants !== null) {
      if (!Number.isFinite(maxParticipants) || maxParticipants < minParticipants) {
        return NextResponse.json(
          { error: "Maks antall deltakere må være større enn eller lik minimum" },
          { status: 400 }
        );
      }
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Henter turen og tilhørende TiU-info, og låser raden med FOR UPDATE.
    const tripResult = await client.query(
      `
      SELECT
        t.id,
        t.navn,
        tt.id AS tiu_trip_id,
        tt.is_flexible,
        tt.planning_status,
        tt.turleder_user_id
      FROM public.trips t
      JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      WHERE t.id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tripId]
    );

    // Hvis turen ikke finnes, returner 404.
    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke fleksibel fellestur" },
        { status: 404 }
      );
    }

    // Henter turdataene.
    const trip = tripResult.rows[0];

    // Sjekker om brukeren er admin.
    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    // Sjekker om brukeren er turleder for denne turen.
    const isLeaderForThisTrip =
      trip.turleder_user_id &&
      String(trip.turleder_user_id) === String(user.id);

    // Kun admin eller turleder for turen skal få velge dato.
    if (!isAdmin && !isLeaderForThisTrip) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Ingen tilgang" },
        { status: 403 }
      );
    }

    // Turen må være fleksibel for at dato skal kunne velges på denne måten.
    if (!trip.is_flexible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen er ikke fleksibel" },
        { status: 400 }
      );
    }

    // Sjekker om turen allerede har en aktiv avgang.
    const existingDepartureResult = await client.query(
      `
      SELECT id
      FROM public.trip_departures
      WHERE trip_id = $1
        AND status <> 'cancelled'
      LIMIT 1
      `,
      [tripId]
    );

    // Hvis en aktiv avgang allerede finnes, kan ikke ny dato velges.
    if (existingDepartureResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen har allerede en aktiv avgang" },
        { status: 400 }
      );
    }

    // Henter alle datoalternativer for turen.
    const optionResult = await client.query(
      `
      SELECT
        id,
        trip_id,
        start_time,
        end_time,
        is_selected
      FROM public.trip_date_options
      WHERE trip_id = $1
      ORDER BY start_time ASC
      `,
      [tripId]
    );

    // Hvis turen ikke har datoalternativer, returneres 404.
    if (optionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen har ingen datoalternativer" },
        { status: 404 }
      );
    }

    // Finner det valgte datoalternativet blant alternativene til turen.
    const selectedOption = optionResult.rows.find(
      (option) => Number(option.id) === dateOptionId
    );

    // Hvis valgt datoalternativ ikke tilhører turen, returneres 404.
    if (!selectedOption) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Datoalternativet ble ikke funnet for denne turen",
          received_date_option_id: dateOptionId,
          trip_id: tripId,
          available_option_ids: optionResult.rows.map((row) => row.id),
        },
        { status: 404 }
      );
    }

    // Nullstiller først alle tidligere valgte datoalternativer for turen.
    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = false
      WHERE trip_id = $1
      `,
      [tripId]
    );

    // Marker valgt datoalternativ som is_selected = true.
    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = true
      WHERE id = $1
        AND trip_id = $2
      `,
      [dateOptionId, tripId]
    );

    // Oppretter en ny avgang i trip_departures basert på det valgte alternativet.
    const departureResult = await client.query(
      `
      INSERT INTO public.trip_departures (
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'open')
      RETURNING
        id,
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      `,
      [
        tripId,
        selectedOption.start_time,
        selectedOption.end_time,
        minParticipants,
        maxParticipants,
      ]
    );

    // Henter den opprettede avgangen.
    const departure = departureResult.rows[0];

    // Oppdaterer TiU-planstatus til binding_open,
    // siden turen nå er klar for bindende påmelding.
    await client.query(
      `
      UPDATE public.tiu_trips
      SET planning_status = 'binding_open'
      WHERE trip_id = $1
      `,
      [tripId]
    );

    // Henter alle brukere som har meldt ikke-bindende interesse.
    const interestedUsersResult = await client.query(
      `
      SELECT
        tc.cabin_id::text AS cabin_id,
        c.owner_id::text AS owner_id,
        c.name AS cabin_name
      FROM public.trip_cabins tc
      JOIN public.cabins c ON c.id::text = tc.cabin_id::text
      WHERE tc.trip_id = $1
        AND c.owner_id IS NOT NULL
      `,
      [tripId]
    );

    // Oppretter ett varsel per interessert bruker.
    for (const row of interestedUsersResult.rows) {
      await client.query(
        `
        INSERT INTO public.user_notifications
          (user_id, type, reference_id, title, message, action_url, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT DO NOTHING
        `,
        [
          String(row.owner_id),
          "cabin_stay_binding_requested",
          referenceId,
          "Bekreft bindende sengeplasser",
          `Dato for turen "${trip.navn}" er valgt. Bekreft eller trekk bindende sengeplasser for ${String(row.cabin_name || "hytta")}.`,
          `/reserver/foresporsler?view=incoming${stayReq ? `&requestId=${encodeURIComponent(String(stayReq.stay_request_id))}` : ""}`,
          JSON.stringify({
            stay_request_id: stayReq?.stay_request_id ?? null,
            trip_id: tripId,
            departure_id: departure.id,
            trip_name: trip.navn,
            cabin_name: row.cabin_name,
            offered_beds: stayReq?.offered_beds ?? null,
          }),
        ]
      );
    }

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons med info om avgangen.
    return NextResponse.json(
      {
        success: true,
        message: "Dato valgt og avgang opprettet",
        departure,
      },
      { status: 200 }
    );
  } catch (error) {
    // Hvis noe går galt, prøv rollback.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    // Logger feilen i terminalen.
    console.error("Select date API error:", error);

    // Returnerer 500-feil til frontend.
    return NextResponse.json(
      {
        error: "Kunne ikke velge datoalternativ",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir databaseklienten tilbake til poolen.
    client.release();
  }
}
