"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN } from "../../../lib/roles";
import styles from "../../reserver/Reserver.module.css";

function getBounds(points) {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function toLatLngs(geometry) {
  let value = geometry;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }

  const coords = value?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return [];

  return coords
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return [lat, lon];
    })
    .filter(Boolean);
}

function getFirstMapSelection(routes, trips) {
  if (Array.isArray(routes) && routes.length > 0) {
    return { kind: "verification", id: routes[0].id };
  }

  if (Array.isArray(trips) && trips.length > 0) {
    return { kind: "tiu", id: trips[0].id };
  }

  return { kind: null, id: null };
}

export default function AdminTripsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [routeStatusMessage, setRouteStatusMessage] = useState("");
  const [routeActionLoading, setRouteActionLoading] = useState({});
  const [verificationRoutes, setVerificationRoutes] = useState([]);
  const [selectedMapItem, setSelectedMapItem] = useState({ kind: null, id: null });
  const [tiuTrips, setTiuTrips] = useState([]);
  const [tiuLoading, setTiuLoading] = useState(false);
  const [tiuError, setTiuError] = useState("");
  const [tiuStatusMessage, setTiuStatusMessage] = useState("");
  const [tiuActionLoading, setTiuActionLoading] = useState({});

  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

  const selectedRoute = useMemo(
    () =>
      selectedMapItem.kind === "verification"
        ? verificationRoutes.find((route) => String(route.id) === String(selectedMapItem.id)) || null
        : null,
    [verificationRoutes, selectedMapItem]
  );

  const selectedTiuTrip = useMemo(
    () =>
      selectedMapItem.kind === "tiu"
        ? tiuTrips.find((trip) => String(trip.id) === String(selectedMapItem.id)) || null
        : null,
    [tiuTrips, selectedMapItem]
  );

  const selectedMapGeometry = selectedRoute?.geometry || selectedTiuTrip?.geometry || null;

  async function loadRoutes() {
    setRouteError("");

    try {
      const routesRes = await fetch("/api/admin/route-verifications", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!routesRes.ok) {
        const json = await routesRes.json().catch(() => ({}));
        throw new Error(json?.error || "Kunne ikke hente ruter til verifisering");
      }

      const routesData = await routesRes.json().catch(() => ({}));
      const list = Array.isArray(routesData?.routes) ? routesData.routes : [];
      setVerificationRoutes(list);
    } catch (err) {
      setRouteError(err?.message || "Noe gikk galt");
    }
  }

  async function loadTiuTrips() {
    setTiuLoading(true);
    setTiuError("");

    try {
      const tiuRes = await fetch("/api/admin/tiu-trips", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!tiuRes.ok) {
        const json = await tiuRes.json().catch(() => ({}));
        throw new Error(json?.error || "Kunne ikke hente TiU-turer");
      }

      const tiuData = await tiuRes.json().catch(() => ({}));
      const list = Array.isArray(tiuData?.trips) ? tiuData.trips : [];
      setTiuTrips(list);
    } catch (err) {
      setTiuError(err?.message || "Noe gikk galt");
    } finally {
      setTiuLoading(false);
    }
  }

  useEffect(() => {
    setSelectedMapItem((prev) => {
      const selectedRouteExists =
        prev.kind === "verification" &&
        verificationRoutes.some((route) => String(route.id) === String(prev.id));
      const selectedTiuExists =
        prev.kind === "tiu" && tiuTrips.some((trip) => String(trip.id) === String(prev.id));

      if (selectedRouteExists || selectedTiuExists) {
        return prev;
      }

      return getFirstMapSelection(verificationRoutes, tiuTrips);
    });
  }, [verificationRoutes, tiuTrips]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const meRes = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!meRes.ok) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json().catch(() => ({}));
        if (!meData?.user) {
          router.push("/login");
          return;
        }

        if (meData.user.role !== ROLE_ADMIN) {
          setError("Du har ikke tilgang til denne siden.");
          return;
        }

        await Promise.all([loadRoutes(), loadTiuTrips()]);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Noe gikk galt");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    let map;

    async function initMap() {
      if (loading) return;
      if (typeof window === "undefined") return;
      if (mapRef.current) return;

      const container = document.getElementById("admin-routes-map");
      if (!container) return;

      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (!mounted) return;

      map = L.map(container, {
        center: [63.3, 10.4],
        zoom: 5,
        minZoom: 4,
      });

      mapRef.current = map;
      routeLayerRef.current = L.layerGroup().addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);

      import("../../components/map/maskLayer").then(({ addMaskLayer }) => {
        try {
          addMaskLayer(map, L);
        } catch (maskError) {
          console.error("Kunne ikke legge til maske for Norge:", maskError);
        }
      });
    }

    initMap();

    return () => {
      mounted = false;
      if (map) {
        map.off();
        map.remove();
      }
      mapRef.current = null;
      routeLayerRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    async function redrawMap() {
      const map = mapRef.current;
      const routeLayer = routeLayerRef.current;
      if (!map || !routeLayer) return;

      const L = await import("leaflet");
      routeLayer.clearLayers();

      const selectedLatLngs = toLatLngs(selectedMapGeometry);

      if (selectedLatLngs.length >= 2) {
        const color = selectedMapItem.kind === "tiu" ? "#b45309" : "#2563eb";
        const dashArray = selectedMapItem.kind === "tiu" ? "8 6" : undefined;

        L.polyline(selectedLatLngs, {
          color,
          weight: selectedMapItem.kind === "tiu" ? 4 : 5,
          opacity: selectedMapItem.kind === "tiu" ? 0.85 : 0.95,
          dashArray,
        }).addTo(routeLayer);

        selectedLatLngs.forEach((latLng, index) => {
          const isStart = index === 0;
          const isEnd = index === selectedLatLngs.length - 1;
          const markerColor = isStart ? "#0f766e" : isEnd ? "#b91c1c" : "#475569";
          const markerLabel = isStart ? "Start" : isEnd ? "Slutt" : `Mellompunkt ${index}`;

          L.circleMarker(latLng, {
            radius: isStart || isEnd ? 7 : 5,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.95,
            weight: 2,
          })
            .bindPopup(
              `<strong>${markerLabel}</strong><br/>${latLng[0].toFixed(5)}, ${latLng[1].toFixed(5)}`
            )
            .addTo(routeLayer);
        });

        map.fitBounds(getBounds(selectedLatLngs), { padding: [24, 24] });
        return;
      }

    }

    redrawMap();
  }, [selectedMapGeometry, selectedMapItem.kind, verificationRoutes, selectedRoute, selectedTiuTrip]);

  async function handleRouteDecision(routeId, decision) {
    setRouteError("");
    setRouteStatusMessage("");
    setRouteActionLoading((prev) => ({ ...prev, [routeId]: true }));

    try {
      const res = await fetch(
        `/api/admin/route-verifications/${encodeURIComponent(routeId)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ decision }),
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Kunne ikke behandle verifisering");
      }

      const remaining = verificationRoutes.filter((route) => String(route.id) !== String(routeId));
      setVerificationRoutes(remaining);

        if (selectedMapItem.kind === "verification" && String(selectedMapItem.id) === String(routeId)) {
          setSelectedMapItem(getFirstMapSelection(remaining, tiuTrips));
      }

      setRouteStatusMessage(
        decision === "approved"
          ? "Ruten ble godkjent og sendt til explore."
          : "Ruten ble avvist og fjernet fra verifiseringskøen."
      );
    } catch (err) {
      setRouteError(err?.message || "Noe gikk galt ved behandling av rute");
    } finally {
      setRouteActionLoading((prev) => ({ ...prev, [routeId]: false }));
    }
  }

  async function handleTiuDecision(tripId, decision) {
    setTiuError("");
    setTiuStatusMessage("");
    setTiuActionLoading((prev) => ({ ...prev, [tripId]: true }));

    try {
      const res = await fetch("/api/admin/tiu-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tripId, decision }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Kunne ikke behandle TiU-tur");
      }

      setTiuTrips((prev) => prev.filter((trip) => String(trip.id) !== String(tripId)));
      if (selectedMapItem.kind === "tiu" && String(selectedMapItem.id) === String(tripId)) {
        setSelectedMapItem(getFirstMapSelection(verificationRoutes, tiuTrips.filter((trip) => String(trip.id) !== String(tripId))));
      }
      setTiuStatusMessage(
        decision === "approve"
          ? "TiU-turen ble godkjent og åpnet for interesse."
          : "TiU-turen ble avslått og fjernet fra godkjenningskøen."
      );
    } catch (err) {
      setTiuError(err?.message || "Noe gikk galt ved behandling av TiU-tur");
    } finally {
      setTiuActionLoading((prev) => ({ ...prev, [tripId]: false }));
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <h1>Admin - Turer</h1>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/admin">Admin oversikt</Link>
        <span>|</span>
        <Link href="/admin/brukere">Brukere</Link>
      </div>

      <h1>Admin - Turer til verifisering</h1>
      {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

      {routeError ? (
        <div className={styles.errorBox} style={{ marginBottom: "0.75rem" }}>
          ❌ {routeError}
        </div>
      ) : null}

      {routeStatusMessage ? (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.6rem 0.8rem",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "8px",
            color: "#065f46",
          }}
        >
          {routeStatusMessage}
        </div>
      ) : null}

      <div
        id="admin-routes-map"
        style={{
          width: "100%",
          height: "420px",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          marginBottom: "1rem",
        }}
      />

      {verificationRoutes.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Ingen ruter venter på verifisering.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {verificationRoutes.map((route) => {
            const isBusy = routeActionLoading[route.id] === true;
            const isSelected = selectedMapItem.kind === "verification" && String(route.id) === String(selectedMapItem.id);

            return (
              <article
                key={route.id}
                onClick={() => setSelectedMapItem({ kind: "verification", id: route.id })}
                style={{
                  border: isSelected ? "2px solid #2563eb" : "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0.9rem",
                  background: "var(--bg-panel)",
                  cursor: "pointer",
                }}
              >
                <h3 style={{ margin: "0 0 0.35rem 0" }}>{route.name}</h3>
                {route.description ? (
                  <p style={{ margin: "0 0 0.6rem 0", color: "var(--text-muted)" }}>
                    {route.description}
                  </p>
                ) : null}

                <p style={{ margin: "0 0 0.4rem 0" }}>
                  <strong>Type:</strong> {route.type} | <strong>Vanskelighet:</strong> {route.difficulty} |{" "}
                  <strong>Lengde:</strong> {route.length_km} km
                </p>

                <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-muted)" }}>
                  Innsendt av: {route.created_by_username || route.created_by || "Ukjent"}
                </p>

                {Array.isArray(route.cabins) && route.cabins.length > 0 ? (
                  <p style={{ margin: "0 0 0.7rem 0", color: "var(--text-muted)" }}>
                    Hytter: {route.cabins.map((cabin) => cabin.name).join(", ")}
                  </p>
                ) : null}

                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRouteDecision(route.id, "approved");
                    }}
                    style={{
                      padding: "0.5rem 0.8rem",
                      borderRadius: "8px",
                      border: "none",
                      background: "#065f46",
                      color: "white",
                      fontWeight: 600,
                      cursor: isBusy ? "not-allowed" : "pointer",
                      opacity: isBusy ? 0.7 : 1,
                    }}
                  >
                    {isBusy ? "Behandler..." : "Godkjenn"}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRouteDecision(route.id, "rejected");
                    }}
                    style={{
                      padding: "0.5rem 0.8rem",
                      borderRadius: "8px",
                      border: "1px solid #dc2626",
                      background: "transparent",
                      color: "#dc2626",
                      fontWeight: 600,
                      cursor: isBusy ? "not-allowed" : "pointer",
                      opacity: isBusy ? 0.7 : 1,
                    }}
                  >
                    Avvis
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2>TiU-turer til godkjenning</h2>

        {tiuError ? (
          <div className={styles.errorBox} style={{ marginBottom: "0.75rem" }}>
            ❌ {tiuError}
          </div>
        ) : null}

        {tiuStatusMessage ? (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.6rem 0.8rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              color: "#065f46",
            }}
          >
            {tiuStatusMessage}
          </div>
        ) : null}

        {tiuLoading ? (
          <p>Laster TiU-turer...</p>
        ) : tiuTrips.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Ingen TiU-turer venter på godkjenning.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {tiuTrips.map((trip) => {
              const isBusy = tiuActionLoading[trip.id] === true;
              const isSelected = selectedMapItem.kind === "tiu" && String(trip.id) === String(selectedMapItem.id);

              return (
                <article
                  key={trip.id}
                  onClick={() => setSelectedMapItem({ kind: "tiu", id: trip.id })}
                  style={{
                    border: isSelected ? "2px solid #b45309" : "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.9rem",
                    background: "var(--bg-panel)",
                    cursor: "pointer",
                  }}
                >
                  <h3 style={{ margin: "0 0 0.35rem 0" }}>{trip.navn}</h3>

                  <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-muted)" }}>
                    Turleder: {trip.turleder_navn || "Ukjent"} | Opprettet:{" "}
                    {trip.tiu_opprettet ? new Date(trip.tiu_opprettet).toLocaleString("no-NO") : "Ukjent"}
                  </p>

                  <p style={{ margin: "0 0 0.5rem 0" }}>
                    <strong>Type:</strong> {trip.type} | <strong>Vanskelighet:</strong> {trip.vanskelighetsgrad} |{" "}
                    <strong>Lengde:</strong> {trip.lengde_km} km
                  </p>

                  <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-muted)" }}>
                    {trip.date_options_count || 0} startalternativer
                  </p>

                  {Array.isArray(trip.date_options) && trip.date_options.length > 0 ? (
                    <ul style={{ margin: "0 0 0.75rem 1.1rem", padding: 0 }}>
                      {trip.date_options.map((option) => (
                        <li key={option.id} style={{ marginBottom: "0.2rem" }}>
                          {new Date(option.start_time).toLocaleString("no-NO")} –{" "}
                          {new Date(option.end_time).toLocaleString("no-NO")}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTiuDecision(trip.id, "approve")}
                      style={{
                        padding: "0.5rem 0.8rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "#065f46",
                        color: "white",
                        fontWeight: 600,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                      }}
                    >
                      {isBusy ? "Behandler..." : "Godkjenn TiU-tur"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTiuDecision(trip.id, "reject")}
                      style={{
                        padding: "0.5rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #dc2626",
                        background: "transparent",
                        color: "#dc2626",
                        fontWeight: 600,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                      }}
                    >
                      Avvis
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
