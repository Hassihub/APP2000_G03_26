import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../lib/db";

const COOKIE_NAME = "sid";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(COOKIE_NAME)?.value;

    if (sid) {
      await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });

    // Slett cookie i nettleser
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
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Kunne ikke logge ut" }, { status: 500 });
  }
}