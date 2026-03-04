import { NextResponse } from "next/server";

// Proxy for elevation lookup so the browser avoids CORS issues
export async function POST(request) {
  try {
    const body = await request.json();
    const { coordinates } = body || {};

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    // Bruk POST med JSON-body til Open-Elevation for å unngå "URI too long" (414)
    const locations = coordinates.map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon,
    }));

    const url = "https://api.open-elevation.com/api/v1/lookup";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    if (!res.ok) {
      console.error("Elevation provider error status:", res.status);
      return NextResponse.json(
        { error: "Elevation provider error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Elevation API route error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
