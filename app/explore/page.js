"use client";

import { useEffect, useState } from "react";
import styles from "./explore.module.css";

export default function ExplorePage() {
  const [trips, setTrips] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");
  const [onlyTiu, setOnlyTiu] = useState(false);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState({ loading: false, error: "" });
  const [newTrip, setNewTrip] = useState({
    navn: "",
    beskrivelse: "",
    lengde_km: "",
    type: "fottur",
    vanskelighetsgrad: "lett",
  });

  const fetchTrips = async () => {
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
  };

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, difficulty, onlyTiu]);

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
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke opprette tur");

      // Reset + lukk
      setNewTrip({
        navn: "",
        beskrivelse: "",
        lengde_km: "",
        type: "fottur",
        vanskelighetsgrad: "lett",
      });

      closeCreate();

      // Refresh lista så den nye turen dukker opp
      await fetchTrips();
    } catch (err) {
      setCreateStatus({ loading: false, error: err.message || "Noe gikk galt" });
    } finally {
      setCreateStatus((s) => ({ ...s, loading: false }));
    }
  };

  return (
    <main className={styles.container}>
      {/* Header */}
      <section className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Utforsk Norge</h1>
          <p className={styles.subheading}>Finn turer over hele landet</p>
        </div>

        <button className={styles.createButton} onClick={openCreate}>
          + Opprett tur
        </button>
      </section>

      {/* Filters */}
      <section className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Søk etter tur"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
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
          <input type="checkbox" checked={onlyTiu} onChange={(e) => setOnlyTiu(e.target.checked)} />
          Kun TiU-fellesturer
        </label>
      </section>

      {/* Trips */}
      <section className={styles.results}>
        <h2>Turer</h2>
        <div className={styles.grid}>
          {trips.length > 0 ? trips.map((trip) => <TripCard key={trip.id} trip={trip} />) : <p>Ingen turer funnet</p>}
        </div>
      </section>

      {/* Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeCreate}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Opprett ny tur</h3>
              <button className={styles.iconButton} onClick={closeCreate} aria-label="Lukk">
                ✕
              </button>
            </div>

            <form className={styles.form} onSubmit={submitCreate}>
              <label className={styles.field}>
                <span>Navn</span>
                <input
                  value={newTrip.navn}
                  onChange={(e) => setNewTrip({ ...newTrip, navn: e.target.value })}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Beskrivelse</span>
                <textarea
                  rows={3}
                  value={newTrip.beskrivelse}
                  onChange={(e) => setNewTrip({ ...newTrip, beskrivelse: e.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span>Lengde (km)</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newTrip.lengde_km}
                  onChange={(e) => setNewTrip({ ...newTrip, lengde_km: e.target.value })}
                  required
                />
              </label>

              <div className={styles.row}>
                <label className={styles.field}>
                  <span>Type</span>
                  <select
                    value={newTrip.type}
                    onChange={(e) => setNewTrip({ ...newTrip, type: e.target.value })}
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
                    onChange={(e) => setNewTrip({ ...newTrip, vanskelighetsgrad: e.target.value })}
                  >
                    <option value="lett">Lett</option>
                    <option value="middels">Middels</option>
                    <option value="krevende">Krevende</option>
                  </select>
                </label>
              </div>

              {createStatus.error && <p className={styles.error}>{createStatus.error}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={closeCreate}>
                  Avbryt
                </button>
                <button className={styles.primaryButton} type="submit" disabled={createStatus.loading}>
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

        {trip.tiu_trip_id && (
          <span style={{ color: "#047857", fontWeight: 600 }}>
            Organisert av TiU
          </span>
        )}

        <button className={styles.button}>Se detaljer</button>
      </div>
    </article>
  );
}