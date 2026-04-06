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
    <div style={{ padding: "2rem", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter','Poppins',sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#6675ff" }}>FrittFram</p>
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em" }}>{t.title}</h1>

        <form onSubmit={search} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.inputPlaceholder}
            style={{ flex: 1, padding: "0.75rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "1rem", outline: "none" }}
          />
          <button type="submit" style={{ padding: "0.75rem 1.5rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, fontWeight: 800, cursor: "pointer" }}>{t.submit}</button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {!results.length && query ? <p style={{ color: "var(--text-muted)" }}>{t.noResults}</p> : null}
          {results.map((loc, i) => (
            <div key={i} onClick={() => getWeather(loc)} style={{ cursor: "pointer", padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-panel)", color: "var(--text)", fontWeight: 600, transition: "border-color 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              {loc.name}
            </div>
          ))}
        </div>

        {weather && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Nåværende vær */}
            <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: 4, background: "var(--bg-panel)" }}>
              <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{t.now}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.75rem" }}>
                {[
                  { label: t.temperature, value: `${weather.current.temperature}°C` },
                  { label: t.wind, value: `${weather.current.windSpeed} m/s` },
                  { label: t.humidity, value: `${weather.current.humidity}%` },
                  { label: t.precipitation, value: `${weather.current.precipitation} mm` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>{label}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ukesprogose */}
            <div>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: 800 }}>{t.forecast}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {weather.daily.map((day) => (
                  <div key={day.date} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", padding: "0.85rem 1rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-panel)" }}>
                    <span style={{ minWidth: "180px", fontWeight: 700, color: "var(--text)" }}>{formatDate(day.date)}</span>
                    <span style={{ color: "var(--text-muted)" }}>{t.temperature}: {day.tempMin}° / {day.tempMax}°C</span>
                    <span style={{ color: "var(--text-muted)" }}>{t.wind}: {day.avgWindSpeed} m/s</span>
                    <span style={{ color: "var(--text-muted)" }}>{t.precipitation}: {day.totalPrecipitation} mm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
