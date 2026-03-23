import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth, requireRole } from "../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../lib/roles";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const sql = `
      SELECT id, name, description, location, price_per_night, capacity, amenities, created_at, owner_id
      FROM public.cabins
      ORDER BY created_at DESC
    `;
    const result = await db.query(sql);
    return NextResponse.json({ cabins: result.rows }, { status: 200 });
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

    if (!name) return badRequest("name er påkrevd");
    if (!location) return badRequest("location er påkrevd");
    if (!Number.isFinite(price_per_night)) return badRequest("price_per_night må være et tall");
    if (!Number.isFinite(capacity)) return badRequest("capacity må være et tall");

    const amenities = Array.isArray(body.amenities)
      ? body.amenities.map((x) => String(x).trim()).filter(Boolean)
      : null; // 👈 kan være NULL i tabellen

    const insertSqlWithOwner = `
      INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, description, location, price_per_night, capacity, amenities, owner_id, created_at
    `;
    const valuesWithOwner = [name, description, location, price_per_night, capacity, amenities, user.id];

    try {
      const result = await db.query(insertSqlWithOwner, valuesWithOwner);
      return NextResponse.json({ cabin: result.rows[0] }, { status: 201 });
    } catch (err) {
      // Hvis DB ikke har owner_id-kolonne, fall tilbake til gammel insert (bakoverkompatibel)
      if (err?.code === "42703" || err?.message?.includes("column \"owner_id\"")) {
        const insertSql = `
          INSERT INTO public.cabins (name, description, location, price_per_night, capacity, amenities)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, name, description, location, price_per_night, capacity, amenities, created_at
        `;
        const values = [name, description, location, price_per_night, capacity, amenities];
        const result = await db.query(insertSql, values);
        return NextResponse.json({ cabin: result.rows[0] }, { status: 201 });
      }
      throw err;
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
