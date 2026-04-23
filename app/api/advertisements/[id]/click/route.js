import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Helper to get client IP
function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
}

// POST /api/advertisements/[id]/click
export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { referrer } = body;
    const ip_address = getClientIp(request);
    const user_agent = request.headers.get("user-agent") || "unknown";

    // Check if ad exists and is published
    const ad = await pool.query(
      `SELECT id, advertiser_id, pricing_model, cost_per_click FROM advertisements 
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

    const advertisement = ad.rows[0];

    // Start transaction to log click and record transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Log click
      await client.query(
        `INSERT INTO click_logs 
         (advertisement_id, ip_address, user_agent, referrer, clicked_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [params.id, ip_address, user_agent, referrer]
      );

      // Update daily analytics
      await client.query(
        `INSERT INTO ad_analytics (advertisement_id, date, impressions, clicks, cost, revenue)
         VALUES ($1, CURRENT_DATE, 0, 1, $2, 0)
         ON CONFLICT (advertisement_id, date) 
         DO UPDATE SET 
           clicks = ad_analytics.clicks + 1,
           cost = ad_analytics.cost + EXCLUDED.cost`,
        [params.id, advertisement.cost_per_click || 0]
      );

      // Update advertisement total clicks
      await client.query(
        `UPDATE advertisements SET clicks = clicks + 1 WHERE id = $1`,
        [params.id]
      );

      // If CPC, create transaction record
      if (advertisement.pricing_model === "cpc" && advertisement.cost_per_click) {
        await client.query(
          `INSERT INTO ad_transactions 
           (advertiser_id, advertisement_id, transaction_type, amount, description, transaction_date)
           VALUES ($1, $2, 'click', $3, 'Click on advertisement', NOW())`,
          [
            advertisement.advertiser_id,
            params.id,
            advertisement.cost_per_click,
          ]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error logging click:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
