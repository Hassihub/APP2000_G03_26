// Importerer NextResponse for å returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever innlogging.
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten håndterer bindende påmelding til turavganger.
// POST = melde seg på bindende
// DELETE = melde seg av bindende


// Denne hjelpefunksjonen sørger for at kolonnen turleder_user_id finnes.
// Den brukes fordi eldre data kanskje bare hadde turleder_navn lagret.
async function ensureTurlederUserIdColumn(client) {
  // Legger til kolonnen hvis den ikke allerede finnes.
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
// Den brukes når vi vil sende varsler til turleder via bjella i appen.
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

  // Lager indeks for raskere uthenting av varsler per bruker.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON public.user_notifications (user_id, created_at DESC)
  `);

  // Lager unik indeks slik at samme varsel ikke opprettes flere ganger.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notifications_reference
    ON public.user_notifications (user_id, type, reference_id)
    WHERE reference_id IS NOT NULL
  `);
}


// Denne funksjonen prøver å sende et varsel til turleder etter en påmelding.
// "Best effort" betyr at hvis varslet feiler, skal ikke selve påmeldingen feile.
async function sendLeaderNotificationBestEffort({
  tripId,
  departureId,
  recipientUserId,
  actorUserId,
  actorUsername,
}) {
  // Ikke send varsel hvis mottaker mangler eller hvis brukeren varsler seg selv.
  if (!recipientUserId || String(recipientUserId) === String(actorUserId)) {
    return;
  }

  // Henter en egen databaseklient for varseloperasjonen.
  const client = await pool.connect();

  try {
    // Sørger for at notifications-tabellen finnes.
    await ensureUserNotificationsTable(client);

    // Oppretter et varsel i user_notifications.
    // ON CONFLICT DO NOTHING hindrer dubletter.
    await client.query(
      `
      INSERT INTO public.user_notifications
        (user_id, type, reference_id, title, message, action_url, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT DO NOTHING
      `,
      [
        String(recipientUserId),
        "trip_binding_signup",
        `trip:${tripId}:departure:${departureId}:signup:${actorUserId}`,
        "Ny bindende påmelding",
        `${actorUsername} meldte seg bindende på turen.`,
        `/explore/${tripId}`,
        JSON.stringify({
          trip_id: tripId,
          departure_id: departureId,
          actor_user_id: actorUserId,
          actor_username: actorUsername,
        }),
      ]
    );
  } catch (error) {
    // Logger feilen, men lar den ikke stoppe resten av systemet.
    console.error("Notification insert error:", error);
  } finally {
    // Frigir klienten tilbake til poolen.
    client.release();
  }
}


