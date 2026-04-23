// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten brukes for å bekrefte en turavgang.
// Kun turleder for turen eller admin skal kunne gjøre dette.
// Når en avgang bekreftes, settes status til "confirmed".


// Denne hjelpefunksjonen sørger for at kolonnen turleder_user_id finnes i tiu_trips.
// Den brukes fordi eldre turer kanskje bare hadde turleder_navn og ikke kobling til users.id.
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

  // Oppdaterer gamle rader slik at turleder_user_id fylles inn
  // ved å matche users.username mot tiu_trips.turleder_navn.
  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}


// POST-ruta bekrefter en spesifikk avgang.
export async function POST(request, context) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Sørger for at nødvendig databasekolonne finnes før vi bruker den.
    await ensureTurlederUserIdColumn(client);

    // Leser departureId fra route-parametrene i URL-en.
    const { departureId: departureIdParam } = await context.params;
    const departureId = Number(departureIdParam);

    // Hvis departureId ikke er et gyldig tall, returneres 400-feil.
    if (!Number.isFinite(departureId)) {
      return NextResponse.json(
        { error: "Ugyldig avgang" },
        { status: 400 }
      );
    }

    // Starter transaksjon for å sikre at alle databaseoperasjoner skjer samlet.
    await client.query("BEGIN");

    // Henter informasjon om avgangen og tilhørende turleder.
    const departureResult = await client.query(
      `
      SELECT
        d.id,
        d.trip_id,
        d.status,
        d.min_participants,
        d.max_participants,
        tt.turleder_user_id
      FROM public.trip_departures d
      LEFT JOIN public.tiu_trips tt
        ON tt.trip_id = d.trip_id
      WHERE d.id = $1
      LIMIT 1
      `,
      [departureId]
    );

    // Hvis avgangen ikke finnes, rulles transaksjonen tilbake og 404 returneres.
    if (departureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke avgangen" },
        { status: 404 }
      );
    }

    // Henter avgangsdata fra query-resultatet.
    const departure = departureResult.rows[0];

    // Sjekker om brukeren er admin.
    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    // Sjekker om brukeren er turleder for akkurat denne turen.
    const isLeaderForThisTrip =
      departure.turleder_user_id &&
      String(departure.turleder_user_id) === String(user.id);

    // Hvis brukeren verken er admin eller riktig turleder, nektes tilgang.
    if (!isAdmin && !isLeaderForThisTrip) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Ingen tilgang" },
        { status: 403 }
      );
    }

    // Hvis avgangen er avlyst, kan den ikke bekreftes.
    if (departure.status === "cancelled") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgangen er avlyst" },
        { status: 400 }
      );
    }

    // Hvis avgangen allerede er bekreftet, returneres feil.
    if (departure.status === "confirmed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er allerede bekreftet" },
        { status: 400 }
      );
    }

    // Teller hvor mange bindende påmeldinger avgangen har.
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

    // Hvis turen ikke har nok bindende påmeldte til å nå minimumskravet,
    // kan den ikke bekreftes ennå.
    if (bindingCount < departure.min_participants) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Turen har ikke nok bindende påmeldinger til å bekreftes ennå",
        },
        { status: 400 }
      );
    }

    // Oppdaterer avgangen til status confirmed.
    await client.query(
      `
      UPDATE public.trip_departures
      SET status = 'confirmed'
      WHERE id = $1
      `,
      [departureId]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons med antall bindende påmeldte.
    return NextResponse.json(
      {
        success: true,
        message: "Turen er bekreftet",
        binding_count: bindingCount,
      },
      { status: 200 }
    );
  } catch (error) {
    // Hvis noe går galt, prøver vi å rulle tilbake transaksjonen.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      // Hvis rollback også feiler, logges det separat.
      console.error("Rollback error:", rollbackError);
    }

    // Logger backend-feilen i terminalen for debugging.
    console.error("Confirm departure API error:", error);

    // Returnerer generell 500-feil til klienten.
    return NextResponse.json(
      {
        error: "Kunne ikke bekrefte turen",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}