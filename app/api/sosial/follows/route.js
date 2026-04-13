import pool from "../../../../lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id  INT NOT NULL,
      following_id INT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    )
  `);
}

// GET /api/sosial/follows?userId=X
// Returns { following: [ids], followers: [ids] }
export async function GET(request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Mangler userId" }, { status: 400 });
    }

    const [followingRes, followersRes] = await Promise.all([
      pool.query(
        `SELECT following_id AS id FROM user_follows WHERE follower_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT follower_id AS id FROM user_follows WHERE following_id = $1`,
        [userId]
      ),
    ]);

    return Response.json({
      following: followingRes.rows.map((r) => r.id),
      followers: followersRes.rows.map((r) => r.id),
    });
  } catch (err) {
    console.error("Follows GET error:", err);
    return new Response("DB error", { status: 500 });
  }
}

// POST { followerId, followingId } — toggles follow/unfollow
export async function POST(req) {
  try {
    await ensureTable();
    const { followerId, followingId } = await req.json();

    if (!followerId || !followingId) {
      return Response.json({ error: "Mangler followerId eller followingId" }, { status: 400 });
    }
    if (followerId === followingId) {
      return Response.json({ error: "Kan ikke følge deg selv" }, { status: 400 });
    }

    // Check if already following
    const check = await pool.query(
      `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    if (check.rowCount > 0) {
      // Unfollow
      await pool.query(
        `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
      );
      return Response.json({ following: false });
    } else {
      // Follow
      await pool.query(
        `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [followerId, followingId]
      );
      return Response.json({ following: true });
    }
  } catch (err) {
    console.error("Follows POST error:", err);
    return new Response("DB error", { status: 500 });
  }
}
