import { NextResponse } from "next/server";
import pool from "../../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "alle";
    const difficulty = searchParams.get("difficulty") || "alle";
    const onlyTiu = (searchParams.get("onlyTiu") || "false") === "true";

    let query = `
      SELECT
        t.id,
        t.navn,
        t.beskrivelse,
        t.lengde_km,
        t.type,
        t.vanskelighetsgrad,
        tt.id AS tiu_trip_id
      FROM public.trips t
      LEFT JOIN public.tiu_trips tt ON tt.trip_id = t.id
      WHERE t.navn ILIKE $1
    `;

    const values = [`%${search}%`];

    if (type !== "alle") {
      query += ` AND t.type = $${values.length + 1}`;
      values.push(type);
    }

    if (difficulty !== "alle") {
      query += ` AND t.vanskelighetsgrad = $${values.length + 1}`;
      values.push(difficulty);
    }

    if (onlyTiu) {
      query += ` AND tt.id IS NOT NULL`;
    }

    query += ` ORDER BY t.id`;

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Trips API GET error:", error);
    return NextResponse.json({ error: "Kunne ikke hente turer" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const navn = (body.navn || "").trim();
    const beskrivelse = body.beskrivelse ?? null;
    const lengde_km = Number(body.lengde_km);
    const type = (body.type || "").trim();
    const vanskelighetsgrad = (body.vanskelighetsgrad || "").trim();

    const start_lat = body.start_lat ?? null;
    const start_lng = body.start_lng ?? null;
    const end_lat = body.end_lat ?? null;
    const end_lng = body.end_lng ?? null;

    if (!navn) {
      return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
    }
    if (!Number.isFinite(lengde_km) || lengde_km <= 0) {
      return NextResponse.json({ error: "Lengde (km) må være et positivt tall" }, { status: 400 });
    }

    const allowedTypes = new Set(["fottur", "skitur", "sykkel"]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
    }

    const allowedDiff = new Set(["lett", "middels", "krevende"]);
    if (!allowedDiff.has(vanskelighetsgrad)) {
      return NextResponse.json({ error: "Ugyldig vanskelighetsgrad" }, { status: 400 });
    }

    const isValidCoord = (x, min, max) =>
      x === null || x === undefined || (Number.isFinite(Number(x)) && Number(x) >= min && Number(x) <= max);

    if (
      !isValidCoord(start_lat, -90, 90) ||
      !isValidCoord(end_lat, -90, 90) ||
      !isValidCoord(start_lng, -180, 180) ||
      !isValidCoord(end_lng, -180, 180)
    ) {
      return NextResponse.json({ error: "Ugyldige koordinater" }, { status: 400 });
    }

    const query = `
      INSERT INTO public.trips
        (navn, beskrivelse, lengde_km, type, vanskelighetsgrad, start_lat, start_lng, end_lat, end_lng)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, navn, beskrivelse, lengde_km, type, vanskelighetsgrad, opprettet, start_lat, start_lng, end_lat, end_lng
    `;

    const values = [
      navn,
      beskrivelse,
      lengde_km,
      type,
      vanskelighetsgrad,
      start_lat,
      start_lng,
      end_lat,
      end_lng,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Trips API POST error:", error);
    return NextResponse.json({ error: "Kunne ikke opprette tur" }, { status: 500 });
  }
}