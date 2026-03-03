import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
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
  const sid = cookies().get(COOKIE_NAME)?.value;
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

    const { currentPassword, newPassword } = await req.json();
    const cur = String(currentPassword ?? "");
    const next = String(newPassword ?? "");

    if (!cur || !next) {
      return noStoreJson({ error: "Fyll ut begge passordfeltene" }, 400);
    }
    if (next.length < 8) {
      return noStoreJson({ error: "Nytt passord må være minst 8 tegn" }, 400);
    }

    const userRes = await pool.query(
      `SELECT password FROM public.users WHERE id = $1`,
      [userId]
    );
    if (userRes.rowCount === 0) {
      return noStoreJson({ error: "Bruker finnes ikke" }, 401);
    }

    const ok = await bcrypt.compare(cur, userRes.rows[0].password);
    if (!ok) {
      return noStoreJson({ error: "Nåværende passord er feil" }, 400);
    }

    const hashed = await bcrypt.hash(next, 10);

    await pool.query(
      `UPDATE public.users SET password = $1 WHERE id = $2`,
      [hashed, userId]
    );

    return noStoreJson({ ok: true }, 200);
  } catch (err) {
    console.error("change-password error:", err);
    return noStoreJson({ error: "Kunne ikke endre passord" }, 500);
  }
}