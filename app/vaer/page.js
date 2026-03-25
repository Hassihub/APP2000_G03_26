"use client";

import { useState } from "react";
import { useTranslations } from "../components/LanguageProvider";

export default function VaerPage() {
  const t = useTranslations("weatherPage");
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
    const locale = t.title === "Værsøk" ? "nb-NO" : "en-GB";

    return new Date(dateStr).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>{t.title}</h1>

      <form onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.inputPlaceholder}
          style={{ padding: "10px", width: "300px" }}
        />
        <button type="submit">{t.submit}</button>
      </form>

      <div>
        {!results.length && query ? <p>{t.noResults}</p> : null}
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
            <h2>{t.now}</h2>
            <p>{t.temperature}: {weather.current.temperature}°C</p>
            <p>{t.wind}: {weather.current.windSpeed} m/s</p>
            <p>{t.humidity}: {weather.current.humidity}%</p>
            <p>{t.precipitation}: {weather.current.precipitation} mm</p>
          </div>

          {/* Ukesprogose */}
          <div>
            <h2>{t.forecast}</h2>
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
                  {t.temperature}: {day.tempMin}° / {day.tempMax}°C
                </span>
                <span>{t.wind}: {day.avgWindSpeed} m/s</span>
                <span>{t.precipitation}: {day.totalPrecipitation} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
