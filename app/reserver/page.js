"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./Reserver.module.css";

export default function CabinsPage() {
  const [cabins, setCabins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadCabins() {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("/api/cabins", { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "Kunne ikke hente hytter fra databasen.");
        }

        if (!alive) return;

        const list = Array.isArray(json.cabins) ? json.cabins : [];
        setCabins(list);

        // velg første automatisk
        setSelectedId((prev) => prev ?? (list[0]?.id ?? null));
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

  const selectedCabin = useMemo(() => {
    if (!selectedId) return null;
    return cabins.find((c) => c.id === selectedId) ?? null;
  }, [cabins, selectedId]);

  // NY: link til booking-side uten [cabinId]-mappe (bruker query param)
  const bookingHref = useMemo(() => {
    if (!selectedCabin?.id) return null;
    return `/reserver/booking?cabinId=${encodeURIComponent(selectedCabin.id)}`;
  }, [selectedCabin]);

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
                    <div className={styles.empty}>Ingen hytter i databasen enda.</div>
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
                          <span className={styles.price}>{cabin.price_per_night} kr/natt</span>
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
                      <p>{selectedCabin.description ?? "Ingen beskrivelse tilgjengelig."}</p>

                      <div className={styles.meta}>
                        📍 {selectedCabin.location}
                        <br />
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
