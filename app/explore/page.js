"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./explore.module.css";

export default function ExplorePage() {
  const searchParams = useSearchParams();
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

      if (!res.ok) throw new Error("Kunne ikke hente turer");

      const data = await res.json();
      setTrips(data);
    } catch (err) {
      console.error(err);
      setTrips([]);
    }
  }, [difficulty, onlyTiu, search, type]);

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
        throw new Error(data?.error || "Kunne ikke opprette tur");
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
        error: err.message || "Noe gikk galt",
      });
      return;
    }

    setCreateStatus({ loading: false, error: "" });
  };

  return (
    <main className={styles.container}>
      <section className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Utforsk Norge</h1>
          <p className={styles.subheading}>Finn turer over hele landet</p>
        </div>

        <button className={styles.createButton} onClick={openCreate}>
          + Opprett tur
        </button>
      </section>

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

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyTiu}
            onChange={(e) => setOnlyTiu(e.target.checked)}
          />
          Kun TiU-fellesturer
        </label>
      </section>

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

      {isCreateOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeCreate}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Opprett ny tur</h3>
              <button
                className={styles.iconButton}
                onClick={closeCreate}
                aria-label="Lukk"
                type="button"
              >
                ✕
              </button>
            </div>

            <form className={styles.form} onSubmit={submitCreate}>
              <label className={styles.field}>
                <span>Navn</span>
                <input
                  value={newTrip.navn}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, navn: e.target.value })
                  }
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Beskrivelse</span>
                <textarea
                  rows={3}
                  value={newTrip.beskrivelse}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, beskrivelse: e.target.value })
                  }
                />
              </label>

              <label className={styles.field}>
                <span>Bilde-URL</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newTrip.bilde_url}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, bilde_url: e.target.value })
                  }
                />
              </label>

              <label className={styles.field}>
                <span>Lengde (km)</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newTrip.lengde_km}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, lengde_km: e.target.value })
                  }
                  required
                />
              </label>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Type</span>
                  <select
                    value={newTrip.type}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, type: e.target.value })
                    }
                  >
                    <option value="fottur">Fottur</option>
                    <option value="skitur">Skitur</option>
                    <option value="sykkel">Sykkel</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Vanskelighetsgrad</span>
                  <select
                    value={newTrip.vanskelighetsgrad}
                    onChange={(e) =>
                      setNewTrip({
                        ...newTrip,
                        vanskelighetsgrad: e.target.value,
                      })
                    }
                  >
                    <option value="lett">Lett</option>
                    <option value="middels">Middels</option>
                    <option value="krevende">Krevende</option>
                  </select>
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Start lat</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={newTrip.start_lat}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, start_lat: e.target.value })
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>Start lng</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={newTrip.start_lng}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, start_lng: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Slutt lat</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={newTrip.end_lat}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, end_lat: e.target.value })
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>Slutt lng</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={newTrip.end_lng}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, end_lng: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={newTrip.isTiu}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, isTiu: e.target.checked })
                  }
                />
                Dette er en TiU-fellestur
              </label>

              {newTrip.isTiu && (
                <label className={styles.field}>
                  <span>Turleder</span>
                  <input
                    value={newTrip.turleder_navn}
                    onChange={(e) =>
                      setNewTrip({
                        ...newTrip,
                        turleder_navn: e.target.value,
                      })
                    }
                    required
                  />
                </label>
              )}

              {createStatus.error && (
                <p className={styles.error}>{createStatus.error}</p>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeCreate}
                >
                  Avbryt
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={createStatus.loading}
                >
                  {createStatus.loading ? "Oppretter..." : "Opprett"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function TripCard({ trip }) {
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
            Organisert av TiU
            {trip.turleder_navn ? ` • ${trip.turleder_navn}` : ""}
          </span>
        )}

        <button className={styles.button}>Se detaljer</button>
      </div>
    </article>
  );
}