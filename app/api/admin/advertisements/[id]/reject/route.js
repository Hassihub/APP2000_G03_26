import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function isAdmin(user) {
  if (!user) return false;
  return user.role === "admin" || user.role === "editor";
}

// POST /api/admin/advertisements/[id]/reject
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdmin(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { reason } = await request.json();

    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE advertisements 
       SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [reason, user.id, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Advertisement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error rejecting advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
