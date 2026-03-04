import pool from "../../../../lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT 
        p.postid,
        p.caption,
        p.timestamp,
        COUNT(l.likeid) AS likes
      FROM posts p
      LEFT JOIN post_liked l
        ON p.postid = l.postid
      GROUP BY p.postid
      ORDER BY p.timestamp DESC
    `);

    return Response.json(rows);
  } catch (err) {
    console.error(err);
    return new Response("DB error", { status: 500 });
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