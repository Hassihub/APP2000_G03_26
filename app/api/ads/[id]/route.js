import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Hent enkelt annonse
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

    const result = await pool.query(
      `SELECT 
        a.id, a.title, a.description, a.category_id, a.image_url, a.image_approved,
        a.placement, a.pricing_model, a.cost_per_click, a.cost_per_thousand_impressions,
        a.start_date, a.end_date, a.daily_budget, a.status, a.approval_status,
        a.rejection_reason, a.advertiser_id, a.created_at, a.updated_at,
        c.name as category_name,
        COALESCE(SUM(aa.impressions), 0)::int as total_impressions,
        COALESCE(SUM(aa.clicks), 0)::int as total_clicks,
        COALESCE(SUM(aa.spent), 0)::numeric as total_spent
      FROM advertisements a
      LEFT JOIN ad_categories c ON a.category_id = c.id
      LEFT JOIN ad_analytics aa ON a.id = aa.ad_id
      WHERE a.id = $1
      GROUP BY a.id, c.name`,
      [id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { error: "Annonse ikke funnet" },
        { status: 404 }
      );
    }

    const ad = result.rows[0];

    // Sjekk tilgang (bare annonsør eller admin kan se)
    const advertiserResult = await pool.query(
      "SELECT user_id FROM advertisers WHERE id = $1",
      [ad.advertiser_id]
    );

    if (advertiserResult.rows[0].user_id !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
      return Response.json(
        { error: "Du har ikke tilgang til denne annonsen" },
        { status: 403 }
      );
    }

    return Response.json(ad, { status: 200 });
  } catch (error) {
    console.error("Get ad error:", error);
    return Response.json(
      { error: "Kunne ikke hente annonse" },
      { status: 500 }
    );
  }
}

// Rediger annonse (kun draft/rejected status)
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adResult = await pool.query(
      `SELECT advertiser_id, status FROM advertisements WHERE id = $1`,
      [id]
    );

    if (adResult.rows.length === 0) {
      return Response.json(
        { error: "Annonse ikke funnet" },
        { status: 404 }
      );
    }

    // Sjekk tilgang
    const advertiserResult = await pool.query(
      "SELECT user_id FROM advertisers WHERE id = $1",
      [adResult.rows[0].advertiser_id]
    );

    if (advertiserResult.rows[0].user_id !== session.user.id) {
      return Response.json(
        { error: "Du har ikke tilgang til denne annonsen" },
        { status: 403 }
      );
    }

    // Kan bare redigere draft eller rejected annonser
    if (!["draft", "rejected"].includes(adResult.rows[0].status)) {
      return Response.json(
        { error: "Kan bare redigere draft eller avviste annonser" },
        { status: 400 }
      );
    }

    const data = await req.json();
    const allowedFields = [
      "title", "description", "category_id", "target_url", "placement",
      "pricing_model", "cost_per_click", "cost_per_thousand_impressions",
      "start_date", "end_date", "daily_budget"
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (field in data) {
        updates[field] = data[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "Ingen felt for oppdatering" },
        { status: 400 }
      );
    }

    const setClauses = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");
    const values = Object.values(updates);

    const result = await pool.query(
      `UPDATE advertisements 
       SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length + 1}
       RETURNING id, title, status, approval_status, updated_at`,
      [...values, id]
    );

    return Response.json(
      { message: "Annonse oppdatert", ad: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update ad error:", error);
    return Response.json(
      { error: "Kunne ikke oppdatere annonse" },
      { status: 500 }
    );
  }
}

// Slett annonse (kun draft)
export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adResult = await pool.query(
      `SELECT advertiser_id, status FROM advertisements WHERE id = $1`,
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

    if (advertiserResult.rows[0].user_id !== session.user.id) {
      return Response.json(
        { error: "Du har ikke tilgang til denne annonsen" },
        { status: 403 }
      );
    }

    if (adResult.rows[0].status !== "draft") {
      return Response.json(
        { error: "Kan bare slette draft-annonser" },
        { status: 400 }
      );
    }

    await pool.query(
      "DELETE FROM advertisements WHERE id = $1",
      [id]
    );

    return Response.json(
      { message: "Annonse slettet" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete ad error:", error);
    return Response.json(
      { error: "Kunne ikke slette annonse" },
      { status: 500 }
    );
  }
}
