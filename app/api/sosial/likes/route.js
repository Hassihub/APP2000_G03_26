import pool from "../../../../lib/db"
import { cookies } from "next/headers"

// Koden er laget av Nikolai
// Denne ruten håndterer like-funksjonaliteten for sosialpostene.
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const sid = cookieStore.get("connect.sid")?.value

    if (!sid) {
      return Response.json({ error: "Not logged in" }, { status: 401 })
    }

    // Fjerner den eventuelle "s:" prefixen og alt etter første punktum
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

    // Sørg for at postid er sendt med i requesten
    if (!postid) {
      return Response.json({ error: "Missing postid" }, { status: 400 })
    }

    const existing = await pool.query(
      `SELECT 1 FROM post_liked WHERE postid = $1 AND userid = $2`,
      [postid, userid]
    )

    if (existing.rows.length > 0) {
      // Hvis posten allerede er likt, fjern like-posten for å toggles
      await pool.query(
        `DELETE FROM post_liked WHERE postid = $1 AND userid = $2`,
        [postid, userid]
      )

      return Response.json({ success: true, liked: false })
    } else {
      // Hvis posten ikke er likt, legg til en like-post i databasen
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