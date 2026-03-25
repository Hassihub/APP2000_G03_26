import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth, requireRole } from "../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../lib/roles";

let cabinImagesTableReady = false;

async function ensureCabinImagesTable() {
  if (cabinImagesTableReady) return true;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.cabin_images (
        id BIGSERIAL PRIMARY KEY,
        cabin_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_cabin_images_cabin_id
      ON public.cabin_images (cabin_id)
    `);

    cabinImagesTableReady = true;
    return true;
  } catch {
    return false;
  }
}

async function attachCabinImages(cabins = []) {
  if (!cabins.length) return cabins;

  const hasTable = await ensureCabinImagesTable();
  if (!hasTable) return cabins.map((c) => ({ ...c, image_urls: [] }));

  const ids = cabins.map((c) => String(c.id));
  const imageRes = await db.query(
    `
      SELECT cabin_id, image_url
      FROM public.cabin_images
      WHERE cabin_id = ANY($1::text[])
      ORDER BY sort_order ASC, created_at ASC
    `,
    [ids]
  );

  const byCabin = new Map();
  for (const row of imageRes.rows) {
    const key = String(row.cabin_id);
    const arr = byCabin.get(key) ?? [];
    arr.push(row.image_url);
    byCabin.set(key, arr);
  }

  return cabins.map((c) => ({
    ...c,
    image_urls: byCabin.get(String(c.id)) ?? [],
  }));
}

async function storeCabinImages(cabinId, imageUrls) {
  if (!Array.isArray(imageUrls) || !imageUrls.length) return;

  const hasTable = await ensureCabinImagesTable();
  if (!hasTable) return;

  for (let i = 0; i < imageUrls.length; i += 1) {
    await db.query(
      `
        INSERT INTO public.cabin_images (cabin_id, image_url, sort_order)
        VALUES ($1, $2, $3)
      `,
      [String(cabinId), String(imageUrls[i]), i]
    );
  }
}

export async function GET() {
  try {
    const sql = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at, owner_id
      FROM public.cabins
      ORDER BY created_at DESC
    `;
    const result = await db.query(sql);
    const cabins = await attachCabinImages(result.rows);
    return NextResponse.json({ cabins }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const roleError = requireRole(user, [ROLE_UTLEIER, ROLE_ADMIN]);
    if (roleError) return roleError;

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
      : null;
    const image_urls = Array.isArray(body.image_urls)
      ? body.image_urls.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const insertSqlWithOwner = `
      INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, created_at;
    `;
    const valuesWithOwner = [
      name,
      description,
      location,
      price_per_night,
      capacity,
      amenities,
      latitude,
      longitude,
      user.id,
    ];

    try {
      const result = await db.query(insertSqlWithOwner, valuesWithOwner);
      const cabin = result.rows[0];
      await storeCabinImages(cabin.id, image_urls);
      return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 201 });
    } catch (err) {
      // Hvis DB ikke har owner_id-kolonne, fall tilbake til gammel insert (bakoverkompatibel)
      if (err?.code === "42703" || err?.message?.includes("column \"owner_id\"")) {
        const insertSql = `
          INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at
        `;
        const values = [
          name,
          description,
          location,
          price_per_night,
          capacity,
          amenities,
          latitude,
          longitude,
        ];
        const result = await db.query(insertSql, values);
        const cabin = result.rows[0];
        await storeCabinImages(cabin.id, image_urls);
        return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 201 });
      }
      throw err;
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
