import { NextResponse } from "next/server";
import pool from "../../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../../../lib/roles";

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

export async function POST(request, { params }) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError;

  const resolvedParams = await params;
  const routeId = String(resolvedParams?.id || "").trim();
  if (!routeId) {
    return jsonError("Mangler rute-ID", 400);
  }

  const body = await request.json().catch(() => ({}));
  const decision = String(body?.decision || "").trim().toLowerCase();

  if (!["approved", "rejected"].includes(decision)) {
    return jsonError("Ugyldig beslutning", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const routeResult = await client.query(
      `
        SELECT *
        FROM public.routes_to_verification
        WHERE id::text = $1
        FOR UPDATE
      `,
      [routeId]
    );

    if (routeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return jsonError("Fant ikke rute til verifisering", 404);
    }

    const route = routeResult.rows[0];

    const hasCabinTable = await hasRouteVerificationCabinsTable(client);
    if (hasCabinTable) {
      await client.query(
        `
          DELETE FROM public.route_verification_cabins
          WHERE route_verification_id::text = $1
        `,
        [routeId]
      );
    }

    if (decision === "rejected") {
      await client.query(
        `
          DELETE FROM public.routes_to_verification
          WHERE id::text = $1
        `,
        [routeId]
      );

      await client.query("COMMIT");
      return NextResponse.json({ ok: true, decision: "rejected", route_id: routeId });
    }

    const navn = String(route.name || route.navn || "").trim();
    const beskrivelse = route.description || route.beskrivelse || null;
    const type = normalizeActivity(route.activity || route.type);
    const vanskelighetsgrad = normalizeDifficulty(route.difficulty || route.vanskelighetsgrad);
    const bilde_url = route.bilde_url ? String(route.bilde_url).trim() : null;
    const bilde_urls = Array.isArray(route.bilde_urls) ? route.bilde_urls : [];
    const geometry = normalizeGeometry(route.geometry, route.points);
    const lengde_km = calculateLengthKm(geometry);

    if (!navn) {
      await client.query("ROLLBACK");
      return jsonError("Ruten mangler navn", 400);
    }

    if (!geometry) {
      await client.query("ROLLBACK");
      return jsonError("Ruten mangler gyldig geometri", 400);
    }

    if (!Number.isFinite(lengde_km) || lengde_km <= 0) {
      await client.query("ROLLBACK");
      return jsonError("Kunne ikke beregne gyldig lengde for ruten", 400);
    }

    const tripInsert = await client.query(
      `
        INSERT INTO public.trips (
          navn,
          beskrivelse,
          lengde_km,
          type,
          vanskelighetsgrad,
          bilde_url,
          bilde_urls,
          geometry
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, navn, beskrivelse, lengde_km, type, vanskelighetsgrad, opprettet, bilde_url, bilde_urls, geometry
      `,
      [
        navn,
        beskrivelse,
        lengde_km,
        type,
        vanskelighetsgrad,
        bilde_url,
        JSON.stringify(bilde_urls),
        geometry,
      ]
    );

    await client.query(
      `
        DELETE FROM public.routes_to_verification
        WHERE id::text = $1
      `,
      [routeId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      decision: "approved",
      route_id: routeId,
      trip: tripInsert.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin route-verifications decision POST error:", error);
    return jsonError("Kunne ikke behandle verifisering", 500);
  } finally {
    client.release();
  }
}
