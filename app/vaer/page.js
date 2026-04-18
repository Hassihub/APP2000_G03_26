"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "../components/LanguageProvider";
import WeatherMap from "./WeatherMap";

const SYMBOL_EMOJI = {
  clearsky: "☀️", fair: "🌤️", partlycloudy: "⛅", cloudy: "☁️",
  fog: "🌫️", lightrain: "🌦️", rain: "🌧️", heavyrain: "🌧️",
  sleet: "🌨️", snow: "❄️", heavysnow: "❄️", thunder: "⛈️",
};

function symbolToEmoji(code) {
  if (!code) return "🌡️";
  const base = code.replace(/_day|_night|_polartwilight/g, "").replace(/_/g, "");
  for (const [key, emoji] of Object.entries(SYMBOL_EMOJI)) {
    if (base.includes(key)) return emoji;
  }
  return "🌡️";
}

export default function VaerPage() {
  const t = useTranslations("weatherPage");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [weather, setWeather] = useState(null);
  const [selectedName, setSelectedName] = useState("");
  const [mapLocation, setMapLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);

  // Les cookies etter hydration (ikke under SSR)
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )vaer_recent=([^;]*)/);
      if (match) setRecentSearches(JSON.parse(decodeURIComponent(match[1])));
    } catch { /* ignorer korrupt cookie */ }
  }, []);

  useEffect(() => {
    const value = encodeURIComponent(JSON.stringify(recentSearches));
    // 30 dager
    document.cookie = `vaer_recent=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, [recentSearches]);

  const search = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : data.locations || []);
  };

  const getWeather = async (loc) => {
    const res = await fetch(`/api/vaer?lat=${loc.lat}&lon=${loc.lon}`);
    setWeather(await res.json());
    if (loc.name) {
      setSelectedName(loc.name);
      setRecentSearches((prev) => {
        const filtered = prev.filter((r) => r.name !== loc.name);
        return [{ name: loc.name, lat: loc.lat, lon: loc.lon }, ...filtered].slice(0, 8);
      });
    }
    setMapLocation({ lat: loc.lat, lon: loc.lon });
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocError("Nettleseren din støtter ikke posisjon.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // Reverse geocode for stedsnavn
        let name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)" } }
          );
          const data = await res.json();
          if (data?.address) {
            name =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.municipality ||
              data.display_name?.split(",")[0] ||
              name;
          }
        } catch { /* behold koordinat-navn */ }
        await getWeather({ lat, lon, name });
        setLocating(false);
      },
      () => {
        setLocError("Kunne ikke hente posisjon. Sjekk at du har gitt tillatelse.");
        setLocating(false);
      }
    );
  };

  const handleMapClick = useCallback((loc) => {
    getWeather(loc);
    setResults([]);
    setQuery("");
  }, []);

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

        <WeatherMap onLocationSelect={handleMapClick} externalLocation={mapLocation} />

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", overflow: "hidden", minWidth: 0 }}>
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontWeight: 700, fontSize: "0.82rem", cursor: locating ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: locating ? 0.7 : 1, whiteSpace: "nowrap" }}
          >
            📍 {locating ? "Henter..." : "Min posisjon"}
          </button>
          {locError && <span style={{ flexShrink: 0, fontSize: "0.78rem", color: "#b91c1c", whiteSpace: "nowrap" }}>{locError}</span>}
          {recentSearches.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => getWeather(r)}
              style={{ flexShrink: 1, minWidth: 0, padding: "0.5rem 0.85rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {r.name}
            </button>
          ))}
        </div>

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
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{symbolToEmoji(weather.current.symbol)}</span>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                  {selectedName ? `${t.now} — ${selectedName}` : t.now}
                </h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.75rem" }}>
                {[
                  { label: t.temperature, value: `${weather.current.temperature}°C`, emoji: "🌡️" },
                  { label: t.wind, value: `${weather.current.windSpeed} m/s`, emoji: "💨" },
                  { label: t.humidity, value: `${weather.current.humidity}%`, emoji: "💧" },
                  { label: t.precipitation, value: `${weather.current.precipitation} mm`, emoji: "🌧️" },
                ].map(({ label, value, emoji }) => (
                  <div key={label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>{emoji} {label}</div>
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
                    <span style={{ minWidth: "180px", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.2rem" }}>{symbolToEmoji(day.symbol)}</span>
                      {formatDate(day.date)}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>🌡️ {day.tempMin}° / {day.tempMax}°C</span>
                    <span style={{ color: "var(--text-muted)" }}>💨 {day.avgWindSpeed} m/s</span>
                    <span style={{ color: "var(--text-muted)" }}>🌧️ {day.totalPrecipitation} mm</span>
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
