import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Helper to get client IP
function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
}

// POST /api/advertisements/[id]/impression
export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { page_url } = body;
    const ip_address = getClientIp(request);
    const user_agent = request.headers.get("user-agent") || "unknown";

    // Check if ad exists and is published
    const ad = await pool.query(
      `SELECT id FROM advertisements 
       WHERE id = $1 AND is_published = true 
       AND start_date <= CURRENT_DATE 
       AND end_date >= CURRENT_DATE`,
      [params.id]
    );

    if (ad.rows.length === 0) {
      return NextResponse.json(
        { error: "Advertisement not found or not active" },
        { status: 404 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Log impression
      await client.query(
        `INSERT INTO impression_logs 
         (advertisement_id, ip_address, user_agent, page_url, viewed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [params.id, ip_address, user_agent, page_url]
      );

      // Update daily analytics
      await client.query(
        `INSERT INTO ad_analytics (advertisement_id, date, impressions, clicks, cost, revenue)
         VALUES ($1, CURRENT_DATE, 1, 0, 0, 0)
         ON CONFLICT (advertisement_id, date) 
         DO UPDATE SET impressions = ad_analytics.impressions + 1`,
        [params.id]
      );

      // Update advertisement total impressions
      await client.query(
        `UPDATE advertisements SET impressions = impressions + 1 WHERE id = $1`,
        [params.id]
      );

      await client.query("COMMIT");

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error logging impression:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
