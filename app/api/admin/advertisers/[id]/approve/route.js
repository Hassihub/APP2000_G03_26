import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function isAdmin(user) {
  if (!user) return false;
  return user.role === "admin" || user.role === "editor";
}

// POST /api/admin/advertisers/[id]/approve
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdmin(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await pool.query(
      `UPDATE advertisers 
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [user.id, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Advertiser not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error approving advertiser:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
