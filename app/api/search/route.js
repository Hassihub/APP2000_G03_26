import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      {
        headers: {
          "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)",
          Accept: "application/json",
          "Accept-Language": "nb-NO,en;q=0.8",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();
    const locations = Array.isArray(data)
      ? data.map((loc) => ({
          name: loc.display_name,
          lat: Number.parseFloat(loc.lat).toFixed(4),
          lon: Number.parseFloat(loc.lon).toFixed(4),
          type: loc.type,
        }))
      : [];

    return NextResponse.json(locations);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
