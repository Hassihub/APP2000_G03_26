// Konrad - 274088
import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

export async function POST(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const userId = user.id;
    const { id } = await params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    await client.query("BEGIN");

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
      [tripId],
    );

    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke fleksibel fellestur" },
        { status: 404 },
      );
    }

    const trip = tripResult.rows[0];

    if (!trip.is_flexible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen er ikke en fleksibel fellestur" },
        { status: 400 },
      );
    }

    if (trip.planning_status !== "interest_open") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er ikke åpen for ikke-bindende interesse" },
        { status: 400 },
      );
    }

    await client.query(
      `
      INSERT INTO public.trip_interest (trip_id, user_id, status)
      VALUES ($1, $2, 'interested')
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET status = 'interested'
      `,
      [tripId, userId],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Ikke-bindende interesse registrert",
      },
      { status: 200 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Interest API error:", error);

    return NextResponse.json(
      { error: "Kunne ikke registrere interesse" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const userId = user.id;
    const { id } = await params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    await client.query("BEGIN");

    await client.query(
      `
      UPDATE public.trip_interest
      SET status = 'withdrawn'
      WHERE trip_id = $1
        AND user_id = $2
      `,
      [tripId, userId],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Interesse trukket",
      },
      { status: 200 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Withdraw interest API error:", error);

    return NextResponse.json(
      { error: "Kunne ikke trekke interesse" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

