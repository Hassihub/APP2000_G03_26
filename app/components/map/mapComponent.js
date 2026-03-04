"use client";

import { useEffect, useRef, useState } from "react";

export default function MapComponent() {
  const mapRef = useRef(null);
  const [Leaflet, setLeaflet] = useState(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState({ points: [], geometry: null });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    activity: "foot",
    difficulty: 1,
    duration_minutes: 30,
  });

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
      center: [65, 13],
      zoom: 5,
      minZoom: 4,
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

    return () => {
      if (drawCleanupRef.current) drawCleanupRef.current();
      map.remove();
      mapRef.current = null;
    };
  }, [Leaflet]);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

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
      <div id="map" style={{ height: "100vh", width: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 500,
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
