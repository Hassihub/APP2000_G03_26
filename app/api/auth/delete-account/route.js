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

export async function POST() {
  try {
    const sid = cookies().get(COOKIE_NAME)?.value;
    if (!sid) return noStoreJson({ error: "Ikke innlogget" }, 401);

    const sessRes = await pool.query(
      `SELECT sess, expire FROM public."session" WHERE sid = $1`,
      [sid]
    );
    if (sessRes.rowCount === 0) return noStoreJson({ error: "Ikke innlogget" }, 401);

    const row = sessRes.rows[0];
    if (new Date(row.expire).getTime() <= Date.now()) {
      await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);
      return noStoreJson({ error: "Ikke innlogget" }, 401);
    }

    const userId = row.sess?.userId;
    if (!userId) return noStoreJson({ error: "Ugyldig session" }, 401);

    // Slett session først
    await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);

    // Slett brukeren
    await pool.query(`DELETE FROM public.users WHERE id = $1`, [userId]);

    // Slett cookie i nettleser
    const res = noStoreJson({ ok: true }, 200);
    res.cookies.set({
      name: COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return res;
  } catch (err) {
    console.error("delete-account error:", err);
    return noStoreJson({ error: "Kunne ikke slette profil" }, 500);
  }
}