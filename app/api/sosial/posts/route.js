import pool from "../../../../lib/db";
import { cookies } from "next/headers";

export async function GET() {

  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("connect.sid")?.value;

    let userid = null;

    if (sid) {
      const sessionId = sid.split(".")[0].replace("s:", "");

      const sessionRes = await pool.query(
        `SELECT sess FROM session WHERE sid = $1`,
        [sessionId]
      );

      if (sessionRes.rows.length > 0) {
        const session = sessionRes.rows[0].sess;
        userid = session.passport?.user;
      }
    }

    const { rows } = await pool.query(
      `
      SELECT 
        p.postid,
        p.caption,
        p.timestamp,
        COUNT(l.likeid) AS likes,
        COALESCE(BOOL_OR(l.userid = $1), false) AS liked,
        MAX(pic.picture_url) AS image
      FROM posts p
      LEFT JOIN post_liked l ON p.postid = l.postid
      LEFT JOIN post_pictures pic ON p.postid = pic.postid
      GROUP BY p.postid, p.caption, p.timestamp
      ORDER BY p.timestamp DESC
      `,
      [userid]
    );

    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/sosial/posts failed:", err);
    return Response.json(
      { error: err.message || "DB error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("connect.sid")?.value;

    let userid = null;

    if (sid) {
      const sessionId = sid.split(".")[0].replace("s:", "");

      const sessionRes = await pool.query(
        `SELECT sess FROM session WHERE sid = $1`,
        [sessionId]
      );

      if (sessionRes.rows.length > 0) {
        const session = sessionRes.rows[0].sess;
        userid = session.passport?.user;
      }
    }

    if (!userid) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const { caption, imageUrl } = await req.json();

    if (!caption?.trim()) {
      return Response.json({ error: "Caption is required" }, { status: 400 });
    }

    const tripid = null;

    const result = await pool.query(
      `
      INSERT INTO posts (userid, tripid, caption, "timestamp")
      VALUES ($1, $2, $3, NOW())
      RETURNING postid
      `,
      [userid, tripid, caption.trim()]
    );

    const postid = result.rows[0].postid;

    if (imageUrl) {
      console.log("POST /api/sosial/posts body:", { caption, imageUrl, userid })
    //feilsøking
      await pool.query(
        `
        INSERT INTO post_pictures (postid, picture_url)
        VALUES ($1, $2)
        `,
        [postid, imageUrl]
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/sosial/posts failed:", err);
    return Response.json(
      { error: err.message || "Insert failed" },
      { status: 500 }
    );
  }
}