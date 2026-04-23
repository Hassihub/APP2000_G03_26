import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Helper to get advertiser by user
async function getAdvertiserByUser(userId) {
  const result = await pool.query(
    "SELECT * FROM advertisers WHERE user_id = $1 AND status = 'approved'",
    [userId]
  );
  return result.rows[0] || null;
}

// POST /api/advertisements - Create new advertisement
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const advertiser = await getAdvertiserByUser(user.id);
    if (!advertiser) {
      return NextResponse.json(
        { error: "You must be an approved advertiser" },
        { status: 403 }
      );
    }

    const {
      title,
      description,
      image_url,
      url,
      categories,
      keywords,
      pricing_model,
      cost_per_click,
      cost_per_thousand_impressions,
      placement,
      start_date,
      end_date,
    } = await request.json();

    if (
      !title ||
      !description ||
      !url ||
      !pricing_model ||
      !placement ||
      !start_date ||
      !end_date
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate pricing model
    if (pricing_model === "cpc" && !cost_per_click) {
      return NextResponse.json(
        { error: "cost_per_click is required for CPC model" },
        { status: 400 }
      );
    }

    if (pricing_model === "cpm" && !cost_per_thousand_impressions) {
      return NextResponse.json(
        { error: "cost_per_thousand_impressions is required for CPM model" },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO advertisements
       (advertiser_id, title, description, image_url, url, categories, keywords,
        pricing_model, cost_per_click, cost_per_thousand_impressions, placement, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        advertiser.id,
        title,
        description,
        image_url,
        url,
        categories || [],
        keywords || [],
        pricing_model,
        cost_per_click || null,
        cost_per_thousand_impressions || null,
        placement,
        start_date,
        end_date,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/advertisements - List advertisements with filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "approved";
    const placement = searchParams.get("placement");
    const category = searchParams.get("category");

    let query = `
      SELECT a.*, adv.company_name 
      FROM advertisements a
      JOIN advertisers adv ON a.advertiser_id = adv.id
      WHERE a.status = $1
      AND a.is_published = true
      AND a.start_date <= CURRENT_DATE
      AND a.end_date >= CURRENT_DATE
    `;
    const params = [status];

    if (placement) {
      query += ` AND a.placement = $${params.length + 1}`;
      params.push(placement);
    }

    if (category) {
      query += ` AND $${params.length + 1} = ANY(a.categories)`;
      params.push(category);
    }

    query += ` ORDER BY a.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Error fetching advertisements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
