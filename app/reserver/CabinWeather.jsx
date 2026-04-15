"use client";

import { useEffect, useState } from "react";

const SYMBOL_EMOJI = {
  clearsky: "☀️",
  fair: "🌤️",
  partlycloudy: "⛅",
  cloudy: "☁️",
  fog: "🌫️",
  lightrain: "🌦️",
  rain: "🌧️",
  heavyrain: "🌧️",
  sleet: "🌨️",
  snow: "❄️",
  heavysnow: "❄️",
  thunder: "⛈️",
};

function symbolToEmoji(code) {
  if (!code) return "🌡️";
  const base = code.replace(/_day|_night|_polartwilight/g, "").replace(/_/g, "");
  for (const [key, emoji] of Object.entries(SYMBOL_EMOJI)) {
    if (base.includes(key)) return emoji;
  }
  return "🌡️";
}

const DAYS = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

export default function CabinWeather({ location }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForecast, setShowForecast] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setWeather(null);

    async function fetchWeather() {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(location)}`);
        const locations = await res.json();
        if (!locations.length) return;
        const { lat, lon } = locations[0];
        const weatherRes = await fetch(`/api/vaer?lat=${lat}&lon=${lon}`);
        const data = await weatherRes.json();
        setWeather(data);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [location]);

  if (loading) return <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Henter vær...</span>;
  if (!weather?.current) return <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ikke tilgjengelig</span>;

  const { current, daily } = weather;
  const emoji = symbolToEmoji(current.symbol);

  return (
    <div>
      {/* Current weather */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
        <span style={{ fontSize: "0.9rem", color: "var(--text)", fontWeight: 600 }}>
          {Math.round(current.temperature)}°C
        </span>
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          💨 {Math.round(current.windSpeed)} m/s
        </span>
        {current.precipitation > 0 && (
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            🌧 {current.precipitation} mm
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowForecast((v) => !v)}
          style={{
            marginLeft: "0.25rem",
            padding: "0.25rem 0.65rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-muted)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {showForecast ? "Skjul varsel" : "7-dagers varsel"}
        </button>
      </div>

      {/* 7-day forecast */}
      {showForecast && daily?.length > 0 && (
        <div style={{
          marginTop: "0.75rem",
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.4rem",
        }}>
          {daily.slice(0, 7).map((day) => {
            const date = new Date(day.date);
            const dayName = DAYS[date.getDay()];
            return (
              <div
                key={day.date}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "0.5rem 0.3rem",
                  textAlign: "center",
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{dayName}</div>
                <div style={{ fontSize: "1.1rem", margin: "0.2rem 0" }}>{symbolToEmoji(day.symbol)}</div>
                <div style={{ color: "var(--text)", fontWeight: 700 }}>{day.tempMax}°</div>
                <div style={{ color: "var(--text-muted)" }}>{day.tempMin}°</div>
                {day.totalPrecipitation > 0 && (
                  <div style={{ marginTop: "0.2rem" }}>🌧 {day.totalPrecipitation}mm</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
