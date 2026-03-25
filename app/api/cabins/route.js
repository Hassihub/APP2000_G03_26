import { NextResponse } from "next/server";
import db from "../../../lib/db"; // default export (Pool)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    let sql = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at
      FROM public.cabins
    `;

    const values = [];

    if (search) {
      sql += `
        WHERE
          name ILIKE $1 OR
          location ILIKE $1 OR
          COALESCE(description, '') ILIKE $1
      `;
      values.push(`%${search}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await db.query(sql, values);
    return NextResponse.json({ cabins: result.rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const location = String(body.location ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;

    const price_per_night = Number(body.price_per_night);
    const capacity = Number(body.capacity);

    const hasLatitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== "";
    const hasLongitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== "";

    const latitude = hasLatitude ? Number(body.latitude) : null;
    const longitude = hasLongitude ? Number(body.longitude) : null;

    if (!name) return NextResponse.json({ error: "name er påkrevd" }, { status: 400 });
    if (!location) return NextResponse.json({ error: "location er påkrevd" }, { status: 400 });
    if (!Number.isFinite(price_per_night)) {
      return NextResponse.json({ error: "price_per_night må være tall" }, { status: 400 });
    }
    if (!Number.isFinite(capacity)) {
      return NextResponse.json({ error: "capacity må være tall" }, { status: 400 });
    }

    if (hasLatitude && !Number.isFinite(latitude)) {
      return NextResponse.json({ error: "latitude må være tall" }, { status: 400 });
    }
    if (hasLongitude && !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "longitude må være tall" }, { status: 400 });
    }

    const amenities = Array.isArray(body.amenities)
      ? body.amenities.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const sql = `
      INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6::STRING[], $7, $8)
      RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at;
    `;

    const values = [name, description, location, price_per_night, capacity, amenities, latitude, longitude];

    const result = await db.query(sql, values);

    return NextResponse.json({ cabin: result.rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
