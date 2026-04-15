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
  }
}

export async function POST(req) {
  try {
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