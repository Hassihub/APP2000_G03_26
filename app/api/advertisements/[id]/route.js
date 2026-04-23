import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/advertisements/[id]
export async function GET(request, { params }) {
  try {
    const result = await pool.query(
      `SELECT a.*, adv.company_name 
       FROM advertisements a
       JOIN advertisers adv ON a.advertiser_id = adv.id
       WHERE a.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error fetching advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/advertisements/[id]
export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const ad = await pool.query(
      `SELECT a.*, adv.user_id 
       FROM advertisements a
       JOIN advertisers adv ON a.advertiser_id = adv.id
       WHERE a.id = $1`,
      [params.id]
    );

    if (ad.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (ad.rows[0].user_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "You don't have permission to edit this ad" },
        { status: 403 }
      );
    }

    // Can only edit if pending
    if (ad.rows[0].status !== "pending") {
      return NextResponse.json(
        { error: "Can only edit pending advertisements" },
        { status: 400 }
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

    const result = await pool.query(
      `UPDATE advertisements
       SET title = $1, description = $2, image_url = $3, url = $4,
           categories = $5, keywords = $6, pricing_model = $7,
           cost_per_click = $8, cost_per_thousand_impressions = $9,
           placement = $10, start_date = $11, end_date = $12, updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
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
        params.id,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error updating advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/advertisements/[id]
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const ad = await pool.query(
      `SELECT a.*, adv.user_id 
       FROM advertisements a
       JOIN advertisers adv ON a.advertiser_id = adv.id
       WHERE a.id = $1`,
      [params.id]
    );

    if (ad.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (ad.rows[0].user_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "You don't have permission to delete this ad" },
        { status: 403 }
      );
    }

    // Can only delete if pending
    if (ad.rows[0].status !== "pending") {
      return NextResponse.json(
        { error: "Can only delete pending advertisements" },
        { status: 400 }
      );
    }

    await pool.query("DELETE FROM advertisements WHERE id = $1", [params.id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting advertisement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
