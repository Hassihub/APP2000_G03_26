import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      name,
      description,
      activity,
      difficulty,
      duration_minutes,
      geometry,
      points,
      created_by,
    } = body;

    if (!name || !activity || difficulty == null || duration_minutes == null || !geometry || !points) {
      return NextResponse.json({ error: "Manglende påkrevde felt" }, { status: 400 });
    }

    const createdByValue = created_by && created_by !== "" ? created_by : null;

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
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        name,
        description ?? null,
        activity,
        difficulty,
        duration_minutes,
        JSON.stringify(geometry),
        JSON.stringify(points),
        createdByValue,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("routes-to-verification error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
