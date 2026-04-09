import pool from "../../../../lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { postid, userid } = body;

    if (!postid || !userid) {
      return Response.json(
        { error: "Mangler postid eller userid" },
        { status: 400 }
      );
    }

    const existing = await pool.query(
      `SELECT * FROM post_liked WHERE postid = $1 AND userid = $2`,
      [postid, userid]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM post_liked WHERE postid = $1 AND userid = $2`,
        [postid, userid]
      );

      return Response.json({ success: true, liked: false });
    } else {
      await pool.query(
        `INSERT INTO post_liked (postid, userid)
         VALUES ($1, $2)`,
        [postid, userid]
      );

      return Response.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error(err)
    return new Response("Like failed", { status: 500 })
  }
}