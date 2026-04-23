import pool from "@/lib/db";

// Get all categories
export async function GET(req) {
  try {
    const result = await pool.query(
      `SELECT id, name, description, display_order
       FROM ad_categories
       ORDER BY display_order ASC, name ASC`,
    );

    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Get categories error:", error);
    return Response.json(
      { error: "Kunne ikke hente kategorier" },
      { status: 500 }
    );
  }
}
