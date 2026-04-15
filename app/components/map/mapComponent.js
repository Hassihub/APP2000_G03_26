"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMenu, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function MapComponent() {
  const mapRef = useRef(null);
  const [Leaflet, setLeaflet] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);
  const geojsonCleanupRef = useRef(null);
  const gpxLayerRef = useRef(null);
  const userLocationLayerRef = useRef(null);
  const avatarUrlRef = useRef(null);
  const [showCabins, setShowCabins] = useState(false);
  const cabinsLayerRef = useRef(null);
  const [showTrips, setShowTrips] = useState(false);
  const tripsLayerRef = useRef(null);
  const [hytterOpen, setHytterOpen] = useState(false);
  const [turforslagOpen, setTurforslagOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [tripTypeFilter, setTripTypeFilter] = useState("alle"); // fottur/skitur/sykkel/alle
  const [tripDifficultyFilter, setTripDifficultyFilter] = useState("alle"); // lett/middels/krevende/alle
  const [tripOnlyTiu, setTripOnlyTiu] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [currentRoute, setCurrentRoute] = useState({ points: [], geometry: null });
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

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    activity: "foot",
    difficulty: 1,
    duration_minutes: 30,
  });

  const [elevationStats, setElevationStats] = useState(null);

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
      preferCanvas: true, // bedre ytelse for mange vektorobjekter
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    import("./maskLayer").then(({ addMaskLayer }) => addMaskLayer(map, L));

    const getPlacing = () => placingRef.current;

    import("./drawRoutes").then(({ enableRouteDrawing }) => {
      drawCleanupRef.current = enableRouteDrawing(
        map,
        L,
        (route) => setCurrentRoute(route),
        getPlacing
      );
    });

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
      if (drawCleanupRef.current) drawCleanupRef.current();
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
    placingRef.current = placing;
  }, [placing]);

  useEffect(() => {
    routeTogglesRef.current = routeToggles;
  }, [routeToggles]);

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

        for (const cabin of cabins) {
          const lat = Number(cabin.latitude);
          const lon = Number(cabin.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          const marker = L.marker([lat, lon], { icon: cabinIcon });

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
  }, [showCabins, Leaflet, filterStartDate, filterEndDate]);

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
              type: trip.type,
              vanskelighetsgrad: trip.vanskelighetsgrad,
              lengde_km: trip.lengde_km,
              tiu_trip_id: trip.tiu_trip_id,
              turleder_navn: trip.turleder_navn,
            },
          }));

        if (!features.length) return;

        const layer = L.geoJSON(
          { type: "FeatureCollection", features },
          {
            style: (feature) => {
              const type = feature?.properties?.type;
              if (type === "skitur") return { color: "#1f77b4", weight: 4 };
              if (type === "sykkel") return { color: "#2ca02c", weight: 4 };
              return { color: "#ff4d4d", weight: 4 };
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};
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

  // 🔹 Hent høydedata for manuelt tegnede ruter (ikke GPX)
  useEffect(() => {
    if (!currentRoute || !currentRoute.points || currentRoute.points.length < 2) {
      setElevationStats(null);
      return;
    }

    const firstPoint = currentRoute.points[0];
    const hasElevationField =
      typeof firstPoint === "object" && firstPoint !== null && "elevation" in firstPoint;

    // GPX-ruter har allerede elevation og beregner stats i handleGpxUpload
    if (hasElevationField) return;

    if (!currentRoute.geometry || !Array.isArray(currentRoute.geometry.coordinates)) {
      setElevationStats(null);
      return;
    }

    const coords = currentRoute.geometry.coordinates;
    if (coords.length < 2) {
      setElevationStats(null);
      return;
    }

    const fetchElevation = async () => {
      try {
        const res = await fetch("/api/elevation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: coords }),
        });

        if (!res.ok) {
          // Ekstern tjeneste er nede / gir feil – bare hopp over høydeprofil
          console.warn("Elevation API response status:", res.status);
          setElevationStats(null);
          return;
        }

        const data = await res.json();
        if (!data.results || !data.results.length) {
          setElevationStats(null);
          return;
        }

        const elevations = data.results.map((r) => r.elevation);
        const validElevations = elevations.filter(
          (e) => typeof e === "number" && !Number.isNaN(e)
        );

        if (!validElevations.length) {
          setElevationStats(null);
          return;
        }

        let totalAscent = 0;
        for (let i = 1; i < validElevations.length; i++) {
          const diff = validElevations[i] - validElevations[i - 1];
          if (diff > 0) totalAscent += diff;
        }

        const minEle = Math.min(...validElevations);
        const maxEle = Math.max(...validElevations);

        setElevationStats({
          min: Math.round(minEle),
          max: Math.round(maxEle),
          ascent: Math.round(totalAscent),
        });
      } catch (error) {
        console.error("Feil ved henting av høydedata:", error);
        setElevationStats(null);
      }
    };

    fetchElevation();
  }, [currentRoute]);

  // 🔹 Les inn en lokal GPX-fil og tegn den som rute på kartet
  const handleGpxUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!Leaflet || !mapRef.current) {
      alert("Kartet er ikke klart enda");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".gpx")) {
      alert("Vennligst velg en GPX-fil");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");

        const trkpts = xml.getElementsByTagName("trkpt");
        const rtepts = xml.getElementsByTagName("rtept");

        const points = [];

        const elevations = [];

        const collectPoints = (nodes) => {
          Array.from(nodes).forEach((node) => {
            const lat = parseFloat(node.getAttribute("lat"));
            const lon = parseFloat(node.getAttribute("lon"));
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
              const eleNode = node.getElementsByTagName("ele")[0];
              const ele = eleNode ? parseFloat(eleNode.textContent) : null;

              points.push([lat, lon]);
              elevations.push(ele);
            }
          });
        };

        if (trkpts.length > 0) {
          collectPoints(trkpts);
        } else if (rtepts.length > 0) {
          collectPoints(rtepts);
        }

        if (points.length < 2) {
          alert("Fant ikke en gyldig rute i GPX-filen");
          return;
        }

        const L = Leaflet;
        const map = mapRef.current;

        // Fjern tidligere GPX-lag
        if (gpxLayerRef.current) {
          map.removeLayer(gpxLayerRef.current);
          gpxLayerRef.current = null;
        }

        // Tegn linjen på kartet
        const polyline = L.polyline(points, { color: "blue" }).addTo(map);
        gpxLayerRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        // Oppdater currentRoute slik at ruten kan brukes videre (f.eks. sendes til verifisering)
        const geometry = {
          type: "LineString",
          coordinates: points.map(([lat, lon]) => [lon, lat]),
        };

        setCurrentRoute({
          points: points.map(([lat, lon], idx) => ({
            lat,
            lon,
            elevation: elevations[idx] ?? null,
          })),
          geometry,
        });

        // Beregn enkel høydestatistikk (meter over havet)
        const validElevations = elevations.filter((e) => typeof e === "number" && !Number.isNaN(e));
        if (validElevations.length > 0) {
          let totalAscent = 0;
          for (let i = 1; i < validElevations.length; i++) {
            const diff = validElevations[i] - validElevations[i - 1];
            if (diff > 0) totalAscent += diff;
          }

          const minEle = Math.min(...validElevations);
          const maxEle = Math.max(...validElevations);

          setElevationStats({
            min: Math.round(minEle),
            max: Math.round(maxEle),
            ascent: Math.round(totalAscent),
          });
        } else {
          setElevationStats(null);
        }
      } catch (error) {
        console.error("Feil ved lesing av GPX:", error);
        alert("Kunne ikke lese GPX-filen");
      }
    };

    reader.onerror = () => {
      console.error("Filopplastingsfeil", reader.error);
      alert("Kunne ikke lese filen");
    };

    reader.readAsText(file);
  };

  // 🔹 Funksjon som sender ruten til verifisering
  const submitRoute = async () => {
    if (!currentRoute.geometry || currentRoute.points.length < 2) {
      alert("Tegn minst to punkter før du sender!");
      return;
    }

    const payload = {
      ...formData,
      geometry: currentRoute.geometry,
      points: currentRoute.points,
      created_by: "", // fra auth hvis du har
    };

    try {
      const res = await fetch("/api/routes-to-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        alert("Ruten ble sendt til verifisering!");
        // nullstill formen og ruten
        setCurrentRoute({ points: [], geometry: null });
        setFormData({
          name: "",
          description: "",
          activity: "foot",
          difficulty: 1,
          duration_minutes: 30,
        });
      } else {
        alert("Noe gikk galt: " + JSON.stringify(data.error));
      }
    } catch (err) {
      console.error(err);
      alert("Feil ved sending av ruten");
    }
  };

  // 🔵 Plasser brukerens posisjon på kartet – profilbilde hvis tilgjengelig, ellers blå sirkel
  const placeUserMarker = (L, map, latitude, longitude, accuracy) => {
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
    map.setView([latitude, longitude], 14);
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
        placeUserMarker(Leaflet, mapRef.current, latitude, longitude, accuracy);
      },
      (error) => {
        console.error("Geolokasjonsfeil:", error);
        alert("Kunne ikke hente posisjonen din: " + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={locateUser} style={{ flex: 1 }}>
              Min posisjon
            </button>
            <button onClick={() => setPlacing(!placing)} style={{ flex: 1 }}>
              {placing ? "Avslutt plassering" : "Plasser punkt"}
            </button>
          </div>
        <div style={{ marginTop: 16 }}>
          <strong>GeoJSON-lag (zoom inn for å se)</strong>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
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

        <div style={{ marginTop: 16 }}>
          <strong>Importer GPX-rute</strong>
          <input
            type="file"
            accept=".gpx,application/gpx+xml"
            onChange={handleGpxUpload}
            style={{ width: "100%", marginTop: 5, marginBottom: 10 }}
          />

          {elevationStats && (
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              <div><strong>Høydeprofil</strong></div>
              <div>Laveste punkt: {elevationStats.min} moh</div>
              <div>Høyeste punkt: {elevationStats.max} moh</div>
              <div>Total stigning: {elevationStats.ascent} m</div>
            </div>
          )}

          <input
            placeholder="Rutenavn"
            value={formData.name}
            onChange={(e) =>
              setFormData((f) => ({ ...f, name: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 5 }}
          />
          <textarea
            placeholder="Beskrivelse"
            value={formData.description}
            onChange={(e) =>
              setFormData((f) => ({ ...f, description: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 5 }}
          />
          <select
            value={formData.activity}
            onChange={(e) =>
              setFormData((f) => ({ ...f, activity: e.target.value }))
            }
            style={{ width: "100%", marginBottom: 5 }}
          >
            <option value="foot">Fottur</option>
            <option value="bike">Sykkeltur</option>
            <option value="ski">Skitur</option>
          </select>
          <input
            type="number"
            placeholder="Vanskelighetsgrad (1–5)"
            value={formData.difficulty}
            min={1}
            max={5}
            onChange={(e) =>
              setFormData((f) => ({
                ...f,
                difficulty: parseInt(e.target.value, 10),
              }))
            }
            style={{ width: "100%", marginBottom: 5 }}
          />
          <input
            type="number"
            placeholder="Varighet i minutter"
            value={formData.duration_minutes}
            onChange={(e) =>
              setFormData((f) => ({
                ...f,
                duration_minutes: parseInt(e.target.value, 10),
              }))
            }
            style={{ width: "100%", marginBottom: 5 }}
          />

          <button
            onClick={submitRoute}
            style={{ width: "100%", marginTop: 5 }}
          >
            Send til verifisering
          </button>
        </div>
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
            zIndex: 1200,
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
                padding: "0.3rem 0.6rem",
                borderRadius: 9999,
                border: hytterOpen ? "2px solid #2563eb" : "1px solid #d4d4d4",
                backgroundColor: hytterOpen ? "#dbeafe" : "#ffffff",
                fontSize: 13,
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
                  Velg fra-/til-dato for å vise ledige hytter.
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
                <div style={{ fontSize: 11, color: "#555" }}>
                  Hvis datoer er tomme vises alle hytter.
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
              }}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: 9999,
                border: turforslagOpen ? "2px solid #16a34a" : "1px solid #d4d4d4",
                backgroundColor: turforslagOpen ? "#dcfce7" : "#ffffff",
                fontSize: 13,
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
            zIndex: 1150,
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

        {/* Topp-høyre menyknapp for kart-siden */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1200,
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
