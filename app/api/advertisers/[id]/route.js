import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      company_name,
      company_description,
      contact_person,
      phone,
      website,
      payment_method,
      bank_account,
    } = await request.json();

    // Verify that the advertiser belongs to the current user
    const advertiser = await pool.query(
      "SELECT * FROM advertisers WHERE id = $1 AND user_id = $2",
      [params.id, user.id]
    );

    if (advertiser.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update advertiser
    const result = await pool.query(
      `UPDATE advertisers 
       SET company_name = $1, company_description = $2, contact_person = $3, 
           phone = $4, website = $5, payment_method = $6, bank_account = $7, updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        company_name,
        company_description,
        contact_person,
        phone,
        website,
        payment_method,
        bank_account,
        params.id,
        user.id,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error updating advertiser:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
