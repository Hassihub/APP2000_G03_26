"use client";

import { useEffect, useRef, useState } from "react";

export default function MapComponent() {
  const mapRef = useRef(null);
  const [Leaflet, setLeaflet] = useState(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);
  const geojsonCleanupRef = useRef(null);
  const gpxLayerRef = useRef(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
      setLeaflet(L);
    });
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

    return () => {
      if (drawCleanupRef.current) drawCleanupRef.current();
      if (geojsonCleanupRef.current) geojsonCleanupRef.current();
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

  return (
    <>
      <div id="map" style={{ height: "80vh", width: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 300,
          left: 10,
          zIndex: 1000,
          background: "white",
          padding: 10,
          width: 250,
        }}
      >
        <button onClick={() => setPlacing(!placing)}>
          {placing ? "Avslutt plassering" : "Plasser punkt"}
        </button>

        <div style={{ marginTop: 10 }}>
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

        <div style={{ marginTop: 10 }}>
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
    </>
  );
}
