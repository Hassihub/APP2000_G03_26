import { NextResponse } from "next/server";
import db from "../../../lib/db";

// Auto-create table on first use
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.ads (
      id        SERIAL PRIMARY KEY,
      title     TEXT        NOT NULL,
      description TEXT,
      price     TEXT,
      category  TEXT        NOT NULL DEFAULT 'Annet',
      location  TEXT,
      contact   TEXT,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await db.query(
      `SELECT id, title, description, price, category, location, contact, image_url, created_at
       FROM public.ads
       ORDER BY created_at DESC`
    );
    return NextResponse.json({ ads: result.rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureTable();
    const body = await req.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Tittel er påkrevd" }, { status: 400 });
    }

    const ALLOWED_CATEGORIES = ["Utstyr", "Overnatting", "Guiding", "Kurs", "Annet"];
    const category = ALLOWED_CATEGORIES.includes(body.category) ? body.category : "Annet";

    const description = body.description ? String(body.description).trim() : null;
    const price = body.price ? String(body.price).trim() : null;
    const location = body.location ? String(body.location).trim() : null;
    const contact = body.contact ? String(body.contact).trim() : null;
    const image_url = body.image_url ? String(body.image_url).trim() : null;

    const result = await db.query(
      `INSERT INTO public.ads (title, description, price, category, location, contact, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, description, price, category, location, contact, image_url, created_at`,
      [title, description, price, category, location, contact, image_url]
    );

    return NextResponse.json({ ad: result.rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
