import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../lib/auth";

export async function POST(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const roleError = requireRole(user, ["admin", "turleder"]);
    if (roleError) {
      return roleError;
    }

    const tripId = Number(params.id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const dateOptionId = Number(body.dateOptionId);
    const minParticipants = Number(body.min_participants ?? 1);
    const maxParticipants =
      body.max_participants === null || body.max_participants === undefined
        ? null
        : Number(body.max_participants);

    if (!Number.isFinite(dateOptionId)) {
      return NextResponse.json(
        { error: "Ugyldig datoalternativ" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(minParticipants) || minParticipants < 1) {
      return NextResponse.json(
        { error: "Minste antall deltakere må være minst 1" },
        { status: 400 }
      );
    }

    if (maxParticipants !== null) {
      if (!Number.isFinite(maxParticipants) || maxParticipants < minParticipants) {
        return NextResponse.json(
          { error: "Maks antall deltakere må være større enn eller lik minimum" },
          { status: 400 }
        );
      }
    }

    await client.query("BEGIN");

    const tripResult = await client.query(
      `
      SELECT
        t.id,
        tt.id AS tiu_trip_id,
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

    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke fleksibel fellestur" },
        { status: 404 }
      );
    }

    const trip = tripResult.rows[0];

    if (!trip.is_flexible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen er ikke fleksibel" },
        { status: 400 }
      );
    }

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

    if (existingDepartureResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen har allerede en aktiv avgang" },
        { status: 400 }
      );
    }

    const optionResult = await client.query(
      `
      SELECT
        id,
        trip_id,
        start_time,
        end_time
      FROM public.trip_date_options
      WHERE id = $1
        AND trip_id = $2
      FOR UPDATE
      `,
      [dateOptionId, tripId]
    );

    if (optionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Datoalternativet ble ikke funnet" },
        { status: 404 }
      );
    }

    const selectedOption = optionResult.rows[0];

    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = false
      WHERE trip_id = $1
      `,
      [tripId]
    );

    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = true
      WHERE id = $1
      `,
      [dateOptionId]
    );

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
      RETURNING id, trip_id, start_time, end_time, min_participants, max_participants, status
      `,
      [
        tripId,
        selectedOption.start_time,
        selectedOption.end_time,
        minParticipants,
        maxParticipants,
      ]
    );

    await client.query(
      `
      UPDATE public.tiu_trips
      SET planning_status = 'binding_open'
      WHERE trip_id = $1
      `,
      [tripId]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Dato valgt og avgang opprettet",
        departure: departureResult.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Select date API error:", error);

    return NextResponse.json(
      { error: "Kunne ikke velge datoalternativ" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}