export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return Response.json({ error: "Missing lat/lon" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "APP2000-WeatherApp/1.0 (student@usn.no)",
        },
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      throw new Error(`YR API error: ${response.status}`);
    }

    const data = await response.json();

    // Format til enklere struktur
    const current = data.properties.timeseries[0];
    const details = current.data.instant.details;
    const next1h = current.data.next_1_hours;

    return Response.json({
      time: current.time,
      temperature: details.air_temperature,
      windSpeed: details.wind_speed,
      windDirection: details.wind_from_direction,
      humidity: details.relative_humidity,
      pressure: details.air_pressure_at_sea_level,
      cloudCover: details.cloud_area_fraction,
      precipitation: next1h?.details?.precipitation_amount || 0,
      symbol: next1h?.summary?.symbol_code || "unknown",
      forecast: data.properties.timeseries.slice(0, 24),
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
