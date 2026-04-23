import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/advertisements/[id]/stats
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Get advertisement details
    const adResult = await pool.query(
      `SELECT a.*, adv.user_id 
       FROM advertisements a
       JOIN advertisers adv ON a.advertiser_id = adv.id
       WHERE a.id = $1`,
      [params.id]
    );

    if (adResult.rows.length === 0) {
      return NextResponse.json({ error: "Advertisement not found" }, { status: 404 });
    }

    const ad = adResult.rows[0];

    // Check if user can view stats (owns advertiser or is admin)
    if (user && user.id !== ad.user_id && user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let analyticsQuery = `
      SELECT 
        ad.id,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(cost) as total_cost,
        SUM(revenue) as total_revenue,
        json_agg(json_build_object('date', date, 'impressions', impressions, 'clicks', clicks, 'cost', cost)) as daily_breakdown
      FROM ad_analytics ad
      WHERE ad.advertisement_id = $1
    `;

    const params = [params.id];

    if (startDate && endDate) {
      analyticsQuery += ` AND ad.date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    const statsResult = await pool.query(analyticsQuery, params);

    const stats = statsResult.rows[0] || {
      total_impressions: 0,
      total_clicks: 0,
      total_cost: 0,
      total_revenue: 0,
      daily_breakdown: [],
    };

    // Calculate CTR (Click-Through Rate) and CPC (Cost Per Click)
    const ctr = stats.total_impressions > 0 
      ? ((stats.total_clicks / stats.total_impressions) * 100).toFixed(2) 
      : 0;
    
    const cpc = stats.total_clicks > 0
      ? (stats.total_cost / stats.total_clicks).toFixed(2)
      : 0;

    return NextResponse.json({
      advertisement: {
        id: ad.id,
        title: ad.title,
        status: ad.status,
        pricing_model: ad.pricing_model,
        start_date: ad.start_date,
        end_date: ad.end_date,
      },
      statistics: {
        total_impressions: stats.total_impressions || 0,
        total_clicks: stats.total_clicks || 0,
        ctr_percentage: parseFloat(ctr),
        total_cost: stats.total_cost || 0,
        cpc: parseFloat(cpc),
        daily_breakdown: stats.daily_breakdown || [],
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching advertisement stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
