import pool from "../../../../lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_saves (
      userid   INT NOT NULL,
      postid   INT NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (userid, postid)
    )
  `);
}

// GET /api/sosial/saves?userId=X — returns array of saved postids
export async function GET(request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Mangler userId" }, { status: 400 });
    }

    const { rows } = await pool.query(
      "SELECT postid FROM post_saves WHERE userid = $1",
      [userId]
    );

    return Response.json(rows.map((r) => r.postid));
  } catch (err) {
    console.error("Saves GET error:", err);
    return new Response("DB error", { status: 500 });
  }
}

// POST { userid, postid } — toggle save/unsave
export async function POST(req) {
  try {
    await ensureTable();
    const { userid, postid } = await req.json();

    if (!userid || !postid) {
      return Response.json({ error: "Mangler userid eller postid" }, { status: 400 });
    }

    const check = await pool.query(
      "SELECT 1 FROM post_saves WHERE userid = $1 AND postid = $2",
      [userid, postid]
    );

    if (check.rowCount > 0) {
      await pool.query(
        "DELETE FROM post_saves WHERE userid = $1 AND postid = $2",
        [userid, postid]
      );
      return Response.json({ saved: false });
    } else {
      await pool.query(
        "INSERT INTO post_saves (userid, postid) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userid, postid]
      );
      return Response.json({ saved: true });
    }
  } catch (err) {
    console.error("Saves POST error:", err);
    return new Response("DB error", { status: 500 });
  }
}
