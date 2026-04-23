import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Get summary analytics for advertiser
export async function GET(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get advertiser
    const advertiserResult = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1",
      [session.user.id]
    );

    if (advertiserResult.rows.length === 0) {
      return Response.json(
        { error: "Annonsør-profil ikke funnet" },
        { status: 404 }
      );
    }

    const advertiserId = advertiserResult.rows[0].id;

    // Get all ads with analytics
    const adsResult = await pool.query(
      `SELECT 
        a.id, a.title, a.status,
        COALESCE(SUM(aa.impressions), 0)::int as impressions,
        COALESCE(SUM(aa.clicks), 0)::int as clicks,
        COALESCE(SUM(aa.spent), 0)::numeric as spent
      FROM advertisements a
      LEFT JOIN ad_analytics aa ON a.id = aa.ad_id
      WHERE a.advertiser_id = $1
      GROUP BY a.id, a.title, a.status
      ORDER BY a.id DESC`,
      [advertiserId]
    );

    // Get overall summary
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT a.id)::int as total_ads,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END)::int as active_ads,
        COALESCE(SUM(aa.impressions), 0)::bigint as total_impressions,
        COALESCE(SUM(aa.clicks), 0)::bigint as total_clicks,
        COALESCE(SUM(aa.spent), 0)::numeric as total_spent
      FROM advertisements a
      LEFT JOIN ad_analytics aa ON a.id = aa.ad_id
      WHERE a.advertiser_id = $1`,
      [advertiserId]
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
        ads: adsResult.rows,
        summary: {
          ...summary,
          ctr: parseFloat(ctr),
          cpc: parseFloat(cpc),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get summary analytics error:", error);
    return Response.json(
      { error: "Kunne ikke hente samlet statistikk" },
      { status: 500 }
    );
  }
}
