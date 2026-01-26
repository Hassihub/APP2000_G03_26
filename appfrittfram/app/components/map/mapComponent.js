"use client";

import { useEffect, useRef, useState } from "react";

export default function MapComponent() {
  const mapRef = useRef(null);
  const [Leaflet, setLeaflet] = useState(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const drawCleanupRef = useRef(null);

  // Dynamisk import av Leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
      setLeaflet(L);
    });
  }, []);

  // Opprett kart kun én gang
  useEffect(() => {
    if (!Leaflet) return;
    if (mapRef.current) return;

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

  // ⚡ Viktig: lag en stabil getter-funksjon som alltid returnerer NYESTE verdi av placing
  const getPlacing = () => placingRef.current;

    import("./drawRoutes").then(({ enableRouteDrawing }) => {
      drawCleanupRef.current = enableRouteDrawing(
        map,
        L,
        (route) => console.log("Rute lagret:", route),
        getPlacing
      );
    });

    return () => {
      if (drawCleanupRef.current) drawCleanupRef.current();
      map.remove();
      mapRef.current = null;
    };
  }, [Leaflet]); // kun Leaflet som dependency

  // Hold placingRef oppdatert med nåværende placing-verdi
  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

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
        }}
      >
        <button onClick={() => setPlacing(!placing)}>
          {placing ? "Avslutt plassering" : "Plasser punkt"}
        </button>
        <div style={{ marginTop: 5, fontSize: 12 }}>
          - Klikk på kart for å legge til markør <br />
          - Klikk på markør for å fjerne den <br />
          - Dra markør for å flytte den
        </div>
      </div>
    </>
  );
}
