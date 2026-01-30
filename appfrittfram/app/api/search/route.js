export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    console.log("Searching for:", query); // Debug

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent":
            "APP2000-WeatherApp/1.0 (https://app2000-hassi-4130ae0c1fb.herokuapp.com)",
          Referer: "https://app2000-hassi-4130ae0c1fb.herokuapp.com",
        },
      },
    );

    console.log("Nominatim response status:", response.status); // Debug

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nominatim error:", errorText);

      // Returner tom array i stedet for error
      return Response.json([]);
    }

    const data = await response.json();

    console.log("Nominatim data length:", data.length); // Debug

    // Sjekk at data er et array
    if (!Array.isArray(data)) {
      console.error("Nominatim did not return array:", data);
      return Response.json([]);
    }

    const locations = data.map((loc) => ({
      name: loc.display_name,
      lat: parseFloat(loc.lat).toFixed(4),
      lon: parseFloat(loc.lon).toFixed(4),
    }));

    return Response.json(locations);
  } catch (error) {
    console.error("Search API error:", error);
    // VIKTIG: Returner tom array, ikke error object
    return Response.json([]);
  }
}
