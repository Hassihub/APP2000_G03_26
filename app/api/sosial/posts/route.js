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
      BOOL_OR(l.userid = $1) AS liked,
      MAX(pic.picture) AS picture
    FROM posts p
    LEFT JOIN post_liked l ON p.postid = l.postid
    LEFT JOIN post_pictures pic ON p.postid = pic.postid
    GROUP BY p.postid, p.caption, p.timestamp
    ORDER BY p.timestamp DESC
      `,
      [userid]
    )

    const posts = rows.map(p => {
      
  if (p.picture) {
    const base64 = p.picture.toString("base64")
    return {
      ...p,
      image: `data:image/jpeg;base64,${base64}`
    }
  }
  return p
  
})
return Response.json(posts)
  } catch (err) {
    console.error(err)
    return new Response("DB error", { status: 500 })
  }
}

export async function POST(req) {
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
    const formData = await req.formData()

    const caption = formData.get("caption")
    const file = formData.get("image")

    let imageBuffer = null

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      imageBuffer = Buffer.from(bytes)
    }
    const tripid = null

    const result = await pool.query(
  `
  INSERT INTO posts (userid, tripid, caption, "timestamp")
  VALUES ($1, $2, $3, NOW())
  RETURNING postid
  `,
  [userid, tripid, caption]
)

const postid = result.rows[0].postid

if (imageBuffer) {
  await pool.query(
    `
    INSERT INTO post_pictures (postid, picture)
    VALUES ($1, $2)
    `,
    [postid, imageBuffer]
  )
}

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return new Response("Insert failed", { status: 500 })
  }
}