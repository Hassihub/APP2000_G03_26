<<<<<<< Updated upstream
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
=======
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
>>>>>>> Stashed changes
    }

    const {
      company_name,
<<<<<<< Updated upstream
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
=======
      company_registration_number,
      contact_person,
      phone,
      website,
    } = await req.json();

    // Validering
    if (!company_name || !contact_person) {
      return Response.json(
        { error: "company_name og contact_person er påkrevd" },
>>>>>>> Stashed changes
        { status: 400 }
      );
    }

<<<<<<< Updated upstream
    // Check if advertiser already exists for this user
    const existingAdvertiser = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1",
      [user.id]
    );

    if (existingAdvertiser.rows.length > 0) {
      return NextResponse.json(
        { error: "Advertiser already registered" },
=======
    // Sjekk om annonsør allerede eksisterer
    const existing = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1",
      [session.user.id]
    );

    if (existing.rows.length > 0) {
      return Response.json(
        { error: "Annonsør-profil eksisterer allerede" },
>>>>>>> Stashed changes
        { status: 400 }
      );
    }

<<<<<<< Updated upstream
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
=======
    const result = await pool.query(
      `INSERT INTO advertisers (
        user_id, company_name, company_registration_number, 
        contact_person, phone, website
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, company_name, approval_status, created_at`,
      [
        session.user.id,
        company_name,
        company_registration_number || null,
        contact_person,
        phone || null,
        website || null,
      ]
    );

    return Response.json(
      {
        message: "Annonsør-profil opprettet. Venter på godkjenning.",
        advertiser: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Advertiser registration error:", error);
    return Response.json(
      { error: "Kunne ikke opprette annonsør-profil" },
>>>>>>> Stashed changes
      { status: 500 }
    );
  }
}

<<<<<<< Updated upstream
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
=======
export async function GET(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT id, user_id, company_name, company_registration_number, 
              contact_person, phone, website, approval_status, 
              rejection_reason, created_at, updated_at
       FROM advertisers WHERE user_id = $1`,
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { error: "Annonsør-profil ikke funnet" },
        { status: 404 }
      );
    }

    return Response.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Get advertiser error:", error);
    return Response.json(
      { error: "Kunne ikke hente annonsør-profil" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await req.json();
    const allowedFields = ["company_name", "contact_person", "phone", "website"];
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
      `UPDATE advertisers 
       SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${values.length + 1}
       RETURNING id, company_name, contact_person, phone, website, approval_status`,
      [...values, session.user.id]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { error: "Annonsør-profil ikke funnet" },
        { status: 404 }
      );
    }

    return Response.json(
      { message: "Annonsør-profil oppdatert", advertiser: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update advertiser error:", error);
    return Response.json(
      { error: "Kunne ikke oppdatere annonsør-profil" },
>>>>>>> Stashed changes
      { status: 500 }
    );
  }
}
