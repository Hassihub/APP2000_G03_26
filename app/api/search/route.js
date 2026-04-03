import { NextResponse } from "next/server";
import db from "../../../lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json({ cabins: [], trips: [], query: "" }, { status: 200 });
  }

  try {
    const containsTerm = `%${query}%`;
    const startsWithTerm = `${query}%`;

    const cabinResult = await db.query(
      `
        SELECT id, name, description, location, price_per_night, capacity, amenities, created_at
        FROM public.cabins
        WHERE name ILIKE $1
           OR COALESCE(description, '') ILIKE $1
           OR location ILIKE $1
           OR COALESCE(amenities::text, '') ILIKE $1
        ORDER BY
          CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 30
      `,
      [containsTerm, startsWithTerm]
    );

    const tripResult = await db.query(
      `
        SELECT id, navn, beskrivelse, lengde_km, type, vanskelighetsgrad, opprettet
        FROM public.trips
        WHERE navn ILIKE $1
           OR COALESCE(beskrivelse, '') ILIKE $1
           OR type ILIKE $1
           OR vanskelighetsgrad ILIKE $1
        ORDER BY
          CASE WHEN navn ILIKE $2 THEN 0 ELSE 1 END,
          opprettet DESC NULLS LAST,
          id DESC
        LIMIT 30
      `,
      [containsTerm, startsWithTerm]
    );

    return NextResponse.json(
      {
        cabins: cabinResult.rows,
        trips: tripResult.rows,
        query,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Search failed" },
      { status: 500 }
    );
  }
}
