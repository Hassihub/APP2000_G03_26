import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      company_name,
      company_registration_number,
      contact_person,
      phone,
      website,
    } = await req.json();

    if (!company_name || !contact_person) {
      return Response.json(
        { error: "company_name og contact_person er påkrevd" },
        { status: 400 }
      );
    }

    const existing = await pool.query(
      "SELECT id FROM advertisers WHERE user_id = $1",
      [user.id]
    );

    if (existing.rows.length > 0) {
      return Response.json(
        { error: "Annonsør-profil eksisterer allerede" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO advertisers (
        user_id, company_name, company_registration_number,
        contact_person, phone, website
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, company_name, approval_status, created_at`,
      [
        user.id,
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
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT id, user_id, company_name, company_registration_number,
              contact_person, phone, website, approval_status,
              rejection_reason, created_at, updated_at
       FROM advertisers WHERE user_id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: "Annonsør-profil ikke funnet" }, { status: 404 });
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
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      return Response.json({ error: "Ingen felt for oppdatering" }, { status: 400 });
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
      [...values, user.id]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: "Annonsør-profil ikke funnet" }, { status: 404 });
    }

    return Response.json(
      { message: "Annonsør-profil oppdatert", advertiser: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update advertiser error:", error);
    return Response.json(
      { error: "Kunne ikke oppdatere annonsør-profil" },
      { status: 500 }
    );
  }
}
