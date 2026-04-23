import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

// Submit for godkjenning
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const action = req.nextUrl.searchParams.get("action");
    const session = await getSession(req);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adResult = await pool.query(
      `SELECT advertiser_id, status, image_url FROM advertisements WHERE id = $1`,
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

    if (action === "submit") {
      // Submit for godkjenning
      if (adResult.rows[0].status !== "draft") {
        return Response.json(
          { error: "Kun draft-annonser kan sendes til godkjenning" },
          { status: 400 }
        );
      }

      if (!adResult.rows[0].image_url) {
        return Response.json(
          { error: "Annonse må ha bilde for å sendes til godkjenning" },
          { status: 400 }
        );
      }

      const result = await pool.query(
        `UPDATE advertisements 
         SET status = 'pending_approval', approval_status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, status, approval_status, updated_at`,
        [id]
      );

      return Response.json(
        { message: "Annonse sendt til godkjenning", ad: result.rows[0] },
        { status: 200 }
      );
    } else if (action === "pause") {
      // Pause aktivt annonse
      if (adResult.rows[0].status !== "active") {
        return Response.json(
          { error: "Bare aktive annonser kan pauseres" },
          { status: 400 }
        );
      }

      const result = await pool.query(
        `UPDATE advertisements 
         SET status = 'paused', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return Response.json(
        { message: "Annonse pauset", ad: result.rows[0] },
        { status: 200 }
      );
    } else if (action === "resume") {
      // Gjenoppta pauset annonse
      if (adResult.rows[0].status !== "paused") {
        return Response.json(
          { error: "Bare pausete annonser kan gjenoptas" },
          { status: 400 }
        );
      }

      const result = await pool.query(
        `UPDATE advertisements 
         SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, status, updated_at`,
        [id]
      );

      return Response.json(
        { message: "Annonse gjengopptat", ad: result.rows[0] },
        { status: 200 }
      );
    } else {
      return Response.json(
        { error: "Ukjent action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Ad action error:", error);
    return Response.json(
      { error: "Kunne ikke utføre handling" },
      { status: 500 }
    );
  }
}
