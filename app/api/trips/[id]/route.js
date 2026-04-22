import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

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

    const user = await getCurrentUser();

    trip.is_interested = false;
    trip.is_binding_registered = false;
    trip.can_open_group = false;
    trip.can_withdraw_interest = false;
    trip.can_withdraw_binding = false;
    trip.is_trip_admin = false;

    if (user?.id) {
      const interestResult = await pool.query(
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

      const registrationResult = await pool.query(
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

      const role = String(user.role || "").toUpperCase();
      trip.is_trip_admin = role === "ADMIN" || role === "TURLEDER";

      trip.is_interested = interestResult.rowCount > 0;
      trip.is_binding_registered = registrationResult.rowCount > 0;
      trip.can_open_group = trip.is_interested || trip.is_binding_registered;
      trip.can_withdraw_interest = trip.is_interested;
      trip.can_withdraw_binding = trip.is_binding_registered;
    }

    return NextResponse.json(trip);
  } catch (error) {
    console.error("Trip details API GET error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente tur", details: error?.message || "Ukjent feil" },
      { status: 500 }
    );
  }
}