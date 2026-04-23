// Skrevet av Sigurd

import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

let favoritesTableReady = false;
let cabinImagesTableReady = false;

// Oppretter favoritt-tabell ved behov for miljooer uten migrering.
async function ensureFavoritesTable() {
  if (favoritesTableReady) return true;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.cabin_favorites (
        id BIGSERIAL PRIMARY KEY,
        cabin_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (cabin_id, user_id)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_cabin_favorites_user_created
      ON public.cabin_favorites (user_id, created_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_cabin_favorites_cabin
      ON public.cabin_favorites (cabin_id)
    `);

    favoritesTableReady = true;
    return true;
  } catch {
    return false;
  }
}

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

async function getFavoritesWithCabins(userId) {
  const result = await db.query(
    `
      SELECT
        f.cabin_id,
        f.created_at AS favorited_at,
        c.id,
        c.name,
        c.description,
        c.location,
        c.price_per_night,
        c.capacity,
        c.amenities,
        c.latitude,
        c.longitude,
        c.owner_id,
        c.created_at,
        u.username AS owner_name
      FROM public.cabin_favorites f
      LEFT JOIN public.cabins c ON c.id::text = f.cabin_id::text
      LEFT JOIN public.users u ON u.id::text = c.owner_id::text
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `,
    [String(userId)]
  );

  const cabins = result.rows
    .filter((row) => row?.id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      location: row.location,
      price_per_night: row.price_per_night,
      capacity: row.capacity,
      amenities: row.amenities,
      latitude: row.latitude,
      longitude: row.longitude,
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      created_at: row.created_at,
      favorited_at: row.favorited_at,
      image_urls: [],
    }));

  if (!cabins.length) return cabins;

  const hasImagesTable = await ensureCabinImagesTable();
  if (!hasImagesTable) return cabins;

  const ids = cabins.map((cabin) => String(cabin.id));
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
    const list = byCabin.get(key) ?? [];
    list.push(String(row.image_url));
    byCabin.set(key, list);
  }

  return cabins.map((cabin) => ({
    ...cabin,
    image_urls: byCabin.get(String(cabin.id)) ?? [],
  }));
}

export async function GET(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const hasTable = await ensureFavoritesTable();
    if (!hasTable) {
      return NextResponse.json({ error: "Kunne ikke lese favoritter." }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const cabinId = String(searchParams.get("cabin_id") ?? "").trim();

    // Hvis cabin_id finnes, returneres bare favoritt-status for den hytta.
    if (cabinId) {
      const exists = await db.query(
        `
          SELECT 1
          FROM public.cabin_favorites
          WHERE user_id = $1 AND cabin_id = $2
          LIMIT 1
        `,
        [String(user.id), cabinId]
      );

      return NextResponse.json(
        { cabin_id: cabinId, is_favorite: exists.rowCount > 0 },
        { status: 200 }
      );
    }

    // Ellers returneres hele favorittlisten med tilhorende hytteinfo.
    const favorites = await getFavoritesWithCabins(String(user.id));
    return NextResponse.json({ favorites }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const hasTable = await ensureFavoritesTable();
    if (!hasTable) {
      return NextResponse.json({ error: "Kunne ikke lagre favoritt." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const cabinId = String(body?.cabin_id ?? "").trim();

    if (!cabinId) {
      return NextResponse.json({ error: "cabin_id er påkrevd" }, { status: 400 });
    }

    // Legger til favoritt idempotent via ON CONFLICT.
    await db.query(
      `
        INSERT INTO public.cabin_favorites (cabin_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (cabin_id, user_id) DO NOTHING
      `,
      [cabinId, String(user.id)]
    );

    return NextResponse.json({ ok: true, cabin_id: cabinId, is_favorite: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const hasTable = await ensureFavoritesTable();
    if (!hasTable) {
      return NextResponse.json({ error: "Kunne ikke fjerne favoritt." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const cabinId = String(body?.cabin_id ?? "").trim();

    if (!cabinId) {
      return NextResponse.json({ error: "cabin_id er påkrevd" }, { status: 400 });
    }

    // Fjerner favoritt for innlogget bruker.
    await db.query(
      `
        DELETE FROM public.cabin_favorites
        WHERE cabin_id = $1 AND user_id = $2
      `,
      [cabinId, String(user.id)]
    );

    return NextResponse.json({ ok: true, cabin_id: cabinId, is_favorite: false }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}