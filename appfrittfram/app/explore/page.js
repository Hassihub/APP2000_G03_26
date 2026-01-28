"use client";

import { useEffect, useState } from "react";
import styles from "./explore.module.css";

export default function ExplorePage() {
  const [trips, setTrips] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const params = new URLSearchParams({ search, type, difficulty });
        const res = await fetch(`/api/users/trips?${params.toString()}`);

        if (!res.ok) throw new Error("Kunne ikke hente turer");

        const data = await res.json();
        setTrips(data);
      } catch (err) {
        console.error(err);
        setTrips([]); // clear trips if error
      }
    };

    fetchTrips();
  }, [search, type, difficulty]);

  return (
    <main className={styles.container}>
      {/* Header */}
      <section className={styles.header}>
        <h1 className={styles.heading}>Utforsk Norge</h1>
        <p className={styles.subheading}>
          Finn turer over hele landet
        </p>
      </section>

      {/* Filters */}
      <section className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Søk etter tur"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="alle">Alle typer</option>
          <option value="fottur">Fottur</option>
          <option value="skitur">Skitur</option>
          <option value="sykkel">Sykkel</option>
        </select>

        <select
          className={styles.select}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="alle">Vanskelighet</option>
          <option value="lett">Lett</option>
          <option value="middels">Middels</option>
          <option value="krevende">Krevende</option>
        </select>
      </section>

      {/* Trips */}
      <section className={styles.results}>
        <h2>Turer</h2>
        <div className={styles.grid}>
          {trips.length > 0 ? (
            trips.map((trip) => <TripCard key={trip.id} trip={trip} />)
          ) : (
            <p>Ingen turer funnet</p>
          )}
        </div>
      </section>
    </main>
  );
}

/* ===== Components ===== */
function TripCard({ trip }) {
  return (
    <article className={styles.card}>
      <div className={styles.imagePlaceholder} />
      <div className={styles.cardContent}>
        <h3>{trip.navn}</h3>
        <p className={styles.location}>{trip.type}</p>
        <div className={styles.meta}>
          <span>{trip.lengde_km} km</span>
          <span>{trip.vanskelighetsgrad}</span>
        </div>
        <button className={styles.button}>Se detaljer</button>
      </div>
    </article>
  );
}