// POST-ruta brukes når en bruker vil melde seg bindende på en avgang.
export async function POST(request, context) {
  // Henter en databaseklient.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Sørger for at turleder_user_id finnes før vi bruker den.
    await ensureTurlederUserIdColumn(client);

    // Leser departureId fra URL-parametrene.
    const { departureId: departureIdParam } = await context.params;

    // Henter innlogget brukers ID.
    const userId = user.id;

    // Gjør om departureId til tall.
    const departureId = Number(departureIdParam);

    // Returnerer feil hvis departureId ikke er et gyldig tall.
    if (!Number.isFinite(departureId)) {
      return NextResponse.json(
        { error: "Ugyldig avgang" },
        { status: 400 }
      );
    }

    // Starter en transaksjon.
    await client.query("BEGIN");

    // Henter avgangen og låser raden med FOR UPDATE.
    const departureResult = await client.query(
      `
      SELECT
        id,
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      FROM public.trip_departures
      WHERE id = $1
      FOR UPDATE
      `,
      [departureId]
    );

    // Hvis avgangen ikke finnes, rull tilbake og returner 404.
    if (departureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgang ikke funnet" },
        { status: 404 }
      );
    }

    // Henter avgangsdata.
    const departure = departureResult.rows[0];

    // Henter turleder for turen for å kunne sende varsel etterpå.
    const leaderResult = await client.query(
      `
      SELECT turleder_user_id
      FROM public.tiu_trips
      WHERE trip_id = $1
      LIMIT 1
      `,
      [departure.trip_id]
    );

    const turlederUserId = leaderResult.rows[0]?.turleder_user_id ?? null;

    // Hvis avgangen er avlyst, kan man ikke melde seg på.
    if (departure.status === "cancelled") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgangen er avlyst" },
        { status: 400 }
      );
    }

    // Hvis turen allerede er bekreftet, lar denne koden ikke flere melde seg på.
    if (departure.status === "confirmed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er allerede bekreftet" },
        { status: 400 }
      );
    }

    // Sjekker om brukeren allerede har en annen overlappende bindende påmelding.
    const overlapResult = await client.query(
      `
      SELECT
        r.id,
        r.departure_id,
        d.trip_id,
        d.start_time,
        d.end_time
      FROM public.trip_registrations r
      JOIN public.trip_departures d
        ON d.id = r.departure_id
      WHERE r.user_id = $1
        AND r.status = 'binding'
        AND d.status IN ('open', 'confirmed')
        AND d.start_time < $3
        AND d.end_time > $2
        AND d.id <> $4
      LIMIT 1
      `,
      [userId, departure.start_time, departure.end_time, departureId]
    );

    // Hvis brukeren allerede har en overlappende tur, returneres feil.
    if (overlapResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du har allerede en overlappende bindende påmelding" },
        { status: 400 }
      );
    }

    // Sjekker om brukeren allerede har en registrering på denne avgangen.
    const existingRegistrationResult = await client.query(
      `
      SELECT id, status
      FROM public.trip_registrations
      WHERE departure_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [departureId, userId]
    );

    // Hvis brukeren allerede er bindende registrert, returneres feil.
    if (
      existingRegistrationResult.rowCount > 0 &&
      existingRegistrationResult.rows[0].status === "binding"
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du er allerede bindende påmeldt denne avgangen" },
        { status: 400 }
      );
    }

    // Hvis det finnes maks antall deltakere, sjekk kapasiteten.
    if (departure.max_participants !== null) {
      const capacityResult = await client.query(
        `
        SELECT COUNT(*)::int AS binding_count
        FROM public.trip_registrations
        WHERE departure_id = $1
          AND status = 'binding'
        `,
        [departureId]
      );

      const currentBindingCount = capacityResult.rows[0].binding_count;

      // Hvis turen er full, returneres feil.
      if (currentBindingCount >= departure.max_participants) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Avgangen er fullbooket" },
          { status: 400 }
        );
      }
    }

    // Hvis brukeren allerede finnes i tabellen med annen status,
    // oppdater status til binding.
    if (existingRegistrationResult.rowCount > 0) {
      await client.query(
        `
        UPDATE public.trip_registrations
        SET status = 'binding'
        WHERE departure_id = $1
          AND user_id = $2
        `,
        [departureId, userId]
      );
    } else {
      // Ellers opprettes en helt ny bindende registrering.
      await client.query(
        `
        INSERT INTO public.trip_registrations (departure_id, user_id, status)
        VALUES ($1, $2, 'binding')
        `,
        [departureId, userId]
      );
    }

    // Teller hvor mange bindende påmeldte avgangen nå har.
    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS binding_count
      FROM public.trip_registrations
      WHERE departure_id = $1
        AND status = 'binding'
      `,
      [departureId]
    );

    const bindingCount = countResult.rows[0].binding_count;

    // Sjekker om turen nå har nok påmeldte til å kunne bekreftes av turleder.
    const readyToConfirm = bindingCount >= departure.min_participants;

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Sender varsel til turleder etter at påmeldingen er lagret.
    await sendLeaderNotificationBestEffort({
      tripId: departure.trip_id,
      departureId,
      recipientUserId: turlederUserId,
      actorUserId: userId,
      actorUsername: user.username,
    });

    // Returnerer suksessrespons med info om påmeldingen.
    return NextResponse.json(
      {
        success: true,
        message: readyToConfirm
          ? "Bindende påmelding registrert. Turen er klar til å bekreftes av turleder."
          : "Bindende påmelding registrert",
        departure: {
          id: departure.id,
          trip_id: departure.trip_id,
          start_time: departure.start_time,
          end_time: departure.end_time,
          min_participants: departure.min_participants,
          max_participants: departure.max_participants,
          status: departure.status,
        },
        binding_count: bindingCount,
        ready_to_confirm: readyToConfirm,
      },
      { status: 200 }
    );
  } catch (error) {
    // Hvis noe går galt, prøv å rulle tilbake transaksjonen.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    // Logger backend-feilen.
    console.error("Register API error:", error);

    // Returnerer 500-feil til klienten.
    return NextResponse.json(
      {
        error: "Kunne ikke registrere bindende påmelding",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir klienten tilbake til poolen.
    client.release();
  }
}


// DELETE-ruta brukes når en bruker vil melde seg av en bindende påmelding.
export async function DELETE(request, context) {
  // Henter databaseklient.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Leser departureId fra URL.
    const { departureId: departureIdParam } = await context.params;
    const departureId = Number(departureIdParam);

    // Returnerer feil hvis departureId ikke er gyldig.
    if (!Number.isFinite(departureId)) {
      return NextResponse.json(
        { error: "Ugyldig avgang" },
        { status: 400 }
      );
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Henter registreringen som tilhører denne brukeren og avgangen.
    const registrationResult = await client.query(
      `
      SELECT
        tr.id,
        tr.status,
        td.id AS departure_id,
        td.trip_id
      FROM public.trip_registrations tr
      JOIN public.trip_departures td
        ON td.id = tr.departure_id
      WHERE tr.departure_id = $1
        AND tr.user_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [departureId, user.id]
    );

    // Hvis ingen bindende påmelding finnes, returneres 404.
    if (registrationResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ingen bindende påmelding å melde av" },
        { status: 404 }
      );
    }

    // Oppdaterer registreringen til status cancelled i stedet for å slette raden.
    await client.query(
      `
      UPDATE public.trip_registrations
      SET status = 'cancelled'
      WHERE departure_id = $1
        AND user_id = $2
      `,
      [departureId, user.id]
    );

    // Henter avgangsdata for å sjekke om status må justeres.
    const departureResult = await client.query(
      `
      SELECT
        id,
        min_participants,
        status
      FROM public.trip_departures
      WHERE id = $1
      LIMIT 1
      `,
      [departureId]
    );

    if (departureResult.rowCount > 0) {
      const departure = departureResult.rows[0];

      // Teller hvor mange bindende påmeldte som fortsatt finnes etter avmelding.
      const countResult = await client.query(
        `
        SELECT COUNT(*)::int AS binding_count
        FROM public.trip_registrations
        WHERE departure_id = $1
          AND status = 'binding'
        `,
        [departureId]
      );

      const bindingCount = countResult.rows[0].binding_count;

      // Hvis turen var confirmed, men nå har for få deltakere,
      // settes status tilbake til open.
      if (
        departure.status === "confirmed" &&
        bindingCount < departure.min_participants
      ) {
        await client.query(
          `
          UPDATE public.trip_departures
          SET status = 'open'
          WHERE id = $1
          `,
          [departureId]
        );
      }
    }

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons.
    return NextResponse.json(
      {
        success: true,
        message: "Du er meldt av turen",
      },
      { status: 200 }
    );
  } catch (error) {
    // Hvis noe feiler, prøv rollback.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    // Logger feilen.
    console.error("Unregister API error:", error);

    // Returnerer 500-feil.
    return NextResponse.json(
      { error: "Kunne ikke melde deg av turen" },
      { status: 500 }
    );
  } finally {
    // Frigir klienten.
    client.release();
  }
}