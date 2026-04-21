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
    const timeseries = data.properties.timeseries;

    // --- Nåværende vær (første datapunkt) ---
    const current = timeseries[0];
    const details = current.data.instant.details;
    const next1h = current.data.next_1_hours;

    const currentWeather = {
      time: current.time,
      temperature: details.air_temperature,
      windSpeed: details.wind_speed,
      windDirection: details.wind_from_direction,
      humidity: details.relative_humidity,
      pressure: details.air_pressure_at_sea_level,
      cloudCover: details.cloud_area_fraction,
      precipitation: next1h?.details?.precipitation_amount || 0,
      symbol: next1h?.summary?.symbol_code || "unknown",
    };

    // --- Timebasert prognose (neste 48 timer) ---
    const hourlyForecast = timeseries.slice(0, 48).map((entry) => ({
      time: entry.time,
      temperature: entry.data.instant.details.air_temperature,
      windSpeed: entry.data.instant.details.wind_speed,
      symbol: entry.data.next_1_hours?.summary?.symbol_code || "unknown",
      precipitation:
        entry.data.next_1_hours?.details?.precipitation_amount || 0,
    }));

    // --- Daglig prognose (7 dager) ---
    // Grupper alle datapunkter per dato
    const byDay = {};
    for (const entry of timeseries) {
      const date = entry.time.slice(0, 10); // "YYYY-MM-DD"
      if (!byDay[date]) byDay[date] = [];
      byDay[date].push(entry);
    }

    const dailyForecast = Object.entries(byDay)
      .slice(0, 7)
      .map(([date, entries]) => {
        const temps = entries.map(
          (e) => e.data.instant.details.air_temperature,
        );
        const winds = entries.map((e) => e.data.instant.details.wind_speed);

        // Summer opp nedbør fra alle 1h-intervaller den dagen
        const totalPrecipitation = entries.reduce((sum, e) => {
          return (
            sum + (e.data.next_1_hours?.details?.precipitation_amount || 0)
          );
        }, 0);

        // Bruk midtdags-symbolet (kl. 12:00) som representativt ikon
        const noonEntry =
          entries.find((e) => e.time.includes("T12:00")) ||
          entries[Math.floor(entries.length / 2)];
        const symbol =
          noonEntry?.data.next_6_hours?.summary?.symbol_code ||
          noonEntry?.data.next_1_hours?.summary?.symbol_code ||
          "unknown";

        return {
          date,
          tempMin: Math.round(Math.min(...temps)),
          tempMax: Math.round(Math.max(...temps)),
          avgWindSpeed: Math.round(
            winds.reduce((a, b) => a + b, 0) / winds.length,
          ),
          totalPrecipitation: Math.round(totalPrecipitation * 10) / 10,
          symbol,
        };
      });

    return Response.json({
      current: currentWeather,
      hourly: hourlyForecast,
      daily: dailyForecast,
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
