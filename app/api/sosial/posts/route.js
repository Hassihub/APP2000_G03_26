import pool from "../../../../lib/db";

import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sid = cookieStore.get("connect.sid")?.value

    let userid = null

    if (sid) {
      const sessionId = sid.split(".")[0].replace("s:", "")

      const sessionRes = await pool.query(
        `SELECT sess FROM session WHERE sid = $1`,
        [sessionId]
      )

      if (sessionRes.rows.length > 0) {
        const session = sessionRes.rows[0].sess
        userid = session.passport?.user
      }
    }

    const { rows } = await pool.query(
      `
      SELECT 
        p.postid,
        p.caption,
        p.timestamp,
        COUNT(l.likeid) AS likes,
        BOOL_OR(l.userid = $1) AS liked
      FROM posts p
      LEFT JOIN post_liked l
        ON p.postid = l.postid
      GROUP BY p.postid, p.caption, p.timestamp
      ORDER BY p.timestamp DESC
      `,
      [userid]
    )

    return Response.json(rows)
  } catch (err) {
    console.error(err)
    return new Response("DB error", { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    console.log("BODY:", body)

    const { postid, userid } = body
    await pool.query(
      `
      INSERT INTO posts (userid, tripid, caption)
      VALUES ($1, $2, $3)
      `,
      [userid, tripid, caption]
    );

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return new Response("Insert failed", { status: 500 });
  }
}