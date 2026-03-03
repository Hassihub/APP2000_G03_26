import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const COOKIE_NAME = "sid";
const SESSION_DAYS = 7;

function makeSid() {
  // 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");

    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { error: "E-post og passord må fylles ut" },
        { status: 400 }
      );
    }

    // Hent bruker (inkl. password-hash og role)
    // NB: Hvis du har renamed password -> password_hash, bytt feltet her.
    const { rows } = await pool.query(
      `SELECT id, username, email, role, avatar, created_at, password
       FROM public.users
       WHERE email = $1`,
      [cleanEmail]
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { error: "Feil e-post eller passord" },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(cleanPassword, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Feil e-post eller passord" },
        { status: 401 }
      );
    }

    // Lag session i DB
    const sid = makeSid();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    const sess = { userId: user.id };

    await pool.query(
      `INSERT INTO public."session" (sid, sess, expire)
       VALUES ($1, $2::JSONB, $3)`,
      [sid, JSON.stringify(sess), expiresAt]
    );

    // Sett cookie + returner user (uten password)
    const res = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          created_at: user.created_at,
        },
      },
      { status: 200 }
    );

    res.cookies.set({
      name: COOKIE_NAME,
      value: sid,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Kunne ikke logge inn" }, { status: 500 });
  }
}