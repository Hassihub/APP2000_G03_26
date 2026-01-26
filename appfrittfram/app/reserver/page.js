"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./Reserver.module.css";

export default function CabinsPage() {
  // Mock-data som matcher tabellen din (cabins)
  const cabins = useMemo(
    () => [
      {
        id: "0d0f2c1a-1111-4444-8888-aaaaaaaaaaaa",
        name: "Fjellro Lodge",
        description: "En moderne fjellhytte med panoramautsikt og peis.",
        location: "Hemsedal, Norge",
        price_per_night: 1200,
        capacity: 6,
        amenities: ["Peis", "Badstue", "WiFi", "Parkering"],
        created_at: "2026-01-15 12:10:00",
      },
      {
        id: "0d0f2c1a-2222-4444-8888-bbbbbbbbbbbb",
        name: "Sjøbris Cabin",
        description: "Koselig hytte nær sjøen – perfekt for rolige helger.",
        location: "Lofoten, Norge",
        price_per_night: 1450,
        capacity: 4,
        amenities: ["Havutsikt", "Kjøkken", "WiFi"],
        created_at: "2026-01-20 09:30:00",
      },
      {
        id: "0d0f2c1a-3333-4444-8888-cccccccccccc",
        name: "Skogstjerne",
        description: "Skjermet skogshytte med bålplass og turstier rett utenfor.",
        location: "Trysil, Norge",
        price_per_night: 990,
        capacity: 5,
        amenities: ["Bålplass", "Parkering", "Kjæledyr tillatt"],
        created_at: "2026-01-22 18:00:00",
      },
    ],
    []
  );

  // Viktig: init state med en funksjon, så slipper du edge-case warnings/crash
  const [selectedId, setSelectedId] = useState(() => cabins[0]?.id ?? null);

  const selectedCabin = useMemo(() => {
    if (!selectedId) return null;
    return cabins.find((c) => c.id === selectedId) ?? null;
  }, [cabins, selectedId]);

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Header */}
      <header className="topbar">
        <span className="topbar-left-text">Dette er et skoleprosjekt</span>
        <nav className="topbar-nav">
          <Link className="topbar-item" href="/">
            Home
          </Link>
          <Link className="topbar-item" href="/search">
            Search
          </Link>
          <Link className="topbar-item" href="/settings">
            Settings
          </Link>
          <Link className="topbar-item" href="/profile">
            Profile
          </Link>
        </nav>
      </header>

      {/* Main */}
      <main style={{ padding: 0 }}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              🏡 Hytter tilgjengelig: {cabins.length} funnet
            </div>

            <div className={styles.layout}>
              {/* Venstre: liste */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>Velg en hytte</h3>

                <div className={styles.list}>
                  {cabins.map((cabin) => {
                    const isActive = cabin.id === selectedId;

                    return (
                      <button
                        key={cabin.id}
                        className={`${styles.listItem} ${
                          isActive ? styles.active : ""
                        }`}
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

                {/* 👇 Ny knapp i venstre kort også (valgfritt, men veldig praktisk) */}
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
                        <br />
                        🕒 Opprettet: {selectedCabin.created_at ?? "ukjent"}
                      </div>

                      {/* Knapper */}
                      <div className={styles.actions}>
                        <Link className={styles.button} href="/reserver">
                          Gå til reservering
                        </Link>

                        <div style={{ height: 10 }} />

                        <Link className={styles.button} href="/reserver/ny">
                          ➕ Legg til ny hytte
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.empty}>
                    Velg en hytte i listen for å se detaljer.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer">Dette er en footer som ligger over bildene</footer>
      </main>
    </div>
  );
}