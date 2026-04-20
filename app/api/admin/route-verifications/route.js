import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../lib/roles";

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeActivity(activity) {
  const value = String(activity || "").trim().toLowerCase();
  if (!value) return "fottur";
  if (value.includes("ski")) return "skitur";
  if (value.includes("cycle") || value.includes("bike") || value.includes("sykkel")) {
    return "sykkel";
  }
  return "fottur";
}

function normalizeDifficulty(difficulty) {
  if (typeof difficulty === "number") {
    if (difficulty <= 1) return "lett";
    if (difficulty === 2) return "middels";
    return "krevende";
  }

  const value = String(difficulty || "").trim().toLowerCase();
  if (!value) return "middels";
  if (value === "1" || value.includes("lett") || value.includes("easy")) return "lett";
  if (value === "2" || value.includes("middels") || value.includes("medium")) return "middels";
  return "krevende";
}

function normalizeGeometry(rawGeometry, rawPoints) {
  let geometry = rawGeometry;

  if (typeof geometry === "string") {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      geometry = null;
    }
  }

  if (
    geometry &&
    typeof geometry === "object" &&
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates)
  ) {
    const coordinates = geometry.coordinates
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const lon = Number(point[0]);
        const lat = Number(point[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
        return [lon, lat];
      })
      .filter(Boolean);

    if (coordinates.length >= 2) {
      return {
        type: "LineString",
        coordinates,
      };
    }
  }

  let points = rawPoints;
  if (typeof points === "string") {
    try {
      points = JSON.parse(points);
    } catch {
      points = null;
    }
  }

  if (Array.isArray(points)) {
    const coordinates = points
      .map((point) => {
        const lon = Number(point?.lon);
        const lat = Number(point?.lat);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
        return [lon, lat];
      })
      .filter(Boolean);

    if (coordinates.length >= 2) {
      return {
        type: "LineString",
        coordinates,
      };
    }
  }

  return null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function calculateLengthKm(geometry) {
  const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  if (coords.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const prev = coords[i - 1];
    const curr = coords[i];

    total += haversineKm(Number(prev[1]), Number(prev[0]), Number(curr[1]), Number(curr[0]));
  }

  return Number(total.toFixed(2));
}

async function hasRouteVerificationCabinsTable(client) {
  const result = await client.query(
    "SELECT to_regclass('public.route_verification_cabins') IS NOT NULL AS exists"
  );
  return result.rows[0]?.exists === true;
}

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;

  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError;

  const client = await pool.connect();

  try {
    const routesResult = await client.query(
      `
        SELECT r.*, u.username AS created_by_username
        FROM public.routes_to_verification r
        LEFT JOIN public.users u
          ON u.id::text = r.created_by::text
        ORDER BY r.id DESC
      `
    );

    const routes = routesResult.rows || [];
    const routeIds = routes.map((route) => String(route.id));

    let cabinsByRouteId = new Map();
    if (routeIds.length > 0 && (await hasRouteVerificationCabinsTable(client))) {
      const cabinResult = await client.query(
        `
          SELECT
            rvc.route_verification_id::text AS route_id,
            c.id::text AS cabin_id,
            c.name,
            rvc.sort_order
          FROM public.route_verification_cabins rvc
          JOIN public.cabins c ON c.id::text = rvc.cabin_id::text
          WHERE rvc.route_verification_id::text = ANY($1::text[])
          ORDER BY rvc.sort_order ASC
        `,
        [routeIds]
      );

      cabinsByRouteId = cabinResult.rows.reduce((map, row) => {
        const key = String(row.route_id);
        const list = map.get(key) || [];
        list.push({ id: row.cabin_id, name: row.name, sort_order: row.sort_order });
        map.set(key, list);
        return map;
      }, new Map());
    }

    const payload = routes.map((route) => {
      const geometry = normalizeGeometry(route.geometry, route.points);
      const length_km = calculateLengthKm(geometry);

      return {
        id: route.id,
        name: route.name || route.navn || "Uten navn",
        description: route.description || route.beskrivelse || "",
        bilde_url: route.bilde_url || null,
        type: normalizeActivity(route.activity || route.type),
        difficulty: normalizeDifficulty(route.difficulty || route.vanskelighetsgrad),
        length_km,
        geometry,
        created_by: route.created_by || null,
        created_by_username: route.created_by_username || null,
        cabins: cabinsByRouteId.get(String(route.id)) || [],
      };
    });

    return NextResponse.json({ routes: payload });
  } catch (error) {
    console.error("Admin route-verifications GET error:", error);
    return jsonError("Kunne ikke hente ruter til verifisering", 500);
  } finally {
    client.release();
  }
}
