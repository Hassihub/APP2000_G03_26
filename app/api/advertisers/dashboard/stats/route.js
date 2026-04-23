import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/advertisers/dashboard/stats
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get advertiser
    const advertiserResult = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1 AND status = 'approved'",
      [user.id]
    );

    if (advertiserResult.rows.length === 0) {
      return NextResponse.json(
        { error: "No approved advertiser found" },
        { status: 404 }
      );
    }

    const advertiserId = advertiserResult.rows[0].id;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Build query for aggregated stats
    let analyticsQuery = `
      SELECT 
        COUNT(DISTINCT a.id) as total_ads,
        SUM(COALESCE(aa.impressions, 0)) as total_impressions,
        SUM(COALESCE(aa.clicks, 0)) as total_clicks,
        SUM(COALESCE(aa.cost, 0)) as total_cost,
        json_agg(json_build_object(
          'id', a.id,
          'title', a.title,
          'impressions', COALESCE(SUM(aa.impressions), 0),
          'clicks', COALESCE(SUM(aa.clicks), 0),
          'cost', COALESCE(SUM(aa.cost), 0)
        )) as ads
      FROM advertisements a
      LEFT JOIN ad_analytics aa ON a.id = aa.advertisement_id
      WHERE a.advertiser_id = $1 AND a.status = 'approved'
    `;

    const params = [advertiserId];

    if (startDate && endDate) {
      analyticsQuery += ` AND aa.date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    analyticsQuery += ` GROUP BY a.advertiser_id`;

    const result = await pool.query(analyticsQuery, params);

    const stats = result.rows[0] || {
      total_ads: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_cost: 0,
      ads: [],
    };

    const ctr = stats.total_impressions > 0
      ? ((stats.total_clicks / stats.total_impressions) * 100).toFixed(2)
      : 0;

    return NextResponse.json({
      summary: {
        total_ads: stats.total_ads || 0,
        total_impressions: stats.total_impressions || 0,
        total_clicks: stats.total_clicks || 0,
        ctr_percentage: parseFloat(ctr),
        total_cost: stats.total_cost || 0,
      },
      ads: stats.ads || [],
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
