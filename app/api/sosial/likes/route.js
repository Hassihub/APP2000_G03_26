import pool from "../../../../lib/db"
import { cookies } from "next/headers"

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
    console.log("SESSION:", session)

    const userid = session.passport?.user

    if (!userid) {
      return new Response("No user in session", { status: 401 })
    }

    const { postid } = await req.json()

    const existing = await pool.query(
      `SELECT * FROM post_liked WHERE postid = $1 AND userid = $2`,
      [postid, userid]
    )

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM post_liked WHERE postid = $1 AND userid = $2`,
        [postid, userid]
      )
    } else {
      await pool.query(
        `INSERT INTO post_liked (postid, userid)
         VALUES ($1, $2)`,
        [postid, userid]
      )
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return new Response("Like failed", { status: 500 })
  }
}