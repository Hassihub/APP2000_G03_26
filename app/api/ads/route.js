import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Sjekk at bruker er godkjent annonsør
    const advertiserResult = await pool.query(
      `SELECT id, approval_status FROM advertisers 
       WHERE user_id = $1 AND approval_status = 'approved'`,
      [session.user.id]
    );

    if (advertiserResult.rows.length === 0) {
      return Response.json(
        { error: "Du må registreres som annonsør og godkjennes før du kan opprette annonser" },
        { status: 403 }
      );
    }

    const advertiserId = advertiserResult.rows[0].id;

    const {
      title,
      description,
      category_id,
      target_url,
      placement,
      pricing_model,
      cost_per_click,
      cost_per_thousand_impressions,
      start_date,
      end_date,
      daily_budget,
    } = await req.json();

    // Validering
    const errors = [];
    if (!title) errors.push("title er påkrevd");
    if (!description) errors.push("description er påkrevd");
    if (!category_id) errors.push("category_id er påkrevd");
    if (!target_url) errors.push("target_url er påkrevd");
    if (!placement) errors.push("placement er påkrevd");
    if (!pricing_model) errors.push("pricing_model er påkrevd");
    if (!start_date) errors.push("start_date er påkrevd");
    if (!end_date) errors.push("end_date er påkrevd");
    if (!daily_budget || daily_budget <= 0) errors.push("daily_budget må være større enn 0");

    if (pricing_model === "cpc" && (!cost_per_click || cost_per_click <= 0)) {
      errors.push("cost_per_click er påkrevd for CPC-modell");
    }
    if (pricing_model === "cpm" && (!cost_per_thousand_impressions || cost_per_thousand_impressions <= 0)) {
      errors.push("cost_per_thousand_impressions er påkrevd for CPM-modell");
    }

    if (errors.length > 0) {
      return Response.json(
        { error: "Valideringsfeil", details: errors },
        { status: 400 }
      );
    }

    // Sjekk kategori eksisterer
    const categoryResult = await pool.query(
      "SELECT id FROM ad_categories WHERE id = $1",
      [category_id]
    );
    if (categoryResult.rows.length === 0) {
      return Response.json(
        { error: "Kategorien finnes ikke" },
        { status: 404 }
      );
    }

    // Sjekk valid plassering
    const validPlacements = ["right-sidebar", "left-sidebar", "top-banner", "mid-banner"];
    if (!validPlacements.includes(placement)) {
      return Response.json(
        { error: "Ugyldig plassering" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO advertisements (
        advertiser_id, title, description, category_id, target_url,
        placement, pricing_model, cost_per_click, cost_per_thousand_impressions,
        start_date, end_date, daily_budget, status, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', 'pending_approval')
      RETURNING id, title, status, approval_status, created_at`,
      [
        advertiserId, title, description, category_id, target_url,
        placement, pricing_model, cost_per_click || null, cost_per_thousand_impressions || null,
        start_date, end_date, daily_budget
      ]
    );

    return Response.json(
      { message: "Annonse opprettet. Venter på godkjenning.", ad: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create ad error:", error);
    return Response.json(
      { error: "Kunne ikke opprette annonse" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const result = await pool.query(
      `SELECT 
        a.id, a.title, a.description, a.category_id, a.image_url,
        a.placement, a.pricing_model, a.cost_per_click, a.cost_per_thousand_impressions,
        a.start_date, a.end_date, a.daily_budget, a.status, a.approval_status,
        a.rejection_reason, a.created_at, a.updated_at,
        c.name as category_name
      FROM advertisements a
      LEFT JOIN ad_categories c ON a.category_id = c.id
      WHERE a.advertiser_id = $1
      ORDER BY a.created_at DESC`,
      [advertiserId]
    );

    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Get ads error:", error);
    return Response.json(
      { error: "Kunne ikke hente annonser" },
      { status: 500 }
    );
  }
}
