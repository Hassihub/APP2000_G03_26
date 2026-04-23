// Importerer NextResponse for å kunne sende JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten brukes for fleksible turer der brukere kan:
// - registrere ikke-bindende interesse (POST)
// - trekke tilbake interessen sin (DELETE)


// POST-ruta registrerer ikke-bindende interesse for en fleksibel tur.
export async function POST(request, { params }) {
  // Henter databaseklient fra connection pool.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Henter bruker-ID fra session.
    const userId = user.id;

    // Leser tur-ID fra route-parametrene.
    const { id } = await params;
    const tripId = Number(id);

    // Returnerer 400 hvis tur-ID ikke er gyldig tall.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Henter turen og relevant TiU-info.
    // FOR UPDATE låser raden slik at status ikke endres samtidig av noe annet.
    const tripResult = await client.query(
      `
      SELECT
        t.id,
        tt.is_flexible,
        tt.planning_status
      FROM public.trips t
      JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      WHERE t.id = $1
      FOR UPDATE
      `,
      [tripId]
    );

    // Hvis turen ikke finnes eller ikke er en TiU/fleksibel tur, returneres 404.
    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke fleksibel fellestur" },
        { status: 404 }
      );
    }

    // Henter turdataene.
    const trip = tripResult.rows[0];

    // Hvis turen ikke er markert som fleksibel, kan man ikke registrere interesse.
    if (!trip.is_flexible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen er ikke en fleksibel fellestur" },
        { status: 400 }
      );
    }

    // Interesse kan bare meldes når planstatus er "interest_open".
    if (trip.planning_status !== "interest_open") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er ikke åpen for ikke-bindende interesse" },
        { status: 400 }
      );
    }

    // Oppretter en rad i trip_interest hvis den ikke finnes,
    // eller oppdaterer eksisterende rad tilbake til status 'interested'.
    // Dette gjør at en bruker kan melde interesse igjen etter å ha trukket den.
    await client.query(
      `
      INSERT INTO public.trip_interest (trip_id, user_id, status)
      VALUES ($1, $2, 'interested')
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET status = 'interested'
      `,
      [tripId, userId]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons.
    return NextResponse.json(
      {
        success: true,
        message: "Ikke-bindende interesse registrert",
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

    // Logger backend-feilen i terminalen.
    console.error("Interest API error:", error);

    // Returnerer generell 500-feil til klienten.
    return NextResponse.json(
      { error: "Kunne ikke registrere interesse" },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}


// DELETE-ruta brukes for å trekke tilbake ikke-bindende interesse.
export async function DELETE(request, { params }) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Henter bruker-ID fra session.
    const userId = user.id;

    // Leser tur-ID fra URL-parametrene.
    const { id } = await params;
    const tripId = Number(id);

    // Returnerer 400 hvis tur-ID ikke er gyldig.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Oppdaterer interessen til status 'withdrawn' i stedet for å slette raden.
    // Dette gjør at historikken bevares, og at brukeren senere kan registrere interesse igjen.
    await client.query(
      `
      UPDATE public.trip_interest
      SET status = 'withdrawn'
      WHERE trip_id = $1
        AND user_id = $2
      `,
      [tripId, userId]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons.
    return NextResponse.json(
      {
        success: true,
        message: "Interesse trukket",
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

    // Logger backend-feilen i terminalen.
    console.error("Withdraw interest API error:", error);

    // Returnerer generell 500-feil til klienten.
    return NextResponse.json(
      { error: "Kunne ikke trekke interesse" },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}