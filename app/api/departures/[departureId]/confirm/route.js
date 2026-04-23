import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten håndterer bekreftelse av turavganger.
// POST: Bekrefter en avgang, gjør den bindende for påmeldte deltakere (kun for turleder eller admin)

// Sikrer at turleder_user_id kolonnen finnes
async function ensureTurlederUserIdColumn(client) {
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id)
  `);

  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}

// Bekrefter en turavgang og gjør den bindende
export async function POST(request, context) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    await ensureTurlederUserIdColumn(client);

    const { departureId: departureIdParam } = await context.params;
    const departureId = Number(departureIdParam);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json(
        { error: "Ugyldig avgang" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

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

    if (departureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke avgangen" },
        { status: 404 }
      );
    }

    const departure = departureResult.rows[0];

    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";
    const isLeaderForThisTrip =
      departure.turleder_user_id &&
      String(departure.turleder_user_id) === String(user.id);

    if (!isAdmin && !isLeaderForThisTrip) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Ingen tilgang" },
        { status: 403 }
      );
    }

    if (departure.status === "cancelled") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgangen er avlyst" },
        { status: 400 }
      );
    }

    if (departure.status === "confirmed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er allerede bekreftet" },
        { status: 400 }
      );
    }

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

    if (bindingCount < departure.min_participants) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Turen har ikke nok bindende påmeldinger til å bekreftes ennå",
        },
        { status: 400 }
      );
    }

    await client.query(
      `
      UPDATE public.trip_departures
      SET status = 'confirmed'
      WHERE id = $1
      `,
      [departureId]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Turen er bekreftet",
        binding_count: bindingCount,
      },
      { status: 200 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Confirm departure API error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke bekrefte turen",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}