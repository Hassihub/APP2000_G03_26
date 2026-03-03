import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "./db";

const COOKIE_NAME = "sid"; // du kan kalle den hva du vil
const SESSION_TTL_DAYS = 7;

function json(resBody, status = 200) {
  return NextResponse.json(resBody, { status });
}

export function createSid() {
  // 32 bytes -> 64 hex chars (trygt)
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId) {
  const sid = createSid();

  // sess kan inneholde hva som helst, men vi trenger minimum userId
  const sess = { userId };
  const expire = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO public."session" (sid, sess, expire)
     VALUES ($1, $2::JSONB, $3)`,
    [sid, JSON.stringify(sess), expire]
  );

  // Sett HttpOnly-cookie
  cookies().set({
    name: COOKIE_NAME,
    value: sid,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expire,
  });

  return sid;
}

export async function destroySession() {
  const sid = cookies().get(COOKIE_NAME)?.value;
  if (!sid) return;

  await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);

  cookies().set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession() {
  const sid = cookies().get(COOKIE_NAME)?.value;
  if (!sid) return null;

  const { rows } = await pool.query(
    `SELECT sid, sess, expire
     FROM public."session"
     WHERE sid = $1 AND expire > now()`,
    [sid]
  );

  return rows[0] ?? null;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const userId = session.sess?.userId;
  if (!userId) return null;

  const { rows } = await pool.query(
    `SELECT id, username, email, role, avatar, created_at
     FROM public.users
     WHERE id = $1`,
    [userId]
  );

  return rows[0] ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: json({ error: "Ikke innlogget" }, 401) };
  return { user, response: null };
}

export function requireRole(user, roles = []) {
  if (!user) return json({ error: "Ikke innlogget" }, 401);
  if (!roles.includes(user.role)) return json({ error: "Ingen tilgang" }, 403);
  return null;
}