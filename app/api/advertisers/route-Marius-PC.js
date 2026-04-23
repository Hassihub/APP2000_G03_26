import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request) {
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

    if (!company_name || !contact_person || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if advertiser already exists for this user
    const existingAdvertiser = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1",
      [user.id]
    );

    if (existingAdvertiser.rows.length > 0) {
      return NextResponse.json(
        { error: "Advertiser already registered" },
        { status: 400 }
      );
    }

    // Create advertiser
    const result = await pool.query(
      `INSERT INTO advertisers 
       (user_id, company_name, company_description, contact_person, phone, website, payment_method, bank_account, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        user.id,
        company_name,
        company_description,
        contact_person,
        phone,
        website,
        payment_method,
        bank_account,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating advertiser:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's advertiser profile
    const result = await pool.query(
      "SELECT * FROM advertisers WHERE user_id = $1",
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ advertiser: null }, { status: 200 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error fetching advertiser:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
