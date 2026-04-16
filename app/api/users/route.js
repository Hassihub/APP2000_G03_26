import { NextResponse } from "next/server";
import pool from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

// Public user list for authenticated social views.
export async function GET() {
  const { response } = await requireAuth();
  if (response) return response;

  const { rows } = await pool.query(
    `SELECT id, username
     FROM public.users
     ORDER BY username ASC`
  );

  return NextResponse.json(rows, { status: 200 });
}
