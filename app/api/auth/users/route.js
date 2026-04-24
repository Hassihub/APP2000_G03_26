/**
 * app/api/auth/users/route.js
 *
 * Author: Hasnain Malik
 *
 * Admin-endepunkt for å hente en liste over alle registrerte brukere.
 * GET /api/auth/users
 *
 * Kun tilgjengelig for brukere med ADMIN-rollen.
 * Returnerer id, brukernavn, e-post, rolle og opprettelsesdato – aldri passord.
 */

import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../lib/roles";

/**
 * GET /api/auth/users
 * Returnerer alle brukere sortert etter opprettelsesdato (nyeste først).
 * Krever innlogget ADMIN-bruker.
 */
export async function GET() {
  // Verifiser at forespørselen kommer fra en innlogget bruker
  const { user, response } = await requireAuth();
  if (response) return response; // 401 hvis ikke innlogget

  // Verifiser at brukeren har ADMIN-rollen
  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError; // 403 hvis feil rolle

  // Hent alle brukere – passordet er bevisst ekskludert fra SELECT
  const { rows } = await pool.query(
    `SELECT id, username, email, role, created_at
     FROM public.users
     ORDER BY created_at DESC`
  );

  return NextResponse.json({ users: rows }, { status: 200 });
}
