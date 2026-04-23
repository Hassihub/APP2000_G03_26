import pool from "../../../../lib/db"
import { cookies } from "next/headers"

export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const sid = cookieStore.get("connect.sid")?.value

    if (!sid) {
      return Response.json({ error: "Not logged in" }, { status: 401 })
    }

    const sessionId = sid.split(".")[0].replace("s:", "")

    const sessionRes = await pool.query(
      `SELECT sess FROM session WHERE sid = $1`,
      [sessionId]
    )

    if (sessionRes.rows.length === 0) {
      return Response.json({ error: "Session not found" }, { status: 401 })
    }

    const session = sessionRes.rows[0].sess
    const userid = session.passport?.user

    if (!userid) {
      return Response.json({ error: "No user in session" }, { status: 401 })
    }

    const { postid } = await req.json()

    if (!postid) {
      return Response.json({ error: "Missing postid" }, { status: 400 })
    }

    const existing = await pool.query(
      `SELECT 1 FROM post_liked WHERE postid = $1 AND userid = $2`,
      [postid, userid]
    )

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM post_liked WHERE postid = $1 AND userid = $2`,
        [postid, userid]
      )

      return Response.json({ success: true, liked: false })
    } else {
      await pool.query(
        `INSERT INTO post_liked (postid, userid)
         VALUES ($1, $2)`,
        [postid, userid]
      )

      return Response.json({ success: true, liked: true })
    }
  } catch (err) {
    console.error(err)
    return Response.json({ error: "Like failed" }, { status: 500 })
  }
}