import { NextResponse } from "next/server";
import db from "../../../lib/db"; // default Pool
import { requireAuth } from "../../../lib/auth";

let reservationUserIdColumnReady = false;

async function ensureReservationUserIdColumn() {
  if (reservationUserIdColumnReady) return true;

  try {
    await db.query(`
      ALTER TABLE public.reservations
      ADD COLUMN IF NOT EXISTS guest_user_id TEXT
    `);
    reservationUserIdColumnReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req) {
  try {
    await ensureReservationUserIdColumn();
    const { searchParams } = new URL(req.url);
    const cabin_id = searchParams.get("cabin_id"); // valgfri filter
    const guest_email = searchParams.get("guest_email"); // valgfri filter
    const guest_user_id = searchParams.get("guest_user_id"); // valgfri filter

    const where = [];
    const values = [];

    if (cabin_id) {
      values.push(cabin_id);
      where.push(`cabin_id = $${values.length}`);
    }
    if (guest_email && guest_user_id) {
      values.push(guest_user_id);
      values.push(guest_email);
      where.push(`(guest_user_id = $${values.length - 1} OR guest_email = $${values.length})`);
    } else if (guest_user_id) {
      values.push(guest_user_id);
      where.push(`guest_user_id = $${values.length}`);
    } else if (guest_email) {
      values.push(guest_email);
      where.push(`guest_email = $${values.length}`);
    }

    const sql = `
      SELECT
        r.id,
        r.cabin_id,
        r.guest_user_id,
        r.guest_name,
        r.guest_email,
        r.start_date,
        r.end_date,
        r.guests_count,
        r.notes,
        r.status,
        r.created_at,
        c.name AS cabin_name,
        c.location AS cabin_location
      FROM public.reservations r
      LEFT JOIN public.cabins c ON c.id = r.cabin_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(sql, values);
    return NextResponse.json({ reservations: result.rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureReservationUserIdColumn();
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await req.json();

    const cabin_id = String(body.cabin_id ?? "").trim();
    const guest_name = String(body.guest_name ?? "").trim();
    const guest_email = String(body.guest_email ?? "").trim();

    const start_date = String(body.start_date ?? "").trim(); // "YYYY-MM-DD"
    const end_date = String(body.end_date ?? "").trim(); // "YYYY-MM-DD"

    const guests_count = Number(body.guests_count);
    const notes = body.notes ? String(body.notes).trim() : null;
    const guest_user_id = String(user.id ?? "").trim();

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

    const reservationName = guest_name || String(user.username ?? "").trim();
    const reservationEmail = guest_email || String(user.email ?? "").trim();

    if (!reservationName) {
      return NextResponse.json({ error: "guest_name er påkrevd" }, { status: 400 });
    }
    if (!reservationEmail) {
      return NextResponse.json({ error: "guest_email er påkrevd" }, { status: 400 });
    }
    if (!guest_user_id) {
      return NextResponse.json({ error: "Mangler bruker-ID" }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO public.reservations
        (cabin_id, guest_user_id, guest_name, guest_email, start_date, end_date, guests_count, notes)
      VALUES
        ($1, $2, $3, $4, $5::date, $6::date, $7, $8)
      RETURNING
        id, cabin_id, guest_user_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status, created_at
    `;

    const values = [cabin_id, guest_user_id, reservationName, reservationEmail, start_date, end_date, guests_count, notes];
    const result = await db.query(insertSql, values);

    return NextResponse.json({ reservation: result.rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
