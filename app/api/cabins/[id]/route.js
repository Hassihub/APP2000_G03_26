import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../../lib/roles";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(_req, { params }) {
  try {
    // ✅ Next.js 15+: params er en Promise
    const { id } = await params;
    if (!id) return badRequest("Mangler id");

    const sql = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, created_at
      FROM public.cabins
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(sql, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    return NextResponse.json({ cabin: result.rows[0] }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
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

    if (!name) return badRequest("name er påkrevd");
    if (!location) return badRequest("location er påkrevd");
    if (!Number.isFinite(price_per_night)) return badRequest("price_per_night må være et tall");
    if (!Number.isFinite(capacity)) return badRequest("capacity må være et tall");

    const amenities = Array.isArray(body.amenities)
      ? body.amenities.map((x) => String(x).trim()).filter(Boolean)
      : null; // tabellen tillater NULL

    const sql = `
      UPDATE public.cabins
      SET name = $1,
          description = $2,
          location = $3,
          price_per_night = $4,
          capacity = $5,
          amenities = $6
      WHERE id = $7
      RETURNING id, name, description, location, price_per_night, capacity, amenities, created_at
    `;

    const values = [name, description, location, price_per_night, capacity, amenities, id];
    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    return NextResponse.json({ cabin: result.rows[0] }, { status: 200 });
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
