import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Get pending approvals (advertisers and ads)
export async function GET(req) {
  try {
    const session = await getSession(req);

    // Sjekk at bruker er editor
    if (!session?.user?.id || session.user.role !== "EDITOR") {
      return Response.json(
        { error: "Du må være editor for å godkjenne annonser" },
        { status: 403 }
      );
    }

    // Hent ventende annonsører
    const pendingAdvertisers = await pool.query(
      `SELECT 
        'advertiser' as type,
        a.id, a.company_name, a.contact_person, a.phone, a.website,
        a.created_at, u.name as user_name, u.email
      FROM advertisers a
      JOIN users u ON a.user_id = u.id
      WHERE a.approval_status = 'pending'
      ORDER BY a.created_at ASC`,
    );

    // Hent ventende annonser
    const pendingAds = await pool.query(
      `SELECT 
        'ad' as type,
        a.id, a.title, a.description, a.status, a.approval_status,
        a.image_url, a.placement, a.pricing_model, a.created_at,
        ad.company_name, u.name as user_name, c.name as category_name
      FROM advertisements a
      JOIN advertisers ad ON a.advertiser_id = ad.id
      JOIN users u ON ad.user_id = u.id
      JOIN ad_categories c ON a.category_id = c.id
      WHERE a.approval_status = 'pending_approval'
      ORDER BY a.created_at ASC`,
    );

    return Response.json(
      {
        advertisers: pendingAdvertisers.rows,
        ads: pendingAds.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get pending approvals error:", error);
    return Response.json(
      { error: "Kunne ikke hente ventende godkjenninger" },
      { status: 500 }
    );
  }
}
