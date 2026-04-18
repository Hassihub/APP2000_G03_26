import pool from "../../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const { rows } = await pool.query(`
      SELECT 
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main2.69
  } catch (err) {
    console.error(err)
    return new Response("DB error", { status: 500 })
  }
}

export async function POST(req) {
  try {
<<<<<<< HEAD
    const cookieStore = await cookies()
    const sid = cookieStore.get("connect.sid")?.value

    let userid = null
=======
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
>>>>>>> origin/main2.69

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