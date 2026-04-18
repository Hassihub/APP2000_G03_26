import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

let customRouteTablesReady = false;

async function ensureCustomRouteTables() {
  if (customRouteTablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.route_verification_cabins (
      route_verification_id UUID NOT NULL,
      cabin_id UUID NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (route_verification_id, cabin_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_route_verification_cabins_route_id
    ON public.route_verification_cabins (route_verification_id)
  `);

  customRouteTablesReady = true;
}

function mapActivity(type) {
  if (type === "skitur") return "ski";
  if (type === "sykkel") return "cycle";
  return "foot";
}

function mapDifficulty(vanskelighetsgrad) {
  if (vanskelighetsgrad === "lett") return 1;
  if (vanskelighetsgrad === "middels") return 2;
  return 3;
}

function estimateDurationMinutes(lengthKm, activity) {
  const minutesPerKmByActivity = {
    foot: 13,
    ski: 8,
    cycle: 4,
  };

  const factor = minutesPerKmByActivity[activity] ?? 13;
  return Math.max(1, Math.round(lengthKm * factor));
}

function isValidLineString(geometry) {
  if (!geometry || typeof geometry !== "object") return false;
  if (geometry.type !== "LineString") return false;
  if (!Array.isArray(geometry.coordinates)) return false;
  if (geometry.coordinates.length < 2) return false;

  return geometry.coordinates.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1]))
  );
}

export async function POST(request) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const client = await pool.connect();

  try {
    await ensureCustomRouteTables();

    const body = await request.json();

    const navn = String(body?.navn || "").trim();
    const beskrivelse = body?.beskrivelse ? String(body.beskrivelse).trim() : null;
    const lengde_km = Number(body?.lengde_km);
    const type = String(body?.type || "").trim();
    const vanskelighetsgrad = String(body?.vanskelighetsgrad || "").trim();
    const geometry = body?.geometry ?? null;
    const cabinIdsRaw = Array.isArray(body?.cabin_ids) ? body.cabin_ids : [];
    const cabin_ids = [...new Set(cabinIdsRaw.map((id) => String(id).trim()).filter(Boolean))];

    if (!navn) {
      return NextResponse.json({ error: "Navn er pakrevd" }, { status: 400 });
    }

    if (!Number.isFinite(lengde_km) || lengde_km <= 0) {
      return NextResponse.json({ error: "Lengde (km) ma vare et positivt tall" }, { status: 400 });
    }

    const allowedTypes = new Set(["fottur", "skitur", "sykkel"]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
    }

    const allowedDiff = new Set(["lett", "middels", "krevende"]);
    if (!allowedDiff.has(vanskelighetsgrad)) {
      return NextResponse.json({ error: "Ugyldig vanskelighetsgrad" }, { status: 400 });
    }

    if (!isValidLineString(geometry)) {
      return NextResponse.json(
        { error: "Rute ma ha minst to gyldige kartpunkter" },
        { status: 400 }
      );
    }

    if (cabin_ids.length === 0) {
      return NextResponse.json(
        { error: "Velg minst en hytte for turruten" },
        { status: 400 }
      );
    }

    if (cabin_ids.length > 25) {
      return NextResponse.json(
        { error: "Du kan velge maks 25 hytter per turrute" },
        { status: 400 }
      );
    }

    const cabinsResult = await client.query(
      `
        SELECT id::text AS id, name
        FROM public.cabins
        WHERE id::text = ANY($1::text[])
      `,
      [cabin_ids]
    );

    if (cabinsResult.rowCount !== cabin_ids.length) {
      return NextResponse.json(
        { error: "En eller flere valgte hytter finnes ikke" },
        { status: 400 }
      );
    }

    const cabinsById = new Map(cabinsResult.rows.map((row) => [String(row.id), row]));

    const activity = mapActivity(type);
    const difficulty = mapDifficulty(vanskelighetsgrad);
    const duration_minutes = estimateDurationMinutes(lengde_km, activity);
    const points = geometry.coordinates.map(([lon, lat]) => ({
      lat: Number(lat),
      lon: Number(lon),
      elevation: null,
    }));

    await client.query("BEGIN");

    const verificationResult = await client.query(
      `
        INSERT INTO routes_to_verification (
          name,
          description,
          activity,
          difficulty,
          duration_minutes,
          geometry,
          points,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        navn,
        beskrivelse,
        activity,
        difficulty,
        duration_minutes,
        JSON.stringify(geometry),
        JSON.stringify(points),
        String(user.id),
      ]
    );

    const verificationRoute = verificationResult.rows[0] ?? {};
    const routeVerificationId = String(
      verificationRoute.id ??
        verificationRoute.route_id ??
        verificationRoute.verification_id ??
        ""
    ).trim();

    if (!routeVerificationId) {
      throw new Error("Mangler ID fra routes_to_verification");
    }

    for (let i = 0; i < cabin_ids.length; i += 1) {
      await client.query(
        `
          INSERT INTO public.route_verification_cabins (route_verification_id, cabin_id, sort_order)
          VALUES ($1, $2, $3)
        `,
        [routeVerificationId, cabin_ids[i], i]
      );
    }

    await client.query("COMMIT");

    const cabins = cabin_ids
      .map((id) => cabinsById.get(id))
      .filter(Boolean)
      .map((row) => ({ id: row.id, name: row.name }));

    return NextResponse.json(
      {
        verification_route_id: routeVerificationId,
        verification_route: verificationRoute,
        cabins,
        owner_user_id: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Custom route POST error:", error);
    return NextResponse.json({ error: "Kunne ikke lagre turrute" }, { status: 500 });
  } finally {
    client.release();
  }
}
