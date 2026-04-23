import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function isAdmin(user) {
  if (!user) return false;
  return user.role === "admin" || user.role === "editor";
}

// GET /api/admin/advertisements/pending
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdmin(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await pool.query(
      `SELECT a.*, adv.company_name, adv.user_id, u.email
       FROM advertisements a
       JOIN advertisers adv ON a.advertiser_id = adv.id
       JOIN users u ON adv.user_id = u.id
       WHERE a.status = 'pending'
       ORDER BY a.created_at DESC`
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Error fetching pending advertisements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
