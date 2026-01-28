import { NextResponse } from "next/server";
import pool from "../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "alle";
    const difficulty = searchParams.get("difficulty") || "alle";

    let query = `
      SELECT id, navn, beskrivelse, lengde_km, type, vanskelighetsgrad
      FROM trips
      WHERE navn ILIKE $1
    `;
    const values = [`%${search}%`];

    if (type !== "alle") {
      query += ` AND type = $${values.length + 1}`;
      values.push(type);
    }
    if (difficulty !== "alle") {
      query += ` AND vanskelighetsgrad = $${values.length + 1}`;
      values.push(difficulty);
    }

    query += " ORDER BY id";

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Trips API error:", error);
    return NextResponse.json({ error: "Kunne ikke hente turer" }, { status: 500 });
  }
}
