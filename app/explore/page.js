"use client";

import { useEffect, useRef, useState } from "react";
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
    bilde_url: "",
    isTiu: false,
    turleder_navn: "",
  });

  // Kart/route-tegning for ny tur
  const [Leaflet, setLeaflet] = useState(null);
  const mapRef = useRef(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState({ points: [], geometry: null });

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
  }, [search, type, difficulty, onlyTiu]);

  // Last inn Leaflet kun i browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Leaflet) return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
      setLeaflet(L);
    });
  }, [Leaflet]);

  // Opprett lite kart inne i opprett-tur-modal
  useEffect(() => {
    // Bare prøv å lage kart når modal er åpen og Leaflet er lastet
    if (!Leaflet || !isCreateOpen || mapRef.current) return;

    const container = document.getElementById("new-trip-map");
    if (!container) return;

    const L = Leaflet;
    const map = L.map(container, {
      center: [63.2, 15],
      zoom: 5,
      minZoom: 4,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    import("../components/map/maskLayer").then(({ addMaskLayer }) => {
      try {
        addMaskLayer(map, L);
      } catch (e) {
        console.error("Kunne ikke legge til maske for Norge på ny tur-kart:", e);
      }
    });

    const getPlacing = () => placingRef.current;

    import("../components/map/drawRoutes").then(({ enableRouteDrawing }) => {
      drawCleanupRef.current = enableRouteDrawing(
        map,
        L,
        (route) => setCurrentRoute(route),
        getPlacing
      );
    });

    return () => {
      if (drawCleanupRef.current) {
        drawCleanupRef.current();
        drawCleanupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [Leaflet, isCreateOpen]);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

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
        bilde_url: newTrip.bilde_url || null,
        geometry: currentRoute.geometry || null,
        isTiu: newTrip.isTiu,
        turleder_navn: newTrip.isTiu ? newTrip.turleder_navn : null,
      };

      if (!payload.geometry) {
        throw new Error("Du må tegne en rute på kartet for turen.");
      }

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
        bilde_url: "",
        isTiu: false,
        turleder_navn: "",
      });
      setCurrentRoute({ points: [], geometry: null });

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

              <div className={styles.field}>
                <span>Rute på kart</span>
                <div
                  id="new-trip-map"
                  style={{
                    width: "100%",
                    height: 260,
                    borderRadius: 12,
                    border: "1px solid #e6e6ef",
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setPlacing((p) => !p)}
                  >
                    {placing ? "Avslutt punktplassering" : "Plasser punkter"}
                  </button>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Klikk på kartet for å legge til punkter. Minst to punkter
                    kreves for en rute.
                  </span>
                </div>
                {currentRoute.geometry && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#10b981" }}>
                    Rute valgt med {currentRoute.points.length} punkt(er).
                  </div>
                )}
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
        <img
          src={trip.bilde_url}
          alt={trip.navn}
          className={styles.tripImage}
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