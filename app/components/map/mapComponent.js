"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMenu, FiX, FiChevronLeft, FiChevronRight, FiNavigation } from "react-icons/fi";
import { COMMON_AMENITIES } from "../../reserver/amenities";

export default function MapComponent() {
  const mapRef = useRef(null);
  const [Leaflet, setLeaflet] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const geojsonCleanupRef = useRef(null);
  const userLocationLayerRef = useRef(null);
  const geolocationWatchIdRef = useRef(null);
  const avatarUrlRef = useRef(null);
  const [isTrackingUserLocation, setIsTrackingUserLocation] = useState(false);
  const [autoFollowUserLocation, setAutoFollowUserLocation] = useState(true);
  const autoFollowUserLocationRef = useRef(true);
  const [showCabins, setShowCabins] = useState(false);
  const cabinsLayerRef = useRef(null);
  const [selectedCabin, setSelectedCabin] = useState(null);
  const [showTrips, setShowTrips] = useState(false);
  const tripsLayerRef = useRef(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [hytterOpen, setHytterOpen] = useState(false);
  const [turforslagOpen, setTurforslagOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [cabinSearchFilter, setCabinSearchFilter] = useState("");
  const [cabinStaffedFilter, setCabinStaffedFilter] = useState("alle");
  const [cabinMinPriceFilter, setCabinMinPriceFilter] = useState("");
  const [cabinMaxPriceFilter, setCabinMaxPriceFilter] = useState("");
  const [cabinAmenitiesFilter, setCabinAmenitiesFilter] = useState([]);
  const [tripTypeFilter, setTripTypeFilter] = useState("alle"); // fottur/skitur/sykkel/alle
  const [tripDifficultyFilter, setTripDifficultyFilter] = useState("alle"); // lett/middels/krevende/alle
  const [tripOnlyTiu, setTripOnlyTiu] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [routeToggles, setRouteToggles] = useState({
    annenrute: false,
    skiløype: false,
    sykkelrute: false,
    ruteinfopunkt: false,
  });
  const routeTogglesRef = useRef({
    annenrute: false,
    skiløype: false,
    sykkelrute: false,
    ruteinfopunkt: false,
  });

  const router = useRouter();

  const pages = [
    { label: "Hjem", href: "/" },
    { label: "Utforsk", href: "/explore" },
    { label: "Reserver", href: "/reserver" },
    { label: "Kart", href: "/map" },
    { label: "Vær", href: "/vaer" },
    { label: "Sosial", href: "/sosial" },
    { label: "Logg inn", href: "/login" },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
      setLeaflet(L);
    });

    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user?.avatar) avatarUrlRef.current = d.user.avatar;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!Leaflet || mapRef.current) return;
    const L = Leaflet;

    const map = L.map("map", {
      center: [63.2, 15],
      zoom: 5,
      minZoom: 4,
      zoomControl: false,
      preferCanvas: true, // bedre ytelse for mange vektorobjekter
    });
    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    import("./maskLayer").then(({ addMaskLayer }) => addMaskLayer(map, L));

    const getRouteToggles = () => routeTogglesRef.current;
    import("./geojsonRoutesLayer").then(({ enableGeojsonRoutes }) => {
      geojsonCleanupRef.current = enableGeojsonRoutes(map, L, getRouteToggles);
    });

    // Hent posisjon automatisk ved oppstart
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          placeUserMarker(L, map, latitude, longitude, accuracy);
        },
        (error) => {
          console.warn("Geolokasjon ved oppstart feilet:", error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      if (geolocationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
        geolocationWatchIdRef.current = null;
      }
      if (geojsonCleanupRef.current) geojsonCleanupRef.current();
      if (cabinsLayerRef.current) {
        map.removeLayer(cabinsLayerRef.current);
        cabinsLayerRef.current = null;
      }
      if (tripsLayerRef.current) {
        map.removeLayer(tripsLayerRef.current);
        tripsLayerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [Leaflet]);

  useEffect(() => {
    routeTogglesRef.current = routeToggles;
  }, [routeToggles]);

  useEffect(() => {
    autoFollowUserLocationRef.current = autoFollowUserLocation;
  }, [autoFollowUserLocation]);

  // Juster kartstørrelsen når panelet vises/skjules slik at det fyller hele bredden
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [panelVisible]);

  // 🔹 Vis hytter fra databasen ved hjelp av lagrede koordinater, med valgfritt datofilter
  useEffect(() => {
    if (!Leaflet || !mapRef.current) return;

    const L = Leaflet;
    const map = mapRef.current;

    const fetchAndRenderCabins = async () => {
      // Skjul lag hvis brukeren har skrudd av visning av hytter
      if (!showCabins) {
        if (cabinsLayerRef.current && map.hasLayer(cabinsLayerRef.current)) {
          map.removeLayer(cabinsLayerRef.current);
        }
        cabinsLayerRef.current = null;
        setSelectedCabin(null);
        return;
      }

      // Fjern eksisterende lag før vi laster nye data (f.eks. ved endring av dato)
      if (cabinsLayerRef.current && map.hasLayer(cabinsLayerRef.current)) {
        map.removeLayer(cabinsLayerRef.current);
        cabinsLayerRef.current = null;
      }

      try {
        const params = new URLSearchParams();
        if (filterStartDate && filterEndDate) {
          params.set("start_date", filterStartDate);
          params.set("end_date", filterEndDate);
        }
        if (cabinSearchFilter.trim()) {
          params.set("search", cabinSearchFilter.trim());
        }
        if (cabinStaffedFilter === "betjent") {
          params.set("staffed", "true");
        } else if (cabinStaffedFilter === "ubetjent") {
          params.set("staffed", "false");
        }

        const minPrice = Number(cabinMinPriceFilter);
        if (Number.isFinite(minPrice) && cabinMinPriceFilter !== "") {
          params.set("min_price", String(minPrice));
        }

        const maxPrice = Number(cabinMaxPriceFilter);
        if (Number.isFinite(maxPrice) && cabinMaxPriceFilter !== "") {
          params.set("max_price", String(maxPrice));
        }

        if (cabinAmenitiesFilter.length) {
          params.set("amenities", cabinAmenitiesFilter.join(","));
        }

        const url = params.toString()
          ? `/api/cabins?${params.toString()}`
          : "/api/cabins";

        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.warn("Kunne ikke hente hytter:", json?.error);
          return;
        }

        const cabins = Array.isArray(json.cabins) ? json.cabins : [];
        if (!cabins.length) return;

        const layer = L.layerGroup();

        const cabinIcon = L.icon({
          iconUrl: "/images/cabinPin.svg",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const cabinHoverIcon = L.icon({
          iconUrl: "/images/cabinPin.svg",
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });

        for (const cabin of cabins) {
          const lat = Number(cabin.latitude);
          const lon = Number(cabin.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          const marker = L.marker([lat, lon], {
            icon: cabinIcon,
            riseOnHover: true,
          });

          const popupLines = [];
          popupLines.push(`<strong>${cabin.name ?? "Hytte"}</strong>`);
          if (cabin.location) popupLines.push(`📍 ${cabin.location}`);
          if (Number.isFinite(cabin.price_per_night)) {
            popupLines.push(`💰 ${cabin.price_per_night} kr/natt`);
          }
          if (Number.isFinite(cabin.capacity)) {
            popupLines.push(`👥 ${cabin.capacity} pers`);
          }

          marker.bindPopup(popupLines.join("<br/>"));
          marker.on("mouseover", () => {
            marker.setIcon(cabinHoverIcon);
            marker.setZIndexOffset(1000);
          });
          marker.on("mouseout", () => {
            marker.setIcon(cabinIcon);
            marker.setZIndexOffset(0);
          });
          marker.on("click", () => {
            setSelectedCabin(cabin);
            setSelectedTrip(null);
          });
          layer.addLayer(marker);
        }

        if (layer.getLayers().length === 0) return;

        layer.addTo(map);
        cabinsLayerRef.current = layer;
      } catch (e) {
        console.error("Feil ved lasting av hytter:", e);
      }
    };

    fetchAndRenderCabins();
  }, [
    showCabins,
    Leaflet,
    filterStartDate,
    filterEndDate,
    cabinSearchFilter,
    cabinStaffedFilter,
    cabinMinPriceFilter,
    cabinMaxPriceFilter,
    cabinAmenitiesFilter,
  ]);

  // 🔹 Vis lagrede trips (fra /api/trips) på kartet, med filtrering
  useEffect(() => {
    if (!Leaflet || !mapRef.current) return;

    const L = Leaflet;
    const map = mapRef.current;

    const fetchAndRenderTrips = async () => {
      if (!showTrips) {
        if (tripsLayerRef.current && map.hasLayer(tripsLayerRef.current)) {
          map.removeLayer(tripsLayerRef.current);
        }
        tripsLayerRef.current = null;
        setSelectedTrip(null);
        return;
      }

      if (tripsLayerRef.current && map.hasLayer(tripsLayerRef.current)) {
        map.removeLayer(tripsLayerRef.current);
        tripsLayerRef.current = null;
      }

      try {
        const params = new URLSearchParams();
        if (tripTypeFilter !== "alle") params.set("type", tripTypeFilter);
        if (tripDifficultyFilter !== "alle")
          params.set("difficulty", tripDifficultyFilter);
        if (tripOnlyTiu) params.set("onlyTiu", "true");

        const url = params.toString()
          ? `/api/trips?${params.toString()}`
          : "/api/trips";

        const res = await fetch(url);
        const json = await res.json().catch(() => []);

        if (!res.ok) {
          console.warn("Kunne ikke hente trips:", json?.error);
          return;
        }

        const trips = Array.isArray(json) ? json : [];
        if (!trips.length) return;

        const features = trips
          .filter((trip) =>
            trip && trip.geometry && typeof trip.geometry === "object"
          )
          .map((trip) => ({
            type: "Feature",
            geometry: trip.geometry,
            properties: {
              id: trip.id,
              navn: trip.navn,
              beskrivelse: trip.beskrivelse,
              type: trip.type,
              vanskelighetsgrad: trip.vanskelighetsgrad,
              lengde_km: trip.lengde_km,
              bilde_url: trip.bilde_url,
              tiu_trip_id: trip.tiu_trip_id,
              turleder_navn: trip.turleder_navn,
            },
          }));

        if (!features.length) return;

        const getTripStyle = (type) => {
          if (type === "skitur") return { color: "#1f77b4", weight: 4 };
          if (type === "sykkel") return { color: "#2ca02c", weight: 4 };
          return { color: "#ff4d4d", weight: 4 };
        };

        const layer = L.geoJSON(
          { type: "FeatureCollection", features },
          {
            style: (feature) => {
              const type = feature?.properties?.type;
              return {
                ...getTripStyle(type),
                opacity: 0.95,
              };
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};
              const baseStyle = getTripStyle(p.type);
              const lines = [];
              if (p.navn) lines.push(`<strong>${p.navn}</strong>`);
              if (p.lengde_km)
                lines.push(`Lengde: ${p.lengde_km.toFixed?.(1) ?? p.lengde_km} km`);
              if (p.vanskelighetsgrad)
                lines.push(`Vanskelighetsgrad: ${p.vanskelighetsgrad}`);
              if (p.turleder_navn)
                lines.push(`Turleder: ${p.turleder_navn}`);

              if (lines.length) {
                layer.bindPopup(lines.join("<br/>"));
              }

              layer.on("mouseover", () => {
                layer.setStyle({
                  ...baseStyle,
                  weight: 7,
                  opacity: 1,
                });

                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                  layer.bringToFront();
                }
              });

              layer.on("mouseout", () => {
                layer.setStyle({
                  ...baseStyle,
                  opacity: 0.95,
                });
              });

              layer.on("click", () => {
                setSelectedTrip(p);
                setSelectedCabin(null);
              });
            },
          }
        );

        layer.addTo(map);
        tripsLayerRef.current = layer;
      } catch (e) {
        console.error("Feil ved lasting av trips:", e);
      }
    };

    fetchAndRenderTrips();
  }, [showTrips, Leaflet, tripTypeFilter, tripDifficultyFilter, tripOnlyTiu]);


  // 🔵 Plasser brukerens posisjon på kartet – profilbilde hvis tilgjengelig, ellers blå sirkel
  const placeUserMarker = (L, map, latitude, longitude, accuracy, shouldCenterMap = true) => {
    if (userLocationLayerRef.current) {
      map.removeLayer(userLocationLayerRef.current);
      userLocationLayerRef.current = null;
    }

    const group = L.layerGroup();

    // Nøyaktighetsradius
    L.circle([latitude, longitude], {
      radius: accuracy,
      color: "#2563eb",
      fillColor: "#93c5fd",
      fillOpacity: 0.2,
      weight: 1,
    }).addTo(group);

    const popup = `Din posisjon<br/>Lat: ${latitude.toFixed(5)}<br/>Lon: ${longitude.toFixed(5)}`;
    const avatar = avatarUrlRef.current;

    if (avatar) {
      const size = 36;
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          border:3px solid #1d4ed8;
          overflow:hidden;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
        "><img src="${avatar}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2)],
      });
      L.marker([latitude, longitude], { icon }).bindPopup(popup).addTo(group);
    } else {
      L.circleMarker([latitude, longitude], {
        radius: 10,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 1,
        weight: 2,
      }).bindPopup(popup).addTo(group);
    }

    group.addTo(map);
    userLocationLayerRef.current = group;
    if (shouldCenterMap) {
      map.setView([latitude, longitude], 14);
    }
  };

  // 🔵 Finn brukerens posisjon og vis på kartet
  const locateUser = () => {
    if (!Leaflet || !mapRef.current) return;

    if (!navigator.geolocation) {
      alert("Nettleseren din støtter ikke geolokasjon");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        placeUserMarker(Leaflet, mapRef.current, latitude, longitude, accuracy, true);
      },
      (error) => {
        console.error("Geolokasjonsfeil:", error);
        alert("Kunne ikke hente posisjonen din: " + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleLiveUserTracking = () => {
    if (!Leaflet || !mapRef.current) return;

    if (!navigator.geolocation) {
      alert("Nettleseren din støtter ikke geolokasjon");
      return;
    }

    if (geolocationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
      setIsTrackingUserLocation(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        placeUserMarker(
          Leaflet,
          mapRef.current,
          latitude,
          longitude,
          accuracy,
          autoFollowUserLocationRef.current
        );
      },
      (error) => {
        console.error("Geolokasjonsfeil (live):", error);
        alert("Live-sporing stoppet: " + error.message);
        if (geolocationWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
          geolocationWatchIdRef.current = null;
        }
        setIsTrackingUserLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    geolocationWatchIdRef.current = watchId;
    setIsTrackingUserLocation(true);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 40px)",
        width: "100%",
        marginTop: 40,
      }}
    >
      {/* Venstre panel: 1/3 bredde med alle toggles og kontroller */}
      {panelVisible && (
        <div
          style={{
            flexBasis: "27.33%",
            maxWidth: "27.33%",
            minWidth: 260,
            boxSizing: "border-box",
            padding: 16,
            background: "white",
            boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          {selectedCabin ? (
            <div>
              <button
                type="button"
                onClick={() => setSelectedCabin(null)}
                style={{
                  marginBottom: 12,
                  padding: "0.35rem 0.7rem",
                  borderRadius: 9999,
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ← Tilbake til kartverktøy
              </button>

              {Array.isArray(selectedCabin.image_urls) &&
                selectedCabin.image_urls.length > 0 && (
                  <div
                    style={{
                      margin: "0 -16px 12px -16px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={selectedCabin.image_urls[0]}
                      alt={selectedCabin.name || "Hyttebilde"}
                      style={{ width: "100%", height: 180, objectFit: "cover" }}
                    />
                  </div>
                )}

              <div
                style={{
                  marginBottom: 6,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                }}
              >
                Valgt hytte
              </div>

              <h2 style={{ margin: 0, fontSize: 20 }}>
                {selectedCabin.name || "Hytte"}
              </h2>
              {selectedCabin.location && (
                <div style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>
                  📍 {selectedCabin.location}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                  fontSize: 13,
                  flexWrap: "wrap",
                }}
              >
                {Number.isFinite(Number(selectedCabin.capacity)) && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#eff6ff",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    👥 {Number(selectedCabin.capacity)} pers
                  </div>
                )}
                {Number.isFinite(Number(selectedCabin.price_per_night)) && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#fef9c3",
                      border: "1px solid #fde68a",
                    }}
                  >
                    💰
                    {" "}
                    {Number(selectedCabin.price_per_night).toLocaleString(
                      "nb-NO",
                    )}{" "}
                    kr / natt
                  </div>
                )}
                {selectedCabin.is_staffed && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#ecfdf5",
                      border: "1px solid #6ee7b7",
                    }}
                  >
                    👨‍💼 Betjent hytte
                  </div>
                )}
              </div>

              {selectedCabin.description && (
                <p
                  style={{
                    marginTop: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#374151",
                  }}
                >
                  {selectedCabin.description}
                </p>
              )}

              {Array.isArray(selectedCabin.amenities) &&
                selectedCabin.amenities.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 13,
                        marginBottom: 4,
                        color: "#4b5563",
                      }}
                    >
                      Fasiliteter
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      {selectedCabin.amenities.map((a) => (
                        <span
                          key={a}
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 9999,
                            backgroundColor: "#f3f4f6",
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                <Link
                  href={`/reserver/booking?cabinId=${encodeURIComponent(
                    selectedCabin.id,
                  )}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "0.6rem 0.8rem",
                    borderRadius: 9999,
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Reserver denne hytta
                </Link>
              </div>
            </div>
          ) : selectedTrip ? (
            <div>
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                style={{
                  marginBottom: 12,
                  padding: "0.35rem 0.7rem",
                  borderRadius: 9999,
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ← Tilbake til kartverktøy
              </button>

              {selectedTrip.bilde_url && (
                <div
                  style={{
                    margin: "0 -16px 12px -16px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={selectedTrip.bilde_url}
                    alt={selectedTrip.navn || "Turbilde"}
                    style={{ width: "100%", height: 180, objectFit: "cover" }}
                  />
                </div>
              )}

              <div
                style={{
                  marginBottom: 6,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                }}
              >
                Valgt tur
              </div>

              <h2 style={{ margin: 0, fontSize: 20 }}>
                {selectedTrip.navn || "Tur"}
              </h2>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                  fontSize: 13,
                  flexWrap: "wrap",
                }}
              >
                {selectedTrip.type && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#ecfeff",
                      border: "1px solid #a5f3fc",
                    }}
                  >
                    🥾 {selectedTrip.type}
                  </div>
                )}

                {Number.isFinite(Number(selectedTrip.lengde_km)) && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#fef9c3",
                      border: "1px solid #fde68a",
                    }}
                  >
                    📏 {Number(selectedTrip.lengde_km).toFixed(1)} km
                  </div>
                )}

                {selectedTrip.vanskelighetsgrad && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#f3e8ff",
                      border: "1px solid #d8b4fe",
                    }}
                  >
                    ⛰️ {selectedTrip.vanskelighetsgrad}
                  </div>
                )}

                {selectedTrip.tiu_trip_id && (
                  <div
                    style={{
                      padding: "0.2rem 0.45rem",
                      borderRadius: 9999,
                      backgroundColor: "#dcfce7",
                      border: "1px solid #86efac",
                    }}
                  >
                    👥 TiU-fellestur
                  </div>
                )}
              </div>

              {selectedTrip.turleder_navn && (
                <p
                  style={{
                    marginTop: 10,
                    marginBottom: 0,
                    fontSize: 14,
                    color: "#374151",
                  }}
                >
                  Turleder: {selectedTrip.turleder_navn}
                </p>
              )}

              {selectedTrip.beskrivelse && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#374151",
                  }}
                >
                  {selectedTrip.beskrivelse}
                </p>
              )}

              <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                <Link
                  href={`/explore/${encodeURIComponent(selectedTrip.id)}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "0.6rem 0.8rem",
                    borderRadius: 9999,
                    border: "none",
                    backgroundColor: "#16a34a",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Se turdetaljer
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={locateUser} style={{ flex: 1 }}>
                  Min posisjon
                </button>
                <button onClick={toggleLiveUserTracking} style={{ flex: 1 }}>
                  {isTrackingUserLocation ? "Stopp live-sporing" : "Start live-sporing"}
                </button>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoFollowUserLocation}
                  onChange={(e) => setAutoFollowUserLocation(e.target.checked)}
                />
                Følg meg automatisk når live-sporing er aktiv
              </label>
              <div style={{ marginTop: 16 }}>
                <strong>GeoJSON-lag (zoom inn for å se)</strong>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={routeToggles.annenrute}
                    onChange={(e) =>
                      setRouteToggles((prev) => ({
                        ...prev,
                        annenrute: e.target.checked,
                      }))
                    }
                  />
                  <span>Annen rute</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={routeToggles.skiløype}
                    onChange={(e) =>
                      setRouteToggles((prev) => ({
                        ...prev,
                        skiløype: e.target.checked,
                      }))
                    }
                  />
                  <span>Skiløype</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={routeToggles.sykkelrute}
                    onChange={(e) =>
                      setRouteToggles((prev) => ({
                        ...prev,
                        sykkelrute: e.target.checked,
                      }))
                    }
                  />
                  <span>Sykkelrute</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={routeToggles.ruteinfopunkt}
                    onChange={(e) =>
                      setRouteToggles((prev) => ({
                        ...prev,
                        ruteinfopunkt: e.target.checked,
                      }))
                    }
                  />
                  <span>Rute infopunkt</span>
                </label>
              </div>

              <Link
                href="/turrute/ny"
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  textDecoration: "none",
                  marginTop: 14,
                  padding: "0.6rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #166534",
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
                  fontWeight: 700,
                }}
              >
                Lag ny rute
              </Link>

            </>
          )}
        </div>
      )}

      {/* Høyre panel: 2/3 bredde med selve kartet og toppmeny */}
      <div
        style={{
          flex: 1,
          position: "relative",
        }}
      >
        {/* Hytter / Turforslag-knapper ved siden av +- zoom-kontrollen */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 54, // litt til høyre for Leaflet sin zoom-kontroll
            zIndex: 800,
            display: "flex",
            gap: 8,
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                const next = !hytterOpen;
                setHytterOpen(next);
                setShowCabins(next);
              }}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 9999,
                border: hytterOpen ? "2px solid #2563eb" : "1px solid #d4d4d4",
                backgroundColor: hytterOpen ? "#dbeafe" : "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Hytter
            </button>

            {hytterOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "115%",
                  left: 0,
                  backgroundColor: "#ffffff",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  padding: "0.6rem 0.8rem",
                  minWidth: 220,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Filtrer hytter
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  Velg kriterier for tilgjengelighet, type, pris og fasiliteter.
                </div>
                <label style={{ display: "block", marginBottom: 4 }}>
                  <span style={{ display: "block", fontSize: 12 }}>
                    Søk i navn/sted
                  </span>
                  <input
                    type="text"
                    value={cabinSearchFilter}
                    onChange={(e) => setCabinSearchFilter(e.target.value)}
                    placeholder="F.eks. Rondane"
                    style={{ width: "100%" }}
                  />
                </label>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ display: "block", fontSize: 12, marginBottom: 2 }}>
                    Betjening
                  </span>
                  <select
                    value={cabinStaffedFilter}
                    onChange={(e) => setCabinStaffedFilter(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="alle">Alle</option>
                    <option value="betjent">Kun betjente</option>
                    <option value="ubetjent">Kun ubetjente</option>
                  </select>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ display: "block", fontSize: 12, marginBottom: 2 }}>
                    Prisnivå per natt
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      min="0"
                      value={cabinMinPriceFilter}
                      onChange={(e) => setCabinMinPriceFilter(e.target.value)}
                      placeholder="Min"
                      style={{ width: "100%" }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={cabinMaxPriceFilter}
                      onChange={(e) => setCabinMaxPriceFilter(e.target.value)}
                      placeholder="Maks"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <label style={{ display: "block", marginBottom: 4 }}>
                  <span style={{ display: "block", fontSize: 12 }}>Fra dato</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ display: "block", marginBottom: 4 }}>
                  <span style={{ display: "block", fontSize: 12 }}>Til dato</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>

                <div style={{ marginBottom: 6 }}>
                  <span style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                    Fasiliteter
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                      maxHeight: 140,
                      overflowY: "auto",
                    }}
                  >
                    {COMMON_AMENITIES.map((amenity) => {
                      const isChecked = cabinAmenitiesFilter.includes(amenity);
                      return (
                        <label
                          key={amenity}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setCabinAmenitiesFilter((prev) => {
                                if (e.target.checked) return [...prev, amenity];
                                return prev.filter((item) => item !== amenity);
                              });
                            }}
                          />
                          <span>{amenity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCabinSearchFilter("");
                    setCabinStaffedFilter("alle");
                    setCabinMinPriceFilter("");
                    setCabinMaxPriceFilter("");
                    setCabinAmenitiesFilter([]);
                    setFilterStartDate("");
                    setFilterEndDate("");
                  }}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    marginBottom: 4,
                    padding: "0.35rem 0.55rem",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    backgroundColor: "#f9fafb",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Nullstill filter
                </button>
                <div style={{ fontSize: 11, color: "#555" }}>
                  Hvis datoer er tomme vises både ledige og reserverte hytter.
                </div>
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                const next = !turforslagOpen;
                setTurforslagOpen(next);
                setShowTrips(next);
                if (!next) setSelectedTrip(null);
              }}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 9999,
                border: turforslagOpen ? "2px solid #16a34a" : "1px solid #d4d4d4",
                backgroundColor: turforslagOpen ? "#dcfce7" : "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Turforslag
            </button>

            {turforslagOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "115%",
                  left: 0,
                  backgroundColor: "#ffffff",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  padding: "0.6rem 0.8rem",
                  minWidth: 230,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Filtrer turforslag
                </div>
                <div style={{ marginTop: 2, fontSize: 13 }}>Aktivitet</div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 4,
                    marginBottom: 6,
                  }}
                >
                  {[
                    { id: "alle", label: "Alle" },
                    { id: "fottur", label: "Fottur" },
                    { id: "skitur", label: "Skitur" },
                    { id: "sykkel", label: "Sykkeltur" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setTripTypeFilter(opt.id)}
                      style={{
                        flex: "0 0 auto",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 9999,
                        border:
                          tripTypeFilter === opt.id
                            ? "2px solid #16a34a"
                            : "1px solid #d4d4d4",
                        backgroundColor:
                          tripTypeFilter === opt.id ? "#bbf7d0" : "#f9fafb",
                        fontSize: 11,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 13 }}>Vanskelighetsgrad</div>
                  <select
                    value={tripDifficultyFilter}
                    onChange={(e) => setTripDifficultyFilter(e.target.value)}
                    style={{ width: "100%", marginTop: 4, fontSize: 12 }}
                  >
                    <option value="alle">Alle</option>
                    <option value="lett">Lett</option>
                    <option value="middels">Middels</option>
                    <option value="krevende">Krevende</option>
                  </select>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tripOnlyTiu}
                    onChange={(e) => setTripOnlyTiu(e.target.checked)}
                  />
                  <span>Bare TiU-turer</span>
                </label>
              </div>
            )}
          </div>
        </div>
        {/* Flytende pil-knapp ved venstre kant av kartet */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            transform: "translate(-50%, -50%)",
            zIndex: 1100,
          }}
        >
          <button
            onClick={() => setPanelVisible((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 44,
              borderRadius: 8,
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 0 6px rgba(0,0,0,0.15)",
            }}
            aria-label={panelVisible ? "Skjul meny" : "Vis meny"}
          >
            {panelVisible ? (
              <FiChevronLeft size={18} />
            ) : (
              <FiChevronRight size={18} />
            )}
          </button>
        </div>

        <div id="map" style={{ height: "100%", width: "100%" }} />

        <button
          type="button"
          onClick={toggleLiveUserTracking}
          title={isTrackingUserLocation ? "Stopp live-sporing" : "Start live-sporing"}
          style={{
            position: "absolute",
            right: 10,
            bottom: 20,
            zIndex: 800,
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            backgroundColor: isTrackingUserLocation ? "#dcfce7" : "#ffffff",
            color: isTrackingUserLocation ? "#166534" : "#111827",
            fontWeight: 600,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label={isTrackingUserLocation ? "Stopp live-sporing" : "Start live-sporing"}
        >
          <FiNavigation size={16} />
        </button>

        <style jsx global>{`
          #map .leaflet-bottom.leaflet-right .leaflet-control-zoom {
            margin-bottom: 56px;
          }
        `}</style>

        {/* Topp-høyre menyknapp for kart-siden */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 800,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-block",
            }}
          >
            <button
              onClick={() => setMenuOpen((open) => !open)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0.5rem 0.8rem",
                borderRadius: 6,
                border: "1px solid #ccc",
                backgroundColor: "#fff",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                minWidth: 90,
                boxSizing: "border-box",
              }}
            >
              {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
              <span>{menuOpen ? "Close" : "Menu"}</span>
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  right: 0,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  minWidth: 180,
                  padding: "0.5rem 0",
                  zIndex: 1300,
                }}
              >
                {pages.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(p.href);
                    }}
                    style={{
                      display: "block",
                      padding: "0.6rem 1rem",
                      textDecoration: "none",
                      color: "#333",
                      fontWeight: 500,
                      fontSize: "0.95rem",
                      borderTop: "1px solid #f2f2f2",
                    }}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
