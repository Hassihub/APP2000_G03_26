import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../lib/roles";

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function hasTripCabinsTable(client) {
  const result = await client.query(
    "SELECT to_regclass('public.trip_cabins') IS NOT NULL AS exists"
  );
  return result.rows[0]?.exists === true;
}

async function hasTripCabinsSortOrderColumn(client) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trip_cabins'
          AND column_name = 'sort_order'
      ) AS exists
    `
  );
  return result.rows[0]?.exists === true;
}

async function requireAdmin() {
  const { user, response } = await requireAuth();
  if (response) return { response };

  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return { response: roleError };

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        SELECT
          t.id,
          t.navn,
          t.beskrivelse,
          t.lengde_km,
          t.type,
          t.vanskelighetsgrad,
          t.geometry,
          tt.id AS tiu_trip_id,
          tt.turleder_navn,
          tt.is_flexible,
          tt.planning_status,
          tt.opprettet AS tiu_opprettet,
          COALESCE(date_options.date_options_count, 0) AS date_options_count,
          COALESCE(date_options.date_options, '[]'::json) AS date_options
        FROM public.trips t
        JOIN public.tiu_trips tt
          ON tt.trip_id = t.id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS date_options_count,
            json_agg(
              json_build_object(
                'id', tdo.id,
                'start_time', tdo.start_time,
                'end_time', tdo.end_time,
                'is_selected', tdo.is_selected
              )
              ORDER BY tdo.start_time ASC
            ) AS date_options
          FROM public.trip_date_options tdo
          WHERE tdo.trip_id = t.id
        ) date_options ON true
        WHERE tt.planning_status = 'draft'
        ORDER BY tt.opprettet ASC, t.id ASC
      `
    );

    const trips = result.rows;
    const tripIds = trips.map((trip) => Number(trip.id)).filter(Number.isFinite);

    let cabinsByTripId = new Map();
    if (tripIds.length > 0 && (await hasTripCabinsTable(client))) {
      const hasSortOrder = await hasTripCabinsSortOrderColumn(client);
      const cabinQuery = hasSortOrder
        ? `
            SELECT
              tc.trip_id::text AS trip_id,
              c.id::text AS cabin_id,
              c.name,
              c.location,
              c.latitude,
              c.longitude,
              tc.sort_order
            FROM public.trip_cabins tc
            JOIN public.cabins c
              ON c.id::text = tc.cabin_id::text
            WHERE tc.trip_id = ANY($1::bigint[])
            ORDER BY tc.trip_id ASC, tc.sort_order ASC, c.name ASC
          `
        : `
            SELECT
              tc.trip_id::text AS trip_id,
              c.id::text AS cabin_id,
              c.name,
              c.location,
              c.latitude,
              c.longitude,
              0::int AS sort_order
            FROM public.trip_cabins tc
            JOIN public.cabins c
              ON c.id::text = tc.cabin_id::text
            WHERE tc.trip_id = ANY($1::bigint[])
            ORDER BY tc.trip_id ASC, c.name ASC
          `;

      const cabinResult = await client.query(cabinQuery, [tripIds]);
      cabinsByTripId = cabinResult.rows.reduce((map, row) => {
        const key = String(row.trip_id);
        const list = map.get(key) || [];
        list.push({ id: row.cabin_id, name: row.name, location: row.location, latitude: row.latitude, longitude: row.longitude, sort_order: row.sort_order });
        map.set(key, list);
        return map;
      }, new Map());
    }

    const withCabins = trips.map((trip) => ({
      ...trip,
      cabins: cabinsByTripId.get(String(trip.id)) || [],
    }));

    return NextResponse.json({ trips: withCabins });
  } catch (error) {
    console.error("Admin TIU trips GET error:", error);
    return jsonError("Kunne ikke hente TiU-turer", 500);
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const client = await pool.connect();

  try {
    const body = await request.json().catch(() => ({}));
    const tripId = Number(body.tripId);
    const decision = String(body.decision || "approve").trim().toLowerCase();

    if (!Number.isFinite(tripId)) {
      return jsonError("Ugyldig tur-ID", 400);
    }

    if (!["approve", "reject"].includes(decision)) {
      return jsonError("Ugyldig beslutning", 400);
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
      return jsonError("Fant ikke TiU-turen", 404);
    }

    const trip = tripResult.rows[0];

    if (trip.planning_status !== "draft") {
      await client.query("ROLLBACK");
      return jsonError("Turen er allerede behandlet", 400);
    }

    if (decision === "approve" && !trip.is_flexible) {
      await client.query("ROLLBACK");
      return jsonError("TiU-turen mangler fleksible startdatoer", 400);
    }

    await client.query(
      `
        UPDATE public.tiu_trips
        SET planning_status = $2
        WHERE trip_id = $1
      `,
      [tripId, decision === "approve" ? "interest_open" : "rejected"]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      tripId,
      planning_status: decision === "approve" ? "interest_open" : "rejected",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Admin TIU trips POST error:", error);
    return jsonError("Kunne ikke godkjenne TiU-tur", 500);
  } finally {
    client.release();
  }
}
