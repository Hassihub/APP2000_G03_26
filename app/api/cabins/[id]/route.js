import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../../lib/roles";

function isMissingColumn(err, columnName) {
  return err?.code === "42703" || err?.message?.includes(`column \"${columnName}\"`);
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

let cabinImagesTableReady = false;
let cabinStaffedColumnReady = false;

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

async function getCabinImages(cabinId) {
  const hasTable = await ensureCabinImagesTable();
  if (!hasTable) return [];

  const result = await db.query(
    `
      SELECT image_url
      FROM public.cabin_images
      WHERE cabin_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `,
    [String(cabinId)]
  );

  return result.rows.map((r) => r.image_url);
}

async function replaceCabinImages(cabinId, imageUrls) {
  const hasTable = await ensureCabinImagesTable();
  if (!hasTable) return;

  await db.query(`DELETE FROM public.cabin_images WHERE cabin_id = $1`, [String(cabinId)]);

  if (!Array.isArray(imageUrls) || !imageUrls.length) return;

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

export async function GET(_req, { params }) {
  try {
    await ensureCabinStaffedColumn();
    // ✅ Next.js 15+: params er en Promise
    const { id } = await params;
    if (!id) return badRequest("Mangler id");

    const sqlWithStaffed = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at, COALESCE(is_staffed, false) AS is_staffed
      FROM public.cabins
      WHERE id = $1
      LIMIT 1
    `;
    const sqlWithoutStaffed = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at
      FROM public.cabins
      WHERE id = $1
      LIMIT 1
    `;

    let result;
    try {
      result = await db.query(sqlWithStaffed, [id]);
    } catch (err) {
      if (!isMissingColumn(err, "is_staffed")) throw err;
      const fallback = await db.query(sqlWithoutStaffed, [id]);
      result = {
        ...fallback,
        rows: fallback.rows.map((cabin) => ({ ...cabin, is_staffed: false })),
      };
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    const cabin = result.rows[0];
    const image_urls = await getCabinImages(cabin.id);
    return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await ensureCabinStaffedColumn();
    const { id } = await params;
    if (!id) return badRequest("Mangler id");

    const { user, response } = await requireAuth();
    if (response) return response;

    const roleError = requireRole(user, [ROLE_UTLEIER, ROLE_ADMIN]);
    if (roleError) return roleError;

    // Sørg for at utleier kun kan endre egne hytter (hvis det finnes en owner_id-kolonne)
    let cabinOwnerId = null;
    try {
      const cabinRes = await db.query(
        `SELECT owner_id FROM public.cabins WHERE id = $1 LIMIT 1`,
        [id]
      );

      if (cabinRes.rowCount === 0) {
        return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
      }

      cabinOwnerId = cabinRes.rows[0]?.owner_id;
    } catch (err) {
      // Hvis owner_id-kolonnen ikke finnes, kan vi ikke sjekke eierskap.
      // La flyte gjennom slik at eksisterende funksjonalitet ikke bryter.
      if (err?.code !== "42703" && !err?.message?.includes("owner_id")) {
        throw err;
      }
    }

    if (user.role === ROLE_UTLEIER) {
      // UTLEIER can only edit their own cabins
      if (!cabinOwnerId || String(cabinOwnerId) !== String(user.id)) {
        return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
      }
    }

    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const location = String(body.location ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;

    const price_per_night = Number(body.price_per_night);
    const capacity = Number(body.capacity);
    const is_staffed = Boolean(body.is_staffed);

    if (!name) return badRequest("name er påkrevd");
    if (!location) return badRequest("location er påkrevd");
    if (!Number.isFinite(price_per_night)) return badRequest("price_per_night må være et tall");
    if (!Number.isFinite(capacity)) return badRequest("capacity må være et tall");

    const amenities = Array.isArray(body.amenities)
      ? body.amenities.map((x) => String(x).trim()).filter(Boolean)
      : null; // tabellen tillater NULL
    const image_urls = Array.isArray(body.image_urls)
      ? body.image_urls.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const sqlWithStaffed = `
      UPDATE public.cabins
      SET name = $1,
          description = $2,
          location = $3,
          price_per_night = $4,
          capacity = $5,
          amenities = $6,
          is_staffed = $7
      WHERE id = $8
      RETURNING id, name, description, location, price_per_night, capacity, amenities, created_at, is_staffed
    `;

    const valuesWithStaffed = [name, description, location, price_per_night, capacity, amenities, is_staffed, id];

    let result;
    try {
      result = await db.query(sqlWithStaffed, valuesWithStaffed);
    } catch (err) {
      if (!isMissingColumn(err, "is_staffed")) throw err;

      const sqlWithoutStaffed = `
        UPDATE public.cabins
        SET name = $1,
            description = $2,
            location = $3,
            price_per_night = $4,
            capacity = $5,
            amenities = $6
        WHERE id = $7
        RETURNING id, name, description, location, price_per_night, capacity, amenities, created_at, false AS is_staffed
      `;

      const valuesWithoutStaffed = [name, description, location, price_per_night, capacity, amenities, id];
      result = await db.query(sqlWithoutStaffed, valuesWithoutStaffed);
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    const cabin = result.rows[0];
    await replaceCabinImages(cabin.id, image_urls);
    return NextResponse.json({ cabin: { ...cabin, image_urls } }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    if (!id) return badRequest("Mangler id");

    const { user, response } = await requireAuth();
    if (response) return response;

    const roleError = requireRole(user, [ROLE_UTLEIER, ROLE_ADMIN]);
    if (roleError) return roleError;

    // Sørg for at utleier kun kan slette egne hytter (hvis owner_id finnes)
    let cabinOwnerId = null;
    try {
      const cabinRes = await db.query(
        `SELECT owner_id FROM public.cabins WHERE id = $1 LIMIT 1`,
        [id]
      );

      if (cabinRes.rowCount === 0) {
        return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
      }

      cabinOwnerId = cabinRes.rows[0]?.owner_id;
    } catch (err) {
      // Hvis owner_id-kolonnen ikke finnes, kan vi ikke sjekke eierskap.
      // Fortsett for å unngå å bryte funksjonalitet.
      if (err?.code !== "42703" && !err?.message?.includes("owner_id")) {
        throw err;
      }
    }

    if (user.role === ROLE_UTLEIER) {
      // UTLEIER can only delete their own cabins
      if (!cabinOwnerId || String(cabinOwnerId) !== String(user.id)) {
        return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
      }
    }

    const hasImagesTable = await ensureCabinImagesTable();
    if (hasImagesTable) {
      await db.query(`DELETE FROM public.cabin_images WHERE cabin_id = $1`, [String(id)]);
    }

    const sql = `
      DELETE FROM public.cabins
      WHERE id = $1
      RETURNING id
    `;
    const result = await db.query(sql, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
