import { NextResponse } from "next/server";
import pool from "../../../../lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

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

    const result = await pool.query(query, [tripId]);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Fant ikke turen" },
        { status: 404 }
      );
    }

    const trip = result.rows[0];

    const optionsResult = await pool.query(
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

    const interestCountResult = await pool.query(
      `
      SELECT COUNT(*)::int AS interested_count
      FROM public.trip_interest
      WHERE trip_id = $1
        AND status = 'interested'
      `,
      [tripId]
    );

    trip.date_options = optionsResult.rows;
    trip.interested_count = interestCountResult.rows[0]?.interested_count ?? 0;

    return NextResponse.json(trip);
  } catch (error) {
    console.error("Trip details API GET error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente tur" },
      { status: 500 }
    );
  }
}