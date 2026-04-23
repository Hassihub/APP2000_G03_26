import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Hent annonsør-info
    const advertiserResult = await pool.query(
      `SELECT id, company_name, approval_status FROM advertisers 
       WHERE user_id = $1`,
      [session.user.id]
    );

    if (advertiserResult.rows.length === 0) {
      return Response.json(
        { error: "Annonsør-profil ikke funnet" },
        { status: 404 }
      );
    }

    const advertiserId = advertiserResult.rows[0].id;
    const advertiser = advertiserResult.rows[0];

    // Hent alle annonser med statistikk
    const adsResult = await pool.query(
      `SELECT 
        a.id, a.title, a.status, a.approval_status, a.placement,
        a.pricing_model, a.daily_budget, a.start_date, a.end_date,
        a.created_at, a.category_id,
        COALESCE(SUM(aa.impressions), 0)::int as total_impressions,
        COALESCE(SUM(aa.clicks), 0)::int as total_clicks,
        COALESCE(SUM(aa.spent), 0)::numeric as total_spent
      FROM advertisements a
      LEFT JOIN ad_analytics aa ON a.id = aa.ad_id
      WHERE a.advertiser_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC`,
      [advertiserId]
    );

    // Hent aggregert statistikk
    const statsResult = await pool.query(
      `SELECT 
        COUNT(CASE WHEN a.status = 'active' THEN 1 END)::int as active_ads,
        COUNT(CASE WHEN a.approval_status = 'pending_approval' THEN 1 END)::int as pending_approval,
        COALESCE(SUM(aa.impressions), 0)::bigint as total_all_impressions,
        COALESCE(SUM(aa.clicks), 0)::bigint as total_all_clicks,
        COALESCE(SUM(aa.spent), 0)::numeric as total_all_spent
      FROM advertisements a
      LEFT JOIN ad_analytics aa ON a.id = aa.ad_id
      WHERE a.advertiser_id = $1`,
      [advertiserId]
    );

    return Response.json(
      {
        advertiser,
        ads: adsResult.rows,
        stats: statsResult.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    return Response.json(
      { error: "Kunne ikke hente dashboard-data" },
      { status: 500 }
    );
  }
}
