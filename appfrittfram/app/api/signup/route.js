import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcrypt";

// Husk å ha miljøvariabel COCKROACH_URL satt
const pool = new Pool({ connectionString: process.env.COCKROACH_URL });

export async function POST(req) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Alle felt må fylles ut" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `;
    const values = [username, email, hashedPassword];

    const result = await pool.query(query, values);

    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke registrere bruker" }, { status: 500 });
  }
}
