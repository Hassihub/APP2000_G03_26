"use client";

import { useEffect, useRef } from "react";

export default function WeatherMap({ onLocationSelect, externalLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  // Flytt markør og kart når søk velges utenfra
  useEffect(() => {
    if (!externalLocation || !mapRef.current || !leafletRef.current) return;
    const { lat, lon } = externalLocation;
    const Leaflet = leafletRef.current;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const icon = Leaflet.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:var(--accent,#6675ff);border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      });
      markerRef.current = Leaflet.marker([lat, lon], { icon }).addTo(mapRef.current);
    }

    mapRef.current.setView([lat, lon], 11);
  }, [externalLocation]);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then(async (L) => {
      if (cancelled || !containerRef.current || containerRef.current._leaflet_id) return;

      const Leaflet = L.default ?? L;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = Leaflet.map(containerRef.current, {
        center: [63.2, 15],
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      const { addMaskLayer } = await import("../components/map/maskLayer");
      await addMaskLayer(map, Leaflet);

      const markerIcon = Leaflet.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:var(--accent,#6675ff);border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      });

      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;

        // Flytt eller opprett markør
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Leaflet.marker([lat, lng], { icon: markerIcon }).addTo(map);
        }

        // Reverse geocode via Nominatim
        let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)" } }
          );
          const data = await res.json();
          if (data?.address) {
            name =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.municipality ||
              data.display_name?.split(",")[0] ||
              name;
          }
        } catch {
          // behold koordinat-navn som fallback
        }

        onLocationSelect({ lat, lon: lng, name });
      });

      mapRef.current = map;
      leafletRef.current = Leaflet;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, [onLocationSelect]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 280,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        marginBottom: "1.5rem",
        cursor: "crosshair",
      }}
    />
  );
}
