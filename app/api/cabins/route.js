import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth, requireRole } from "../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../lib/roles";

function isMissingColumn(err, columnName) {
  return err?.code === "42703" || err?.message?.includes(`column \"${columnName}\"`);
}

let cabinImagesTableReady = false;
let cabinStaffedColumnReady = false;
let cabinReviewsTableReady = false;

async function ensureCabinStaffedColumn() {
  if (cabinStaffedColumnReady) return true;

  try {
    await db.query(`
      ALTER TABLE public.cabins
      ADD COLUMN IF NOT EXISTS is_staffed BOOLEAN NOT NULL DEFAULT false
    `);
    cabinStaffedColumnReady = true;
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

async function ensureCabinReviewsTable() {
  if (cabinReviewsTableReady) return true;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.cabin_reviews (
        id BIGSERIAL PRIMARY KEY,
        cabin_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cabin_reviews_cabin_user
      ON public.cabin_reviews (cabin_id, user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_cabin_reviews_cabin_id
      ON public.cabin_reviews (cabin_id)
    `);

    cabinReviewsTableReady = true;
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

async function attachCabinRatings(cabins = []) {
  if (!cabins.length) return cabins;

  const hasTable = await ensureCabinReviewsTable();
  if (!hasTable) {
    return cabins.map((c) => ({
      ...c,
      average_rating: null,
      review_count: 0,
    }));
  }

  const ids = cabins.map((c) => String(c.id));
  const ratingRes = await db.query(
    `
      SELECT
        cabin_id,
        ROUND(AVG(rating)::numeric, 1) AS average_rating,
        COUNT(*)::int AS review_count
      FROM public.cabin_reviews
      WHERE cabin_id = ANY($1::text[])
      GROUP BY cabin_id
    `,
    [ids]
  );

  const ratingsByCabin = new Map();
  for (const row of ratingRes.rows) {
    ratingsByCabin.set(String(row.cabin_id), {
      average_rating:
        row.average_rating === null ? null : Number.parseFloat(String(row.average_rating)),
      review_count: Number(row.review_count) || 0,
    });
  }

  return cabins.map((c) => {
    const rating = ratingsByCabin.get(String(c.id));
    return {
      ...c,
      average_rating: rating?.average_rating ?? null,
      review_count: rating?.review_count ?? 0,
    };
  });
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

export async function GET(req) {
  try {
    await ensureCabinStaffedColumn();
    const { searchParams } = new URL(req.url);
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");
    const search = searchParams.get("search")?.trim() || "";
    const staffed = searchParams.get("staffed");
    const minPriceRaw = searchParams.get("min_price");
    const maxPriceRaw = searchParams.get("max_price");
    const amenitiesRaw = searchParams.get("amenities")?.trim() || "";

    const values = [];
    const conditions = [];
    let paramIndex = 1;

    // Hvis både start- og sluttdato er satt, filtrer på hytter som er ledige
    if (start_date && end_date) {
      // Overlappende reservasjoner: NOT (existing.end <= new.start OR existing.start >= new.end)
      // Vi vil ha hytter der det IKKE finnes en slik overlappende reservasjon
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.cabin_id::text = c.id::text
          AND r.status <> 'cancelled'
          AND NOT (r.end_date <= $${paramIndex}::date OR r.start_date >= $${paramIndex + 1}::date)
      )`);
      values.push(start_date, end_date);
      paramIndex += 2;
    }

    if (search) {
      conditions.push(`(
        c.name ILIKE $${paramIndex} OR
        c.location ILIKE $${paramIndex} OR
        COALESCE(c.description, '') ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex += 1;
    }

    if (staffed === "true" || staffed === "false") {
      conditions.push(`COALESCE(c.is_staffed, false) = $${paramIndex}::boolean`);
      values.push(staffed === "true");
      paramIndex += 1;
    }

    const minPrice = minPriceRaw === null ? null : Number(minPriceRaw);
    if (Number.isFinite(minPrice) && minPrice >= 0) {
      conditions.push(`c.price_per_night >= $${paramIndex}`);
      values.push(minPrice);
      paramIndex += 1;
    }

    const maxPrice = maxPriceRaw === null ? null : Number(maxPriceRaw);
    if (Number.isFinite(maxPrice) && maxPrice >= 0) {
      conditions.push(`c.price_per_night <= $${paramIndex}`);
      values.push(maxPrice);
      paramIndex += 1;
    }

    const amenities = amenitiesRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (amenities.length > 0) {
      conditions.push(`COALESCE(c.amenities, ARRAY[]::text[]) @> $${paramIndex}::text[]`);
      values.push(amenities);
      paramIndex += 1;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlWithStaffed = `
      SELECT c.id, c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude, c.created_at, c.owner_id, u.username AS owner_name, COALESCE(c.is_staffed, false) AS is_staffed
      FROM public.cabins c
      LEFT JOIN public.users u ON u.id::text = c.owner_id::text
      ${whereClause}
      ORDER BY c.created_at DESC
    `;
    const sqlWithoutStaffed = `
      SELECT c.id, c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude, c.created_at, c.owner_id, u.username AS owner_name
      FROM public.cabins c
      LEFT JOIN public.users u ON u.id::text = c.owner_id::text
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    let rows;
    try {
      const result = await db.query(sqlWithStaffed, values);
      rows = result.rows;
    } catch (err) {
      if (!isMissingColumn(err, "is_staffed")) throw err;
      const fallback = await db.query(sqlWithoutStaffed, values);
      rows = fallback.rows.map((cabin) => ({ ...cabin, is_staffed: false }));
    }

    const cabinsWithImages = await attachCabinImages(rows);
    const cabins = await attachCabinRatings(cabinsWithImages);
    return NextResponse.json({ cabins }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureCabinStaffedColumn();
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
    const is_staffed = Boolean(body.is_staffed);

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

    const insertSqlWithOwnerAndStaffed = `
      INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, is_staffed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, created_at, is_staffed;
    `;
    const valuesWithOwnerAndStaffed = [
      name,
      description,
      location,
      price_per_night,
      capacity,
      amenities,
      latitude,
      longitude,
      user.id,
      is_staffed,
    ];

    try {
      const result = await db.query(insertSqlWithOwnerAndStaffed, valuesWithOwnerAndStaffed);
      const cabin = result.rows[0];
      await storeCabinImages(cabin.id, image_urls);
      return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 201 });
    } catch (err) {
      // Bakoverkompatibilitet med ulike schema-varianter
      if (isMissingColumn(err, "owner_id") || isMissingColumn(err, "is_staffed")) {
        const insertSqlWithStaffed = `
          INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude, is_staffed)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at, is_staffed
        `;
        const valuesWithStaffed = [
          name,
          description,
          location,
          price_per_night,
          capacity,
          amenities,
          latitude,
          longitude,
          is_staffed,
        ];

        try {
          const withStaffed = await db.query(insertSqlWithStaffed, valuesWithStaffed);
          const cabin = withStaffed.rows[0];
          await storeCabinImages(cabin.id, image_urls);
          return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 201 });
        } catch (err2) {
          if (!isMissingColumn(err2, "is_staffed")) throw err2;
        }

        const insertSql = `
          INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at, false AS is_staffed
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
