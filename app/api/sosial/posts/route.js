import pool from "../../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const { rows } = await pool.query(`
      SELECT 
        p.postid,
        p.caption,
        p.timestamp,
        p.userid,
        u.username,
        COUNT(DISTINCT l.likeid)    AS likes,
        COUNT(DISTINCT c.commentid) AS comment_count
      FROM posts p
      LEFT JOIN users u         ON p.userid = u.id
      LEFT JOIN post_liked l    ON p.postid = l.postid
      LEFT JOIN post_comments c ON p.postid = c.postid
      GROUP BY p.postid, u.username
      ORDER BY p.timestamp DESC
    `);

    let likedPostIds = new Set();

    if (userId) {
      const likedRows = await pool.query(
        `SELECT postid FROM post_liked WHERE userid = $1`,
        [userId]
      );
      likedPostIds = new Set(likedRows.rows.map((row) => row.postid));
    }

    return Response.json(
      rows.map((row) => ({
        ...row,
        likes: Number(row.likes) || 0,
        comment_count: Number(row.comment_count) || 0,
        likedByCurrentUser: likedPostIds.has(row.postid),
      }))
    );
  } catch (err) {
    console.error(err)
    return new Response("DB error", { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userid, caption, tripid = null } = body;

    if (!userid) {
      return Response.json({ error: "Mangler userid" }, { status: 400 });
    }

    if (!String(caption || "").trim()) {
      return Response.json({ error: "Tekst er påkrevd" }, { status: 400 });
    }

    await pool.query(
      `
      INSERT INTO posts (userid, tripid, caption)
      VALUES ($1, $2, $3)
      `,
      [userid, tripid, String(caption).trim()]
    );

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return new Response("Insert failed", { status: 500 });
  }
}