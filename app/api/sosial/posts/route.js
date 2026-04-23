import pool from "../../../../lib/db";
import { cookies } from "next/headers";

async function getSessionUserId() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("connect.sid")?.value;

  if (!sid) return null;

  const sessionId = sid.split(".")[0].replace("s:", "");

  const sessionRes = await pool.query(
    `SELECT sess FROM session WHERE sid = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) return null;

  const session = sessionRes.rows[0].sess;
  return session.passport?.user || null;
}

export async function GET() {

  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("connect.sid")?.value;

    let currentUserId = null;
    let currentUserRole = null;

    if (sid) {
  const sessionId = sid.split(".")[0].replace("s:", "");

  const sessionRes = await pool.query(
    `SELECT sess FROM session WHERE sid = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length > 0) {
    const session = sessionRes.rows[0].sess;
    currentUserId = session.passport?.user;

    if (currentUserId) {
      const userRes = await pool.query(
        `SELECT role FROM users WHERE id = $1`,
        [currentUserId]
      );

      if (userRes.rows.length > 0) {
        currentUserRole = userRes.rows[0].role;
      }
    }
  }
}

    const { rows } = await pool.query(
      `
      SELECT 
        p.postid,
        p.userid,
        p.caption,
        p.timestamp,
        COUNT(l.likeid) AS likes,
        COALESCE(BOOL_OR(l.userid = $1), false) AS liked,
        MAX(pic.picture_url) AS image
      FROM posts p
      LEFT JOIN post_liked l ON p.postid = l.postid
      LEFT JOIN post_pictures pic ON p.postid = pic.postid
      GROUP BY p.postid, p.userid, p.caption, p.timestamp
      ORDER BY p.timestamp DESC
      `,
      [currentUserId]
    );
    const posts = rows.map(p => ({
      ...p,
      canDelete:
      currentUserId &&
      (
        String(p.userid) === String(currentUserId) ||
        currentUserRole === "ADMIN"
      )
    }));

    return Response.json(posts);
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

export async function DELETE(req) {
  try {
    const userid = await getSessionUserId();

    if (!userid) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const { postid } = await req.json();

    if (!postid) {
      return Response.json({ error: "Missing postid" }, { status: 400 });
    }

    const postRes = await pool.query(
      `
      SELECT p.userid AS ownerid, u.role
      FROM posts p
      JOIN users u ON u.id = $1
      WHERE p.postid = $2
      `,
      [userid, postid]
    );

    if (postRes.rows.length === 0) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const { ownerid, role } = postRes.rows[0];
    const isOwner = String(ownerid) === String(userid);
    const isAdmin = role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    await pool.query(`DELETE FROM post_pictures WHERE postid = $1`, [postid]);
    await pool.query(`DELETE FROM post_comments WHERE postid = $1`, [postid]);
    await pool.query(`DELETE FROM post_liked WHERE postid = $1`, [postid]);
    await pool.query(`DELETE FROM posts WHERE postid = $1`, [postid]);

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/sosial/posts failed:", err);
    return Response.json(
      { error: err.message || "Delete failed" },
      { status: 500 }
    );
  }
}