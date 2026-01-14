"use client";

import { useState } from "react";
import styles from "./explore.module.css";

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");

  return (
    <main className={styles.container}>
      
      {/* Header */}
      <section className={styles.header}>
        <h1 className={styles.heading}>Utforsk Norge</h1>
        <p className={styles.subheading}>
          Finn turer, ruter og friluftsopplevelser
        </p>
      </section>

      {/* Søk og filter */}
      <section className={styles.filters}>
        <input
          className={styles.search}
          type="text"
          placeholder="Søk etter tur eller sted"
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

      {/* Kart box */}
      <section className={styles.mapSection}>
        <div className={styles.map}>
          <p>Kartvisning (Leaflet / Mapbox senere)</p>
        </div>
      </section>

      {/* Resultater */}
      <section className={styles.results}>
        <h2>Forslag til turer</h2>

        <div className={styles.grid}>
          <TourCard
            title="Rondane rundt"
            location="Innlandet"
            distance="12 km"
            difficulty="Middels"
          />
          <TourCard
            title="Topptur til Galdhøpiggen"
            location="Jotunheimen"
            distance="15 km"
            difficulty="Krevende"
          />
          <TourCard
            title="Kyststi ved Stavern"
            location="Vestfold"
            distance="6 km"
            difficulty="Lett"
          />
        </div>
      </section>

    </main>
  );
}

/*  Kort!!!*/

function TourCard({ title, location, distance, difficulty }) {
  return (
    <article className={styles.card}>
      <div className={styles.imagePlaceholder} />

      <div className={styles.cardContent}>
        <h3>{title}</h3>
        <p className={styles.location}>{location}</p>

        <div className={styles.meta}>
          <span>{distance}</span>
          <span>{difficulty}</span>
        </div>

        <button className={styles.button}>
          Se detaljer
        </button>
      </div>
    </article>
  );
}
