"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./explore.module.css";
import { useTranslations } from "../components/LanguageProvider";

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const t = useTranslations("explorePage");
  const [trips, setTrips] = useState([]);

  // Filters
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [type, setType] = useState(searchParams.get("type") || "alle");
  const [difficulty, setDifficulty] = useState(
    searchParams.get("difficulty") || "alle"
  );
  const [onlyTiu, setOnlyTiu] = useState(
    searchParams.get("onlyTiu") === "true"
  );

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState({
    loading: false,
    error: "",
  });

  const [newTrip, setNewTrip] = useState({
    navn: "",
    beskrivelse: "",
    lengde_km: "",
    type: "fottur",
    vanskelighetsgrad: "lett",
    start_lat: "",
    start_lng: "",
    end_lat: "",
    end_lng: "",
    bilde_url: "",
    isTiu: false,
    turleder_navn: "",
  });

  const fetchTrips = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search,
        type,
        difficulty,
        onlyTiu: onlyTiu ? "true" : "false",
      });

      const res = await fetch(`/api/trips?${params.toString()}`);

      if (!res.ok) throw new Error(t.fetchError);

      const data = await res.json();
      setTrips(data);
    } catch (err) {
      console.error(err);
      setTrips([]);
    }
  }, [difficulty, onlyTiu, search, t.fetchError, type]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setType(searchParams.get("type") || "alle");
    setDifficulty(searchParams.get("difficulty") || "alle");
    setOnlyTiu(searchParams.get("onlyTiu") === "true");
  }, [searchParams]);

  const openCreate = () => {
    setCreateStatus({ loading: false, error: "" });
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateStatus({ loading: false, error: "" });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateStatus({ loading: true, error: "" });

    try {
      const payload = {
        navn: newTrip.navn,
        beskrivelse: newTrip.beskrivelse || null,
        lengde_km: Number(newTrip.lengde_km),
        type: newTrip.type,
        vanskelighetsgrad: newTrip.vanskelighetsgrad,
        start_lat: newTrip.start_lat === "" ? null : Number(newTrip.start_lat),
        start_lng: newTrip.start_lng === "" ? null : Number(newTrip.start_lng),
        end_lat: newTrip.end_lat === "" ? null : Number(newTrip.end_lat),
        end_lng: newTrip.end_lng === "" ? null : Number(newTrip.end_lng),
        bilde_url: newTrip.bilde_url || null,
        isTiu: newTrip.isTiu,
        turleder_navn: newTrip.isTiu ? newTrip.turleder_navn : null,
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || t.submitError);
      }

      setNewTrip({
        navn: "",
        beskrivelse: "",
        lengde_km: "",
        type: "fottur",
        vanskelighetsgrad: "lett",
        start_lat: "",
        start_lng: "",
        end_lat: "",
        end_lng: "",
        bilde_url: "",
        isTiu: false,
        turleder_navn: "",
      });

      closeCreate();
      await fetchTrips();
    } catch (err) {
      setCreateStatus({
        loading: false,
        error: err.message || t.genericError,
      });
      return;
    }

    setCreateStatus({ loading: false, error: "" });
  };

  return (
    <main className={styles.container}>
      <section className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>{t.title}</h1>
          <p className={styles.subheading}>{t.subtitle}</p>
        </div>

        <button className={styles.createButton} onClick={openCreate}>
          + {t.createTrip}
        </button>
      </section>

      <section className={styles.filters}>
        <input
          className={styles.search}
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="alle">{t.allTypes}</option>
          <option value="fottur">{t.hike}</option>
          <option value="skitur">{t.ski}</option>
          <option value="sykkel">{t.bike}</option>
        </select>

        <select
          className={styles.select}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="alle">{t.difficulty}</option>
          <option value="lett">{t.easy}</option>
          <option value="middels">{t.medium}</option>
          <option value="krevende">{t.hard}</option>
        </select>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyTiu}
            onChange={(e) => setOnlyTiu(e.target.checked)}
          />
          {t.tiuOnly}
        </label>
      </section>

      <section className={styles.results}>
        <h2>{t.trips}</h2>
        <div className={styles.grid}>
          {trips.length > 0 ? (
            trips.map((trip) => <TripCard key={trip.id} trip={trip} t={t} />)
          ) : (
            <p>{t.noTrips}</p>
          )}
        </div>
      </section>

      {isCreateOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeCreate}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{t.createTitle}</h3>
              <button
                className={styles.iconButton}
                onClick={closeCreate}
                aria-label={t.close}
                type="button"
              >
                ✕
              </button>
            </div>

            <form className={styles.form} onSubmit={submitCreate}>
              {/* resten er identisk */}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function TripCard({ trip, t }) {
  return (
    <article className={styles.card}>
      {trip.bilde_url ? (
        <Image
          src={trip.bilde_url}
          alt={trip.navn}
          className={styles.tripImage}
          width={480}
          height={320}
          unoptimized
        />
      ) : (
        <div className={styles.imagePlaceholder} />
      )}

      <div className={styles.cardContent}>
        <h3>{trip.navn}</h3>
        <p className={styles.location}>{trip.type}</p>

        <div className={styles.meta}>
          <span>{trip.lengde_km} km</span>
          <span>{trip.vanskelighetsgrad}</span>
        </div>

        {trip.tiu_trip_id && (
          <span className={styles.tiuBadge}>
            TiU
            {trip.turleder_navn ? ` • ${trip.turleder_navn}` : ""}
          </span>
        )}

        <button className={styles.button}>{t.openDetails || "Details"}</button>
      </div>
    </article>
  );
}