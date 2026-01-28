import { NextResponse } from "next/server";
import db from "../../../lib/db"; // default Pool

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const cabin_id = searchParams.get("cabin_id"); // valgfri filter
    const guest_email = searchParams.get("guest_email"); // valgfri filter

    const where = [];
    const values = [];

    if (cabin_id) {
      values.push(cabin_id);
      where.push(`cabin_id = $${values.length}`);
    }
    if (guest_email) {
      values.push(guest_email);
      where.push(`guest_email = $${values.length}`);
    }

    const sql = `
      SELECT id, cabin_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status, created_at
      FROM public.reservations
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
    `;

    const result = await db.query(sql, values);
    return NextResponse.json({ reservations: result.rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const cabin_id = String(body.cabin_id ?? "").trim();
    const guest_name = String(body.guest_name ?? "").trim();
    const guest_email = String(body.guest_email ?? "").trim();

    const start_date = String(body.start_date ?? "").trim(); // "YYYY-MM-DD"
    const end_date = String(body.end_date ?? "").trim(); // "YYYY-MM-DD"

    const guests_count = Number(body.guests_count);
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!cabin_id) return NextResponse.json({ error: "cabin_id er påkrevd" }, { status: 400 });
    if (!guest_name) return NextResponse.json({ error: "guest_name er påkrevd" }, { status: 400 });
    if (!guest_email) return NextResponse.json({ error: "guest_email er påkrevd" }, { status: 400 });
    if (!start_date) return NextResponse.json({ error: "start_date er påkrevd" }, { status: 400 });
    if (!end_date) return NextResponse.json({ error: "end_date er påkrevd" }, { status: 400 });
    if (!Number.isFinite(guests_count) || guests_count <= 0) {
      return NextResponse.json({ error: "guests_count må være et tall > 0" }, { status: 400 });
    }

    // Dobbelbooking-sjekk:
    // Overlapp hvis NOT (existing.end <= new.start OR existing.start >= new.end)
    const overlapSql = `
      SELECT 1
      FROM public.reservations
      WHERE cabin_id = $1
        AND status <> 'cancelled'
        AND NOT (end_date <= $2::date OR start_date >= $3::date)
      LIMIT 1
    `;
    const overlap = await db.query(overlapSql, [cabin_id, start_date, end_date]);

    if (overlap.rowCount > 0) {
      return NextResponse.json(
        { error: "Hytta er allerede reservert i den perioden. Velg andre datoer." },
        { status: 409 }
      );
    }

    const insertSql = `
      INSERT INTO public.reservations
        (cabin_id, guest_name, guest_email, start_date, end_date, guests_count, notes)
      VALUES
        ($1, $2, $3, $4::date, $5::date, $6, $7)
      RETURNING
        id, cabin_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status, created_at
    `;

    const values = [cabin_id, guest_name, guest_email, start_date, end_date, guests_count, notes];
    const result = await db.query(insertSql, values);

    return NextResponse.json({ reservation: result.rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
