"use client";

import { useState } from "react";

export default function VaerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [weather, setWeather] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/search?q=${query}`);
    setResults(await res.json());
  };

  const getWeather = async (loc) => {
    const res = await fetch(`/api/vaer?lat=${loc.lat}&lon=${loc.lon}`);
    setWeather(await res.json());
  };

  // Formatter "2026-03-25" → "Tirsdag 25. mars"
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Værsøk</h1>

      <form onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter sted"
          style={{ padding: "10px", width: "300px" }}
        />
        <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>
          Søk
        </button>
      </form>

      <div>
        {results.map((loc, i) => (
          <div
            key={i}
            onClick={() => getWeather(loc)}
            style={{
              cursor: "pointer",
              padding: "10px",
              border: "1px solid #ccc",
              margin: "5px 0",
            }}
          >
            {loc.name}
          </div>
        ))}
      </div>

      {weather && (
        <div style={{ marginTop: "20px" }}>
          {/* Nåværende vær */}
          <div
            style={{
              padding: "20px",
              border: "2px solid blue",
              marginBottom: "20px",
            }}
          >
            <h2>Nå</h2>
            <p>Temperatur: {weather.current.temperature}°C</p>
            <p>Vind: {weather.current.windSpeed} m/s</p>
            <p>Fuktighet: {weather.current.humidity}%</p>
            <p>Nedbør (1t): {weather.current.precipitation} mm</p>
          </div>

          {/* Ukesprogose */}
          <div>
            <h2>7-dagers prognose</h2>
            {weather.daily.map((day) => (
              <div
                key={day.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px",
                  border: "1px solid #ccc",
                  margin: "5px 0",
                  borderRadius: "6px",
                }}
              >
                <span style={{ minWidth: "180px", fontWeight: "bold" }}>
                  {formatDate(day.date)}
                </span>
                <span>
                  🌡️ {day.tempMin}° / {day.tempMax}°C
                </span>
                <span>💨 {day.avgWindSpeed} m/s</span>
                <span>🌧️ {day.totalPrecipitation} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
