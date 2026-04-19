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

export default function AdminTripsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [routeStatusMessage, setRouteStatusMessage] = useState("");
  const [routeActionLoading, setRouteActionLoading] = useState({});
  const [verificationRoutes, setVerificationRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

  const selectedRoute = useMemo(
    () => verificationRoutes.find((route) => String(route.id) === String(selectedRouteId)) || null,
    [verificationRoutes, selectedRouteId]
  );

  async function loadRoutes() {
    setRouteLoading(true);
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

      if (list.length > 0) {
        setSelectedRouteId((prev) => (prev && list.some((r) => String(r.id) === String(prev)) ? prev : list[0].id));
      } else {
        setSelectedRouteId(null);
      }
    } catch (err) {
      setRouteError(err?.message || "Noe gikk galt");
    } finally {
      setRouteLoading(false);
    }
  }

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

        await loadRoutes();
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

      const boundsPoints = [];

      verificationRoutes.forEach((route) => {
        const coords = route?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;

        const latLngs = coords
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) return null;
            const lon = Number(point[0]);
            const lat = Number(point[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return [lat, lon];
          })
          .filter(Boolean);

        if (latLngs.length < 2) return;

        boundsPoints.push(...latLngs);

        const isSelected = String(route.id) === String(selectedRouteId);
        const color = isSelected ? "#2563eb" : "#64748b";

        const polyline = L.polyline(latLngs, {
          color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.95 : 0.65,
        }).addTo(routeLayer);

        polyline.bindPopup(`<strong>${route.name || "Tur"}</strong><br/>${route.length_km || 0} km`);
        polyline.on("click", () => setSelectedRouteId(route.id));
      });

      if (selectedRoute?.geometry?.coordinates?.length >= 2) {
        const selectedLatLngs = selectedRoute.geometry.coordinates
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) return null;
            const lon = Number(point[0]);
            const lat = Number(point[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return [lat, lon];
          })
          .filter(Boolean);

        if (selectedLatLngs.length >= 2) {
          map.fitBounds(getBounds(selectedLatLngs), { padding: [24, 24] });
          return;
        }
      }

      if (boundsPoints.length >= 2) {
        map.fitBounds(getBounds(boundsPoints), { padding: [24, 24] });
      }
    }

    redrawMap();
  }, [verificationRoutes, selectedRouteId, selectedRoute]);

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

      if (selectedRouteId && String(selectedRouteId) === String(routeId)) {
        setSelectedRouteId(remaining[0]?.id ?? null);
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

      <div style={{ marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={loadRoutes}
          disabled={routeLoading}
          style={{
            padding: "0.5rem 0.8rem",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--bg-panel)",
            color: "var(--text)",
            cursor: routeLoading ? "not-allowed" : "pointer",
            opacity: routeLoading ? 0.7 : 1,
            fontWeight: 600,
          }}
        >
          {routeLoading ? "Oppdaterer..." : "Oppdater ruter"}
        </button>
      </div>

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
            const isSelected = String(route.id) === String(selectedRouteId);

            return (
              <article
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
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
    </div>
  );
}
