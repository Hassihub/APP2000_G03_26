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

    // Hent bilde_urls fra trips hvis den finnes, ellers fallback til routes_to_verification (for gamle data)
    if (trip.bilde_urls === undefined) {
      const tripResult = await pool.query(
        `SELECT bilde_urls FROM public.trips WHERE id = $1 LIMIT 1`,
        [tripId]
      );
      if (tripResult.rowCount > 0 && tripResult.rows[0].bilde_urls) {
        trip.bilde_urls = tripResult.rows[0].bilde_urls;
      } else if (!trip.bilde_url) {
        const customResult = await pool.query(
          `SELECT bilde_urls FROM public.routes_to_verification WHERE name = $1 LIMIT 1`,
          [trip.navn]
        );
        if (customResult.rowCount > 0 && customResult.rows[0].bilde_urls) {
          trip.bilde_urls = customResult.rows[0].bilde_urls;
        } else {
          trip.bilde_urls = [];
        }
      } else {
        trip.bilde_urls = [];
      }
    }

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

    const tripCabinsTableResult = await pool.query(
      "SELECT to_regclass('public.trip_cabins') IS NOT NULL AS exists"
    );

    let cabins = [];
    if (tripCabinsTableResult.rows[0]?.exists === true) {
      const cabinsResult = await pool.query(
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

    trip.date_options = optionsResult.rows;
    trip.interested_count = interestCountResult.rows[0]?.interested_count ?? 0;
    trip.cabins = cabins;

    return NextResponse.json(trip);
  } catch (error) {
    console.error("Trip details API GET error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente tur" },
      { status: 500 }
    );
  }
}