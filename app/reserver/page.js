"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./Reserver.module.css";
import Search from "../search/page";

export default function CabinsPage() {
  const [cabins, setCabins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [weather, setWeather] = useState(null);
  const [showWeather, setShowWeather] = useState(false);

  const selectedCabin = useMemo(() => {
    if (!selectedId) return null;
    return cabins.find((c) => c.id === selectedId) ?? null;
  }, [cabins, selectedId]);

  // NY: link til booking-side uten [cabinId]-mappe (bruker query param)
  const bookingHref = useMemo(() => {
    if (!selectedCabin?.id) return null;
    return `/reserver/booking?cabinId=${encodeURIComponent(selectedCabin.id)}`;
  }, [selectedCabin?.location]);
  useEffect(() => {
    let alive = true;

    async function loadCabins() {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("/api/cabins", { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json?.error || "Kunne ikke hente hytter fra databasen.",
          );
        }

        if (!alive) return;

        const list = Array.isArray(json.cabins) ? json.cabins : [];
        setCabins(list);

        // velg første automatisk
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "Ukjent feil ved henting av hytter.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadCabins();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCabin?.location) return;
    const cabinLocation = selectedCabin.location;

    async function fetchWeather() {
      setWeather(null);
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(cabinLocation)}`,
      );
      const locations = await res.json();
      if (locations.length > 0) {
        const loc = locations[0];
        const weatherRes = await fetch(
          `/api/vaer?lat=${loc.lat}&lon=${loc.lon}`,
        );
        setWeather(await weatherRes.json());
      }
    }

    fetchWeather();
  }, [selectedCabin?.location]);

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Main */}
      <main style={{ padding: 0, paddingBottom: 120 }}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              {loading
                ? "⏳ Laster hytter..."
                : errorMsg
                  ? `❌ ${errorMsg}`
                  : `🏡 Hytter tilgjengelig: ${cabins.length} funnet`}
            </div>

            <div className={styles.layout}>
              {/* Venstre: liste */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>Velg en hytte</h3>

                <div className={styles.list}>
                  {!loading && !errorMsg && cabins.length === 0 ? (
                    <div className={styles.empty}>
                      Ingen hytter i databasen enda.
                    </div>
                  ) : null}

                  {cabins.map((cabin) => {
                    const isActive = cabin.id === selectedId;
                    return (
                      <button
                        key={cabin.id}
                        className={`${styles.listItem} ${isActive ? styles.active : ""}`}
                        onClick={() => setSelectedId(cabin.id)}
                        type="button"
                      >
                        <div className={styles.listItemTop}>
                          <span className={styles.cabinName}>{cabin.name}</span>
                          <span className={styles.price}>
                            {cabin.price_per_night} kr/natt
                          </span>
                        </div>

                        <div className={styles.listItemMeta}>
                          📍 {cabin.location} • 👥 {cabin.capacity} pers
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link className={styles.button} href="/reserver/ny">
                    ➕ Legg til ny hytte
                  </Link>
                </div>
              </div>

              {/* Høyre: detalj */}
              <div className={styles.card}>
                {selectedCabin ? (
                  <div className={styles.cardContent}>
                    <div className={styles.info}>
                      <h2>{selectedCabin.name}</h2>
                      <p>
                        {selectedCabin.description ??
                          "Ingen beskrivelse tilgjengelig."}
                      </p>

                      <div className={styles.meta}>
                        {/* Temp + knapp */}
                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            margin: 0,
                            lineHeight: "1",
                          }}
                        >
                          📍 {selectedCabin.location} - Temp:{" "}
                          {weather ? `${weather.current.temperature}` : "..."}°C
                          <button
                            className={styles.button}
                            onClick={() => setShowWeather((prev) => !prev)}
                            style={{
                              width: "auto",
                              padding: "2px 12px",
                              fontSize: "0.8rem",
                              verticalAlign: "middle",
                              marginLeft: "8px",
                            }}
                          >
                            🌤️ {showWeather ? "Skjul" : "Vis værmelding"}
                          </button>
                          {/* Dropdown flytende */}
                          {showWeather && weather?.daily && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                zIndex: 100,
                                background: "#fff",
                                border: "1px solid #ccc",
                                borderRadius: "10px",
                                padding: "12px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                minWidth: "360px",
                              }}
                            >
                              <strong style={{ fontSize: "0.9rem" }}>
                                📅 7-dagers prognose
                              </strong>
                              <div
                                style={{
                                  marginTop: "8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                {weather.daily.map((day) => (
                                  <div
                                    key={day.date}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: "0.85rem",
                                      borderBottom: "1px solid #eee",
                                      paddingBottom: "4px",
                                    }}
                                  >
                                    <span style={{ minWidth: "120px" }}>
                                      {new Date(day.date).toLocaleDateString(
                                        "nb-NO",
                                        {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "short",
                                        },
                                      )}
                                    </span>
                                    <span>
                                      🌡️ {day.tempMin}° / {day.tempMax}°
                                    </span>
                                    <span>🌧️ {day.totalPrecipitation}mm</span>
                                    <span>💨 {day.avgWindSpeed}m/s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        👥 {selectedCabin.capacity} personer
                        <br />
                        💰 {selectedCabin.price_per_night} kr per natt
                        <br />
                        🏡{" "}
                        {selectedCabin.amenities?.length
                          ? selectedCabin.amenities.join(", ")
                          : "Ingen registrerte fasiliteter"}
                      </div>

                      <div className={styles.actions}>
                        {bookingHref ? (
                          <Link className={styles.button} href={bookingHref}>
                            🗓️ Reserver denne hytta
                          </Link>
                        ) : null}

                        <Link className={styles.button} href="/reserver/ny">
                          ➕ Legg til ny hytte
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.empty}>
                    {loading
                      ? "Laster..."
                      : errorMsg
                        ? "Kunne ikke laste data."
                        : "Velg en hytte i listen for å se detaljer."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
