/**
 * app/api/auth/users/[id]/route.js
 *
 * Author: Hasnain Malik
 *
 * Admin-endepunkt for å slette en bruker basert på ID.
 * DELETE /api/auth/users/[id]
 *
 * Kun tilgjengelig for ADMIN-brukere.
 * En administrator kan ikke slette sin egen konto via dette endepunktet
 * (bruk /api/auth/delete-account for det).
 */

import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../../lib/roles";

/**
 * DELETE /api/auth/users/[id]
 * Sletter en bruker permanent fra databasen.
 * Krever innlogget ADMIN-bruker som ikke er den samme som brukeren som slettes.
 *
 * @param {{ params: { id: string } }} context - Rute-parameter med bruker-ID
 */
export async function DELETE(_req, { params }) {
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

  // Forhindre at admin sletter sin egen konto via dette endepunktet
  if (user.id === id) {
    return NextResponse.json(
      { error: "Du kan ikke slette din egen bruker" },
      { status: 400 }
    );
  }

  // Slett brukeren – RETURNING id brukes for å oppdage om brukeren fantes
  const result = await pool.query(
    `DELETE FROM public.users WHERE id = $1 RETURNING id`,
    [id]
  );

  // rowCount === 0 betyr at ingen rad ble slettet (ukjent bruker-ID)
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Fant ikke bruker" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
