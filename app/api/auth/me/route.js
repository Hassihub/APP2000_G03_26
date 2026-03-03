export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../lib/db";

const COOKIE_NAME = "sid";

function noStoreJson(body, status) {
  const res = NextResponse.json(body, { status });

  // Hard "never cache" (browser + proxies)
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  // Ekstra: hindrer enkelte mellomledd fra å cache på feil brukere
  res.headers.set("Vary", "Cookie");

  return res;
}

export async function GET() {
  try {
    const sid = cookies().get(COOKIE_NAME)?.value;
    if (!sid) {
      return noStoreJson({ error: "Ikke innlogget" }, 401);
    }

    // Finn session (må ikke være utløpt)
    const sessRes = await pool.query(
      `SELECT sess, expire
       FROM public."session"
       WHERE sid = $1`,
      [sid]
    );

    if (sessRes.rowCount === 0) {
      return noStoreJson({ error: "Ikke innlogget" }, 401);
    }

    const sessionRow = sessRes.rows[0];

    // Hvis utløpt: rydd opp og gi 401
    if (new Date(sessionRow.expire).getTime() <= Date.now()) {
      await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);
      return noStoreJson({ error: "Ikke innlogget" }, 401);
    }

    const userId = sessionRow.sess?.userId;
    if (!userId) {
      return noStoreJson({ error: "Ugyldig session" }, 401);
    }

    // Hent trygge felter for user
    const userRes = await pool.query(
      `SELECT id, username, email, role, avatar, created_at
       FROM public.users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      return noStoreJson({ error: "Bruker finnes ikke" }, 401);
    }

    return noStoreJson({ user: userRes.rows[0] }, 200);
  } catch (err) {
    console.error("Me error:", err);
    return noStoreJson({ error: "Kunne ikke hente bruker" }, 500);
  }
}