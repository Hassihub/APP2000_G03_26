/**
 * lib/auth.js
 *
 * Author: Hasnain Malik
 *
 * Sesjonsbibliotek for Next.js App Router API-ruter.
 *
 * Express-serveren (server.js) bruker Passport.js og express-session,
 * men Next.js App Router-ruter kjører utenfor Express og har ikke tilgang
 * til req.user eller req.isAuthenticated(). Denne modulen løser det ved å
 * lese "sid"-cookie som Express speiler inn, og slå opp sesjonen direkte
 * i PostgreSQL-tabellen "session".
 *
 * Eksporterte funksjoner:
 *   createSid()            → Generer kryptografisk sikker sesjon-ID
 *   createSession(userId)  → Opprett ny sesjon i DB og sett cookie
 *   destroySession()       → Slett sesjon fra DB og fjern cookie
 *   getSession()           → Hent aktiv sesjon fra cookie + DB
 *   getCurrentUser()       → Hent innlogget bruker basert på sesjon
 *   requireAuth()          → Guard: returner 401 hvis ikke innlogget
 *   requireRole(user, roles) → Guard: returner 403 hvis feil rolle
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "./db";

// Navn på session-cookie som settes av Express og leses her
const COOKIE_NAME = "sid";
// Sesjoner varer 7 dager fra opprettelse
const SESSION_TTL_DAYS = 7;

/** Hjelpefunksjon for å opprette JSON-responser med valgfri statuskode. */
function json(resBody, status = 200) {
  return NextResponse.json(resBody, { status });
}

/**
 * Genererer en kryptografisk sikker sesjon-ID.
 * 32 tilfeldige bytes → 64 heksadesimale tegn.
 * Brukes som primærnøkkel i session-tabellen.
 */
export function createSid() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Oppretter en ny sesjon for en bruker i PostgreSQL og setter HttpOnly-cookie.
 *
 * @param {string|number} userId - ID-en til brukeren som logges inn
 * @returns {string} Den nye sesjon-ID-en
 */
export async function createSession(userId) {
  const sid = createSid();

  // Minimumsdata i sesjonen – bare userId er nødvendig for autentisering
  const sess = { userId };
  const expire = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Lagre sesjonen i databasen med utløpstidspunkt
  await pool.query(
    `INSERT INTO public."session" (sid, sess, expire)
     VALUES ($1, $2::JSONB, $3)`,
    [sid, JSON.stringify(sess), expire]
  );

  // Sett HttpOnly-cookie – ikke tilgjengelig fra JavaScript (XSS-beskyttelse)
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: sid,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS-only i produksjon
    sameSite: "lax",  // Beskytter mot CSRF-angrep
    path: "/",
    expires: expire,
  });

  return sid;
}

/**
 * Ødelegger den aktive sesjonen: sletter fra databasen og nullstiller cookie.
 * Cookie nullstilles ved å sette expires til Unix-epoke (fortiden).
 */
export async function destroySession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(COOKIE_NAME)?.value;
  if (!sid) return;

  // Slett sesjonsraden fra databasen
  await pool.query(`DELETE FROM public."session" WHERE sid = $1`, [sid]);

  // Nullstill cookie ved å sette utløpstid i fortiden
  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

/**
 * Leser sesjon-ID fra cookie og verifiserer mot databasen.
 * Returnerer null hvis cookie mangler eller sesjonen er utløpt.
 *
 * Spørringen sjekker expire > now() direkte i SQL for å unngå
 * utløpte sesjoner uten å måtte rydde opp manuelt.
 *
 * @returns {object|null} Sesjonsraden { sid, sess, expire } eller null
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(COOKIE_NAME)?.value;
  if (!sid) return null;

  const { rows } = await pool.query(
    `SELECT sid, sess, expire
     FROM public."session"
     WHERE sid = $1 AND expire > now()`,
    [sid]
  );

  return rows[0] ?? null;
}

/**
 * Henter den innloggede brukeren basert på aktiv sesjon.
 *
 * Støtter to sesjonsformater:
 *   1. Ny format (lib/auth.js):  sess.userId
 *   2. Gammelt format (Passport): sess.passport.user  ← bakoverkompatibilitet
 *
 * @returns {object|null} Bruker-objekt fra databasen, eller null
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  // Prøv ny format først, fall tilbake til Passport-format for eldre sesjoner
  const userId = session.sess?.userId ?? session.sess?.passport?.user;
  if (!userId) return null;

  // Hent brukerdata – ikke passord-hash (velger kun sikre kolonner)
  const { rows } = await pool.query(
    `SELECT id, username, email, role, avatar, created_at
     FROM public.users
     WHERE id = $1`,
    [userId]
  );

  return rows[0] ?? null;
}

/**
 * Autentiseringsguard for API-ruter.
 * Returnerer bruker-objekt hvis innlogget, eller 401-respons hvis ikke.
 *
 * Bruk:
 *   const { user, response } = await requireAuth();
 *   if (response) return response; // Ikke innlogget
 *
 * @returns {{ user: object, response: null } | { user: null, response: NextResponse }}
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: json({ error: "Ikke innlogget" }, 401) };
  return { user, response: null };
}

/**
 * Rollebasert autorisasjonsguard for API-ruter.
 * Returnerer null hvis brukeren har en av de tillatte rollene,
 * eller en 401/403-respons hvis ikke.
 *
 * Bruk:
 *   const roleError = requireRole(user, [ROLE_ADMIN]);
 *   if (roleError) return roleError; // Feil rolle
 *
 * @param {object} user - Bruker-objekt fra requireAuth()
 * @param {string[]} roles - Liste med tillatte roller (f.eks. ["ADMIN"])
 * @returns {null | NextResponse}
 */
export function requireRole(user, roles = []) {
  if (!user) return json({ error: "Ikke innlogget" }, 401);
  if (!roles.includes(user.role)) return json({ error: "Ingen tilgang" }, 403);
  return null;
}
