// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruta.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../lib/db";

// Importerer funksjoner for å hente nåværende bruker og kreve innlogging.
import { getCurrentUser, requireAuth } from "../../../../lib/auth";

// Denne API-ruta håndterer:
// - GET: hente detaljer om én spesifikk tur
// - DELETE: slette en tur hvis brukeren har tilgang


// Denne hjelpefunksjonen sørger for at kolonnen turleder_user_id finnes i tiu_trips.
// Den brukes fordi eldre data kanskje bare hadde turleder_navn, ikke bruker-ID.
async function ensureTurlederUserIdColumn(client) {
  // Legger til kolonnen hvis den ikke finnes fra før.
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  // Lager indeks for raskere oppslag på turleder_user_id.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id)
  `);

  // Fyller inn turleder_user_id for gamle rader der den er tom,
  // ved å matche users.username mot tiu_trips.turleder_navn.
  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}


// GET-ruta henter all detaljinformasjon om en tur.
export async function GET(request, { params }) {
  // Henter en databaseklient fra connection pool.
  const client = await pool.connect();

  try {
    // Sørger for at nødvendig databasekolonne finnes.
    await ensureTurlederUserIdColumn(client);

    // Leser tur-ID fra URL-parametere.
    const { id } = await params;
    const tripId = Number(id);

    // Hvis ID-en ikke er gyldig tall, returneres 400-feil.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Hovedquery som henter turen, TiU-info og neste aktive avgang.
    const query = `
      SELECT
        t.id,
        t.navn,
        t.beskrivelse,
        t.lengde_km,
        t.type,
        t.vanskelighetsgrad,
        t.bilde_url,
        t.geometry,
        tt.id AS tiu_trip_id,
        tt.turleder_navn,
        tt.turleder_user_id,
        tt.is_flexible,
        tt.planning_status,
        d.id AS departure_id,
        d.status AS departure_status,
        d.start_time AS departure_start_time,
        d.end_time AS departure_end_time,
        d.min_participants,
        d.max_participants
      FROM public.trips t
      LEFT JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      LEFT JOIN LATERAL (
        SELECT
          td.id,
          td.status,
          td.start_time,
          td.end_time,
          td.min_participants,
          td.max_participants
        FROM public.trip_departures td
        WHERE td.trip_id = t.id
          AND td.status <> 'cancelled'
        ORDER BY td.start_time ASC
        LIMIT 1
      ) d ON true
      WHERE t.id = $1
      LIMIT 1
    `;

    // Kjører query med tur-ID som parameter.
    const result = await client.query(query, [tripId]);

    // Hvis ingen tur ble funnet, returneres 404.
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Fant ikke turen" },
        { status: 404 }
      );
    }

    // Henter første rad som turobjekt.
    const trip = result.rows[0];

    // Hvis bilde_urls ikke finnes i resultatet,
    // prøver vi å hente det separat fra trips-tabellen.
    if (trip.bilde_urls === undefined) {
      const tripResult = await client.query(
        `SELECT bilde_urls FROM public.trips WHERE id = $1 LIMIT 1`,
        [tripId]
      );

      if (tripResult.rowCount > 0 && tripResult.rows[0].bilde_urls) {
        // Bruk bilde_urls fra trips hvis de finnes.
        trip.bilde_urls = tripResult.rows[0].bilde_urls;
      } else if (!trip.bilde_url) {
        // Hvis turen heller ikke har gammel bilde_url,
        // prøv fallback til routes_to_verification.
        const customResult = await client.query(
          `SELECT bilde_urls FROM public.routes_to_verification WHERE name = $1 LIMIT 1`,
          [trip.navn]
        );

        if (customResult.rowCount > 0 && customResult.rows[0].bilde_urls) {
          trip.bilde_urls = customResult.rows[0].bilde_urls;
        } else {
          // Hvis ingenting finnes, bruk tom liste.
          trip.bilde_urls = [];
        }
      } else {
        // Hvis bilde_url finnes men ikke bilde_urls, bruk tom liste.
        trip.bilde_urls = [];
      }
    }

    // Henter alle datoalternativene for turen.
    const optionsResult = await client.query(
      `
      SELECT
        id,
        start_time,
        end_time,
        is_selected
      FROM public.trip_date_options
      WHERE trip_id = $1
      ORDER BY start_time ASC
      `,
      [tripId]
    );

    // Teller hvor mange som har ikke-bindende interesse.
    const interestCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS interested_count
      FROM public.trip_interest
      WHERE trip_id = $1
        AND status = 'interested'
      `,
      [tripId]
    );

    // Sjekker om tabellen trip_cabins finnes.
    const tripCabinsTableResult = await client.query(
      "SELECT to_regclass('public.trip_cabins') IS NOT NULL AS exists"
    );

    // Standardverdi for tilknyttede hytter.
    let cabins = [];

    // Hvis tabellen finnes, henter vi alle hytter som er koblet til turen.
    if (tripCabinsTableResult.rows[0]?.exists === true) {
      const cabinsResult = await client.query(
        `
        SELECT
          c.id::text AS id,
          c.name,
          c.location,
          c.latitude,
          c.longitude,
          tc.sort_order
        FROM public.trip_cabins tc
        JOIN public.cabins c
          ON c.id::text = tc.cabin_id::text
        WHERE tc.trip_id = $1
        ORDER BY tc.sort_order ASC
        `,
        [tripId]
      );

      cabins = cabinsResult.rows;
    }

    // Legger på ekstra info på trip-objektet.
    trip.date_options = optionsResult.rows;
    trip.interested_count = interestCountResult.rows[0]?.interested_count ?? 0;
    trip.cabins = cabins;

    // Henter innlogget bruker hvis det finnes en aktiv session.
    const user = await getCurrentUser();

    // Setter standardverdier for brukerrelaterte felter.
    trip.is_interested = false;
    trip.is_binding_registered = false;
    trip.can_open_group = false;
    trip.can_withdraw_interest = false;
    trip.can_withdraw_binding = false;
    trip.is_trip_admin = false;
    trip.binding_registrations = [];
    trip.binding_count = 0;
    trip.can_confirm_departure = false;

    // Hvis en bruker er logget inn, henter vi bruker-spesifikk informasjon.
    if (user?.id) {
      // Sjekker om brukeren har meldt ikke-bindende interesse.
      const interestResult = await client.query(
        `
        SELECT 1
        FROM public.trip_interest
        WHERE trip_id = $1
          AND user_id = $2
          AND status = 'interested'
        LIMIT 1
        `,
        [tripId, user.id]
      );

      // Sjekker om brukeren allerede er bindende påmeldt.
      const registrationResult = await client.query(
        `
        SELECT 1
        FROM public.trip_registrations tr
        JOIN public.trip_departures td
          ON td.id = tr.departure_id
        WHERE td.trip_id = $1
          AND tr.user_id = $2
          AND tr.status = 'binding'
        LIMIT 1
        `,
        [tripId, user.id]
      );

      // Sjekker brukerrolle.
      const role = String(user.role || "").toUpperCase();
      const isAdmin = role === "ADMIN";

      // Sjekker om brukeren er turleder for akkurat denne turen.
      const isLeaderForThisTrip =
        trip.turleder_user_id &&
        String(trip.turleder_user_id) === String(user.id);

      // Brukeren er trip-admin hvis hen er admin eller turleder for turen.
      trip.is_trip_admin = isAdmin || isLeaderForThisTrip;

      // Oppdaterer brukerrelaterte felter basert på query-resultatene.
      trip.is_interested = interestResult.rowCount > 0;
      trip.is_binding_registered = registrationResult.rowCount > 0;
      trip.can_open_group = trip.is_interested || trip.is_binding_registered;
      trip.can_withdraw_interest = trip.is_interested;
      trip.can_withdraw_binding = trip.is_binding_registered;

      // Hvis turen har en aktiv avgang, teller vi bindende påmeldte.
      if (trip.departure_id) {
        const bindingCountResult = await client.query(
          `
          SELECT COUNT(*)::int AS binding_count
          FROM public.trip_registrations
          WHERE departure_id = $1
            AND status = 'binding'
          `,
          [trip.departure_id]
        );

        trip.binding_count = bindingCountResult.rows[0]?.binding_count ?? 0;
      }

      // Hvis brukeren er trip-admin og turen har avgang,
      // henter vi liste over alle bindende påmeldte.
      if (trip.is_trip_admin && trip.departure_id) {
        const registrationsResult = await client.query(
          `
          SELECT
            u.id,
            u.username,
            u.email,
            u.avatar,
            tr.created_at AS registered_at
          FROM public.trip_registrations tr
          JOIN public.users u
            ON u.id = tr.user_id
          WHERE tr.departure_id = $1
            AND tr.status = 'binding'
          ORDER BY tr.created_at ASC
          `,
          [trip.departure_id]
        );

        trip.binding_registrations = registrationsResult.rows;
      }

      // Avgjør om turleder/admin får lov til å bekrefte turen.
      // Det krever:
      // - at brukeren er trip-admin
      // - at turen har en avgang
      // - at avgangen fortsatt er open
      // - at antall bindende påmeldte er minst minimumskravet
      trip.can_confirm_departure =
        trip.is_trip_admin === true &&
        Boolean(trip.departure_id) &&
        trip.departure_status === "open" &&
        Number(trip.binding_count || 0) >= Number(trip.min_participants || 0);
    }

    // Returnerer hele turobjektet som JSON.
    return NextResponse.json(trip);
  } catch (error) {
    // Logger backend-feilen for debugging i terminalen.
    console.error("Trip details API GET error:", error);

    // Returnerer generell 500-feil til klienten.
    return NextResponse.json(
      { error: "Kunne ikke hente tur", details: error?.message || "Ukjent feil" },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}


// DELETE-ruta sletter en tur hvis brukeren har tilgang.
export async function DELETE(request, { params }) {
  // Henter databaseklient.
  const client = await pool.connect();

  try {
    // Krever at brukeren er logget inn.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Sørger for at turleder_user_id finnes i databasen.
    await ensureTurlederUserIdColumn(client);

    // Leser tur-ID fra URL-parametrene.
    const { id } = await params;
    const tripId = Number(id);

    // Hvis tur-ID ikke er gyldig, returner 400-feil.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Starter transaksjon slik at slettingen blir trygg.
    await client.query("BEGIN");

    // Henter turen og låser raden med FOR UPDATE.
    const tripResult = await client.query(
      `
      SELECT
        id,
        navn
      FROM public.trips
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tripId]
    );

    // Hvis turen ikke finnes, avbryt transaksjonen og returner 404.
    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke turen" },
        { status: 404 }
      );
    }

    // Henter turleder_user_id separat.
    // Dette gjøres separat for å unngå problemer med LEFT JOIN + FOR UPDATE i CockroachDB.
    const leaderResult = await client.query(
      `
      SELECT turleder_user_id
      FROM public.tiu_trips
      WHERE trip_id = $1
      LIMIT 1
      `,
      [tripId]
    );

    const turlederUserId = leaderResult.rows[0]?.turleder_user_id ?? null;

    // Sjekker om brukeren er admin.
    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    // Sjekker om brukeren er turleder for denne turen.
    const isLeaderForThisTrip =
      turlederUserId && String(turlederUserId) === String(user.id);

    // Hvis brukeren ikke er admin eller riktig turleder, nekt tilgang.
    if (!isAdmin && !isLeaderForThisTrip) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Ingen tilgang" },
        { status: 403 }
      );
    }

    // Sletter turen.
    // Eventuelle relasjoner med ON DELETE CASCADE vil bli slettet automatisk.
    await client.query(
      `
      DELETE FROM public.trips
      WHERE id = $1
      `,
      [tripId]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons.
    return NextResponse.json(
      {
        success: true,
        message: "Turen ble slettet",
      },
      { status: 200 }
    );
  } catch (error) {
    // Hvis noe feiler, prøver vi å rulle tilbake transaksjonen.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    // Logger selve feilen.
    console.error("Trip delete API error:", error);

    // Returnerer 500-feil til klienten.
    return NextResponse.json(
      {
        error: "Kunne ikke slette tur",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir databaseklienten tilbake til poolen.
    client.release();
  }
}