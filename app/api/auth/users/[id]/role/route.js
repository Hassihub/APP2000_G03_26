import { NextResponse } from "next/server";
import pool from "../../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../../lib/auth";
import { isValidRole, ROLE_ADMIN } from "../../../../../../lib/roles";

export async function POST(req, { params }) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Mangler bruker-ID" }, { status: 400 });
  }

  const url = new URL(req.url);
  const role = String(url.searchParams.get("role") ?? "").trim().toUpperCase();

  if (!isValidRole(role)) {
    return NextResponse.json({ error: "Ugyldig rolle" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE public.users SET role = $1 WHERE id = $2 RETURNING id, username, email, role, created_at`,
    [role, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Fant ikke bruker" }, { status: 404 });
  }

  return NextResponse.json({ user: result.rows[0] }, { status: 200 });
}
