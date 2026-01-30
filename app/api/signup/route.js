import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Database-tilkobling
const pool = new Pool({
  connectionString: process.env.COCKROACH_URL,
});

export async function POST(req) {
  try {
    // Next.js App Router → riktig måte å lese body på
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Alle felt må fylles ut" },
        { status: 400 }
      );
    }

    // Hash passord
    const hashedPassword = await bcrypt.hash(password, 10);

    // Lag bruker (UTEN avatar foreløpig)
    const query = `
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `;

    const values = [username, email, hashedPassword];

    const result = await pool.query(query, values);

    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Kunne ikke registrere bruker" },
      { status: 500 }
    );
  }
}
