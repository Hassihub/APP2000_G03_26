import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../lib/db";

const COOKIE_NAME = "sid";

function noStoreJson(body, status) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("Vary", "Cookie");
  return res;
}

async function getUserIdFromSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(COOKIE_NAME)?.value;
  if (!sid) return null;

  const sessRes = await pool.query(
    `SELECT sess, expire FROM public."session" WHERE sid = $1`,
    [sid]
  );
  if (sessRes.rowCount === 0) return null;

  const row = sessRes.rows[0];
  if (new Date(row.expire).getTime() <= Date.now()) {
    await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);
    return null;
  }

  return row.sess?.userId ?? null;
}

export async function POST(req) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) return noStoreJson({ error: "Ikke innlogget" }, 401);

    const { name, email, phone, dob, age, bio } = await req.json();

    // Validering
    if (name && String(name).trim().length > 100) {
      return noStoreJson({ error: "Navn er for langt" }, 400);
    }
    if (email && String(email).trim().length > 100) {
      return noStoreJson({ error: "E-post er for lang" }, 400);
    }
    if (phone && String(phone).trim().length > 20) {
      return noStoreJson({ error: "Telefonnummer er for langt" }, 400);
    }
    if (bio && String(bio).trim().length > 500) {
      return noStoreJson({ error: "Bio er for lang (maks 500)" }, 400);
    }

    // Bygg UPDATE-statement dynamisk
    const updates = [];
    const values = [userId];
    let paramCount = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(String(name).trim());
      paramCount++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(String(email).trim());
      paramCount++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(String(phone).trim());
      paramCount++;
    }
    if (dob !== undefined) {
      updates.push(`dob = $${paramCount}`);
      values.push(dob ? String(dob).trim() : null);
      paramCount++;
    }
    if (age !== undefined) {
      updates.push(`age = $${paramCount}`);
      values.push(age ? parseInt(age) : null);
      paramCount++;
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(String(bio).trim());
      paramCount++;
    }

    if (updates.length === 0) {
      return noStoreJson({ error: "Ingen felter å oppdatere" }, 400);
    }

    const query = `
      UPDATE public.users
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING id, name, email, phone, dob, age, bio
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return noStoreJson({ error: "Bruker ikke funnet" }, 404);
    }

    return noStoreJson({ user: result.rows[0], message: "Profil oppdatert" }, 200);
  } catch (err) {
    console.error("update-profile error:", err);
    return noStoreJson({ error: "Kunne ikke oppdatere profil" }, 500);
  }
}