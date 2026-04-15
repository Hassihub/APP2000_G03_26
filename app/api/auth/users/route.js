import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;

  const { rows } = await pool.query(
    `SELECT id, username, email, role, created_at
     FROM public.users
     ORDER BY created_at DESC`
  );

  return NextResponse.json({ users: rows }, { status: 200 });
}
