"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useCallback } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./explore.module.css";
import { useTranslations } from "../components/LanguageProvider";

export default function Page() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ExplorePage />
    </Suspense>
  );
}

function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("explorePage");
  const [trips, setTrips] = useState([]);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");
  const [onlyTiu, setOnlyTiu] = useState(false);

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

  return (
    <main className={styles.container}>
      <section className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>{t.title}</h1>
          <p className={styles.subheading}>{t.subtitle}</p>
        </div>

        <button
          className={styles.createButton}
          onClick={() => router.push("/turrute/ny")}
          type="button"
        >
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
            trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onUpdated={fetchTrips} />
            ))
          ) : (
            <p>{t.noTrips}</p>
          )}
        </div>
      </section>

    </main>
  );
}

function TripCard({ trip, onUpdated }) {
  const router = useRouter();

  const [actionState, setActionState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const canRegisterBinding = Boolean(trip.departure_id);
  const canExpressInterest =
    Boolean(trip.tiu_trip_id) &&
    trip.is_flexible === true &&
    trip.planning_status === "interest_open";

  const handleRegister = async () => {
    if (!trip.departure_id) return;

    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/departures/${trip.departure_id}/register`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere bindende påmelding");
      }

      setActionState({
        loading: false,
        message: data?.message || "Bindende påmelding registrert",
        error: "",
      });

      if (onUpdated) {
        await onUpdated();
      }
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const handleInterest = async () => {
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/trips/${trip.id}/interest`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere interesse");
      }

      setActionState({
        loading: false,
        message: data?.message || "Ikke-bindende interesse registrert",
        error: "",
      });

      if (onUpdated) {
        await onUpdated();
      }
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const goToDetails = () => {
    router.push(`/explore/${trip.id}`);
  };

  const previewUrl = Array.isArray(trip.bilde_urls) && trip.bilde_urls.length > 0
    ? trip.bilde_urls[0]
    : trip.bilde_url || null;

  return (
    <article className={styles.card}>
      {previewUrl ? (
        <Image
          src={previewUrl}
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

        {trip.is_flexible && (
          <p className={styles.departureInfo}>
            Fleksibel fellestur • {trip.date_options_count || 0} datoalternativer
          </p>
        )}

        {trip.planning_status && (
          <p className={styles.departureInfo}>
            Planstatus: {trip.planning_status}
          </p>
        )}

        {trip.departure_start_time && (
          <p className={styles.departureInfo}>
            Neste avgang:{" "}
            {new Date(trip.departure_start_time).toLocaleString("no-NO")}
          </p>
        )}

        {trip.departure_status && (
          <p className={styles.departureInfo}>
            Status på avgang: {trip.departure_status}
          </p>
        )}

        {actionState.message && (
          <p className={styles.successMessage}>{actionState.message}</p>
        )}

        {actionState.error && (
          <p className={styles.errorMessage}>{actionState.error}</p>
        )}

        <div className={styles.cardActions}>
          <button
            className={styles.button}
            onClick={goToDetails}
            type="button"
          >
            Se detaljer
          </button>

          {canExpressInterest && (
            <button
              className={styles.registerButton}
              onClick={handleInterest}
              disabled={actionState.loading}
              type="button"
            >
              {actionState.loading
                ? "Registrerer..."
                : "Meld ikke-bindende interesse"}
            </button>
          )}

          {canRegisterBinding && (
            <button
              className={styles.registerButton}
              onClick={handleRegister}
              disabled={actionState.loading}
              type="button"
            >
              {actionState.loading
                ? "Registrerer..."
                : "Meld meg bindende på"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}