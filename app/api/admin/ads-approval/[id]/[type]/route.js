import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Approve ad
export async function POST(req, { params }) {
  try {
    const { id, type } = params;
    const session = await getSession(req);

    // Sjekk at bruker er editor
    if (!session?.user?.id || session.user.role !== "EDITOR") {
      return Response.json(
        { error: "Du må være editor for å godkjenne" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { comment } = body;

    if (type === "advertiser") {
      // Approve advertiser
      const result = await pool.query(
        `UPDATE advertisers 
         SET approval_status = 'approved', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, company_name, approval_status`,
        [id]
      );

      if (result.rows.length === 0) {
        return Response.json(
          { error: "Annonsør ikke funnet" },
          { status: 404 }
        );
      }

      // Log approval
      await pool.query(
        `INSERT INTO approval_logs (ad_id, approved_by, approval_type, status, comment)
         VALUES (NULL, $1, 'advertiser', 'approved', $2)`,
        [session.user.id, comment || null]
      );

      return Response.json(
        { message: "Annonsør godkjent", advertiser: result.rows[0] },
        { status: 200 }
      );
    } else if (type === "ad") {
      // Approve ad
      const result = await pool.query(
        `UPDATE advertisements 
         SET approval_status = 'approved', status = 'active', 
             approved_by = $1, published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, title, status, approval_status`,
        [session.user.id, id]
      );

      if (result.rows.length === 0) {
        return Response.json(
          { error: "Annonse ikke funnet" },
          { status: 404 }
        );
      }

      // Log approval
      await pool.query(
        `INSERT INTO approval_logs (ad_id, approved_by, approval_type, status, comment)
         VALUES ($1, $2, 'content', 'approved', $3)`,
        [id, session.user.id, comment || null]
      );

      return Response.json(
        { message: "Annonse godkjent og aktivert", ad: result.rows[0] },
        { status: 200 }
      );
    } else {
      return Response.json(
        { error: "Ugyldig type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Approve error:", error);
    return Response.json(
      { error: "Kunne ikke godkjenne" },
      { status: 500 }
    );
  }
}

// Reject ad/advertiser
export async function DELETE(req, { params }) {
  try {
    const { id, type } = params;
    const session = await getSession(req);

    // Sjekk at bruker er editor
    if (!session?.user?.id || session.user.role !== "EDITOR") {
      return Response.json(
        { error: "Du må være editor for å avvise" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { comment } = body;

    if (!comment) {
      return Response.json(
        { error: "Kommentar er påkrevd ved avvisning" },
        { status: 400 }
      );
    }

    if (type === "advertiser") {
      // Reject advertiser
      const result = await pool.query(
        `UPDATE advertisers 
         SET approval_status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, company_name, approval_status`,
        [comment, id]
      );

      if (result.rows.length === 0) {
        return Response.json(
          { error: "Annonsør ikke funnet" },
          { status: 404 }
        );
      }

      return Response.json(
        { message: "Annonsør avvist", advertiser: result.rows[0] },
        { status: 200 }
      );
    } else if (type === "ad") {
      // Reject ad
      const result = await pool.query(
        `UPDATE advertisements 
         SET approval_status = 'rejected', status = 'rejected', 
             rejection_reason = $1, rejected_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, title, approval_status`,
        [comment, session.user.id, id]
      );

      if (result.rows.length === 0) {
        return Response.json(
          { error: "Annonse ikke funnet" },
          { status: 404 }
        );
      }

      // Log rejection
      await pool.query(
        `INSERT INTO approval_logs (ad_id, approved_by, approval_type, status, comment)
         VALUES ($1, $2, 'content', 'rejected', $3)`,
        [id, session.user.id, comment]
      );

      return Response.json(
        { message: "Annonse avvist", ad: result.rows[0] },
        { status: 200 }
      );
    } else {
      return Response.json(
        { error: "Ugyldig type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Reject error:", error);
    return Response.json(
      { error: "Kunne ikke avvise" },
      { status: 500 }
    );
  }
}
