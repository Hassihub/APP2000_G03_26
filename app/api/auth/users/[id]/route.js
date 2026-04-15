import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth, requireRole } from "../../../../../lib/auth";
import { ROLE_ADMIN } from "../../../../../lib/roles";

export async function DELETE(req, { params }) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const roleError = requireRole(user, [ROLE_ADMIN]);
  if (roleError) return roleError;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Mangler bruker-ID" }, { status: 400 });
  }

  // Prevent admin from deleting themselves
  if (user.id === id) {
    return NextResponse.json(
      { error: "Du kan ikke slette din egen bruker" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `DELETE FROM public.users WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Fant ikke bruker" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
