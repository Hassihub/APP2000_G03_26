import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function isAdmin(user) {
  if (!user) return false;
  return user.role === "admin" || user.role === "editor";
}

// POST /api/admin/advertisements/[id]/approve
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdmin(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE advertisements 
         SET status = 'approved', is_published = true, approved_by = $1, approved_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [user.id, params.id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Advertisement not found" },
          { status: 404 }
        );
      }

      const ad = result.rows[0];

      // Create initial analytics entry for today if not exists
      await client.query(
        `INSERT INTO ad_analytics (advertisement_id, date, impressions, clicks, cost, revenue)
         VALUES ($1, CURRENT_DATE, 0, 0, 0, 0)
         ON CONFLICT (advertisement_id, date) DO NOTHING`,
        [ad.id]
      );

      await client.query("COMMIT");
      return NextResponse.json(ad, { status: 200 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error approving advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
