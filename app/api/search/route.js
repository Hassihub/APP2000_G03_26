export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query " }, { status: 400 });
  }

  try {
    // Bruk openStreetMap Nominatim (gratis geocoding)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      {
        hearders: {
          "User-Agent": "appfrittfram/1.0 (chhjort@proton.me)",
        },
      },
    );
    const data = await response.json();

    // Format resultatene
    const locations = data.map((loc) => ({
      name: loc.display_name,
      lat: parseFloat(loc.lat).toFixed(4),
      lon: parseFloat(loc.lon).toFixed(4),
      type: loc.type,
    }));
    return Response.json(locations);
  } catch (error) {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
