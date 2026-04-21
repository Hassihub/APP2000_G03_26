import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function POST(req) {
  const body = await req.json();

  const {
    name,
    description,
    activity,
    difficulty,
    duration_minutes,
    geometry,
    points,
    bilde_url,
    created_by
  } = body;

  if (!name || !activity || difficulty == null || duration_minutes == null || !geometry || !points) {
    return NextResponse.json({ error: "Manglende påkrevde felt" }, { status: 400 });
  }

  // 🔹 Sett createdByValue korrekt
  const createdByValue = created_by && created_by !== "" ? created_by : null;

  try {
    await pool.query(
      `
      INSERT INTO routes_to_verification (
        name,
        description,
        activity,
        difficulty,
        duration_minutes,
        geometry,
        points,
        bilde_url,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        name,
        description ?? null,
        activity,
        difficulty,
        duration_minutes,
        JSON.stringify(geometry),
        JSON.stringify(points),
        bilde_url ? String(bilde_url).trim() : null,
        createdByValue
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("routes-to-verification DB error:", err);
    return NextResponse.json(
      { error: err?.message || "DB error" },
      { status: 500 }
    );
  }
}
