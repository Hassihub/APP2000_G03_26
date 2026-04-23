import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Get analytics for single ad
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get ad and check authorization
    const adResult = await pool.query(
      `SELECT advertiser_id FROM advertisements WHERE id = $1`,
      [id]
    );

    if (adResult.rows.length === 0) {
      return Response.json(
        { error: "Annonse ikke funnet" },
        { status: 404 }
      );
    }

    const advertiserResult = await pool.query(
      "SELECT user_id FROM advertisers WHERE id = $1",
      [adResult.rows[0].advertiser_id]
    );

    if (advertiserResult.rows[0].user_id !== session.user.id && session.user.role !== "ADMIN") {
      return Response.json(
        { error: "Du har ikke tilgang til denne statistikken" },
        { status: 403 }
      );
    }

    // Get daily analytics
    const analyticsResult = await pool.query(
      `SELECT date, impressions, clicks, spent
       FROM ad_analytics
       WHERE ad_id = $1
       ORDER BY date DESC`,
      [id]
    );

    // Get summary
    const summaryResult = await pool.query(
      `SELECT 
        COALESCE(SUM(impressions), 0)::int as total_impressions,
        COALESCE(SUM(clicks), 0)::int as total_clicks,
        COALESCE(SUM(spent), 0)::numeric as total_spent,
        MIN(date) as start_date,
        MAX(date) as end_date
      FROM ad_analytics
      WHERE ad_id = $1`,
      [id]
    );

    const summary = summaryResult.rows[0];
    const ctr = summary.total_impressions > 0 
      ? ((summary.total_clicks / summary.total_impressions) * 100).toFixed(2) 
      : 0;
    const cpc = summary.total_clicks > 0 
      ? (summary.total_spent / summary.total_clicks).toFixed(2) 
      : 0;

    return Response.json(
      {
        daily: analyticsResult.rows,
        summary: {
          ...summary,
          ctr: parseFloat(ctr),
          cpc: parseFloat(cpc),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get ad analytics error:", error);
    return Response.json(
      { error: "Kunne ikke hente statistikk" },
      { status: 500 }
    );
  }
}
