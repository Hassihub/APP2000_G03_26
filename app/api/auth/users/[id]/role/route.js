/**
 * app/api/auth/users/[id]/role/route.js
 *
 * Author: Hasnain Malik
 *
 * Admin-endepunkt for å endre rollen til en bruker.
 * POST /api/auth/users/[id]/role?role=ROLLENAVN
 *
 * Kun tilgjengelig for ADMIN-brukere.
 * Ny rolle sendes som query-parameter: ?role=ADMIN, ?role=USER, osv.
 * Brukes fra admin-panelet for å promotere/degradere brukere.
 */

import { NextResponse } from "next/server";
import pool from "../../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../../lib/auth";
import { isValidRole, ROLE_ADMIN } from "../../../../../../lib/roles";

/**
 * POST /api/auth/users/[id]/role?role=ROLLENAVN
 * Oppdaterer rollen til brukeren med angitt ID.
 * Krever innlogget ADMIN-bruker.
 *
 * @param {Request} req - Next.js request-objekt (brukes for URL/query-param)
 * @param {{ params: { id: string } }} context - Rute-parameter med bruker-ID
 */
export async function POST(req, { params }) {
  // Verifiser innlogging
  const { user, response } = await requireAuth();
  if (response) return response; // 401 hvis ikke innlogget

  // Verifiser ADMIN-rolle
  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError; // 403 hvis feil rolle

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Mangler bruker-ID" }, { status: 400 });
  }

  // Hent og normaliser den nye rollen fra query-parameter ?role=...
  const url = new URL(req.url);
  const role = String(url.searchParams.get("role") ?? "").trim().toUpperCase();

  // Valider at oppgitt rolle er en av de kjente rollene i systemet
  if (!isValidRole(role)) {
    return NextResponse.json({ error: "Ugyldig rolle" }, { status: 400 });
  }

  // Oppdater rollen i databasen – RETURNING henter oppdatert brukerrad
  const result = await pool.query(
    `UPDATE public.users SET role = $1 WHERE id = $2 RETURNING id, username, email, role, created_at`,
    [role, id]
  );

  // rowCount === 0 betyr at bruker-ID ikke finnes
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Fant ikke bruker" }, { status: 404 });
  }

  return NextResponse.json({ user: result.rows[0] }, { status: 200 });
}
