"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useCallback } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const searchParams = useSearchParams();
  const t = useTranslations("explorePage");
  const [trips, setTrips] = useState([]);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");
  const [onlyTiu, setOnlyTiu] = useState(false);

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
    isFlexible: false,
    dateOptions: [
      { start_time: "", end_time: "" },
      { start_time: "", end_time: "" },
      { start_time: "", end_time: "" },
    ],
  });
  const [Leaflet, setLeaflet] = useState(null);
  const mapRef = useRef(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState({
    points: [],
    geometry: null,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Leaflet) return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
      setLeaflet(L);
    });
  }, [Leaflet]);

  useEffect(() => {
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
        (route) => {
          setCurrentRoute(route);
          if (route.distanceKm) {
            setNewTrip((prev) => ({ ...prev, lengde_km: String(route.distanceKm) }));
          }
        },
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

  const updateDateOption = (index, field, value) => {
    const updated = [...newTrip.dateOptions];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setNewTrip({ ...newTrip, dateOptions: updated });
  };

  const addDateOption = () => {
    if (newTrip.dateOptions.length >= 5) return;
    setNewTrip({
      ...newTrip,
      dateOptions: [...newTrip.dateOptions, { start_time: "", end_time: "" }],
    });
  };

  const removeDateOption = (index) => {
    if (newTrip.dateOptions.length <= 3) return;
    const updated = newTrip.dateOptions.filter((_, i) => i !== index);
    setNewTrip({ ...newTrip, dateOptions: updated });
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
        isFlexible: newTrip.isFlexible,
        dateOptions: newTrip.isFlexible ? newTrip.dateOptions : [],
      };

      if (!payload.geometry) {
        throw new Error("Du må tegne en rute på kartet for turen.");
      }

      if (newTrip.isFlexible && !newTrip.isTiu) {
        throw new Error("Fleksibel fellestur må være en TiU-tur.");
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
        throw new Error(data?.error || t.submitError);
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
        isFlexible: false,
        dateOptions: [
          { start_time: "", end_time: "" },
          { start_time: "", end_time: "" },
          { start_time: "", end_time: "" },
        ],
      });

      setCurrentRoute({ points: [], geometry: null });

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
            trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onUpdated={fetchTrips} />
            ))
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

              {newTrip.isTiu && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={newTrip.isFlexible}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, isFlexible: e.target.checked })
                    }
                  />
                  Fleksibel fellestur
                </label>
              )}

              {newTrip.isFlexible && (
                <div className={styles.field}>
                  <span>Datoalternativer (3-5)</span>

                  {newTrip.dateOptions.map((option, index) => (
                    <div
                      key={index}
                      className={styles.row}
                      style={{ alignItems: "end", marginBottom: 8 }}
                    >
                      <label className={styles.field}>
                        <span>Start</span>
                        <input
                          type="datetime-local"
                          value={option.start_time}
                          onChange={(e) =>
                            updateDateOption(index, "start_time", e.target.value)
                          }
                          required
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Slutt</span>
                        <input
                          type="datetime-local"
                          value={option.end_time}
                          onChange={(e) =>
                            updateDateOption(index, "end_time", e.target.value)
                          }
                          required
                        />
                      </label>

                      {newTrip.dateOptions.length > 3 && (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => removeDateOption(index)}
                        >
                          Fjern
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={addDateOption}
                      disabled={newTrip.dateOptions.length >= 5}
                    >
                      Legg til datoalternativ
                    </button>
                  </div>
                </div>
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