<<<<<<< HEAD
import pool from "../../../../lib/db"
import { cookies } from "next/headers"

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const postid = searchParams.get("postid")

    const { rows } = await pool.query(
      `
    SELECT 
    c.commentid,
    c.comment,
    c.timestamp,
    u.username
    FROM post_comments c
    JOIN users u ON c.userid = u.id
    WHERE c.postid = $1
    ORDER BY c.timestamp ASC
      `,
      [postid]
    )

    return Response.json(rows)
  } catch (err) {
    console.error(err)
    return new Response("Error fetching comments", { status: 500 })
=======
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
>>>>>>> origin/main2.69
  }
}

export async function POST(req) {
  try {
<<<<<<< HEAD
    const cookieStore = await cookies()
    const sid = cookieStore.get("connect.sid")?.value

    if (!sid) {
      return new Response("Not logged in", { status: 401 })
    }

    const sessionId = sid.split(".")[0].replace("s:", "")

    const sessionRes = await pool.query(
      `SELECT sess FROM session WHERE sid = $1`,
      [sessionId]
    )

    if (sessionRes.rows.length === 0) {
      return new Response("Session not found", { status: 401 })
    }

    const session = sessionRes.rows[0].sess
    const userid = session.passport?.user

    if (!userid) {
      return new Response("No user in session", { status: 401 })
    }

    const { postid, comment } = await req.json()

    await pool.query(
      `
      INSERT INTO post_comments (postid, comment, userid, "timestamp")
      VALUES ($1, $2, $3, NOW())
      `,
      [postid, comment, userid]
    )

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return new Response("Error posting comment", { status: 500 })
  }
}
=======
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
>>>>>>> origin/main2.69
