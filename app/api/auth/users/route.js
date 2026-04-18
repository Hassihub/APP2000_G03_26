import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../lib/roles";

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;

    const roleError = requireRole(user, [ROLE_ADMIN]);
    if (roleError) return roleError;

  const { rows } = await pool.query(
    `SELECT id, username, email, role, created_at
     FROM public.users
     ORDER BY created_at DESC`
  );

  return NextResponse.json({ users: rows }, { status: 200 });
}
