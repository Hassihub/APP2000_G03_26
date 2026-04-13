import pool from "../../../../lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      commentid   SERIAL PRIMARY KEY,
      postid      INT    NOT NULL,
      userid      INT    NOT NULL,
      content     TEXT   NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const postid = searchParams.get("postid");

    if (!postid) {
      return Response.json({ error: "Mangler postid" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT c.commentid, c.postid, c.userid, c.content, c.created_at,
              u.username
       FROM post_comments c
       LEFT JOIN users u ON c.userid = u.id
       WHERE c.postid = $1
       ORDER BY c.created_at ASC`,
      [postid]
    );

    return Response.json(rows);
  } catch (err) {
    console.error("Comments GET error:", err);
    return new Response("DB error", { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureTable();
    const { postid, userid, content } = await req.json();

    if (!postid || !userid || !String(content || "").trim()) {
      return Response.json({ error: "Mangler postid, userid eller innhold" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO post_comments (postid, userid, content)
       VALUES ($1, $2, $3)
       RETURNING commentid, postid, userid, content, created_at`,
      [postid, userid, String(content).trim()]
    );

    // Fetch username to return with comment
    const userRow = await pool.query(`SELECT username FROM users WHERE id = $1`, [userid]);
    const username = userRow.rows[0]?.username ?? "Anonym";

    return Response.json({ ...rows[0], username });
  } catch (err) {
    console.error("Comments POST error:", err);
    return new Response("DB error", { status: 500 });
  }
}
