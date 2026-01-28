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
        <button type="submit">Søk</button>
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
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            border: "2px solid blue",
          }}
        >
          <h2>Værmelding</h2>
          <p>Temperatur: {weather.temperature}°C</p>
          <p>Vind: {weather.windSpeed} m/s</p>
          <p>Fuktighet: {weather.humidity}%</p>
        </div>
      )}
    </div>
  );
}
