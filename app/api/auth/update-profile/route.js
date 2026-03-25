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

    const { username } = await req.json();
    const cleanUsername = String(username ?? "").trim();

    if (!cleanUsername) {
      return noStoreJson({ error: "Brukernavn kan ikke være tomt" }, 400);
    }
    if (cleanUsername.length > 50) {
      return noStoreJson({ error: "Brukernavn er for langt (maks 50)" }, 400);
    }

    const result = await pool.query(
      `UPDATE public.users
       SET username = $1
       WHERE id = $2
       RETURNING id, username, email, role, avatar, created_at`,
      [cleanUsername, userId]
    );

    return noStoreJson({ user: result.rows[0] }, 200);
  } catch (err) {
    console.error("update-profile error:", err);
    return noStoreJson({ error: "Kunne ikke oppdatere profil" }, 500);
  }
}