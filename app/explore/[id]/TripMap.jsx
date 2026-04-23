"use client";

import { useEffect, useRef } from "react";

export default function TripMap({ geometry, cabins = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!geometry?.coordinates?.length || !containerRef.current || mapRef.current) return;

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

      // Unngå "Map container is already initialized" (React Strict Mode kjører useEffect to ganger)
      if (containerRef.current._leaflet_id) return;

      const latLngs = geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      const map = Leaflet.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: false,
      });

      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      // Maskelaget — addMaskLayer kaller fitBounds til Utopia, så vi re-fitter til ruten etterpå
      const { addMaskLayer } = await import("../../components/map/maskLayer");
      await addMaskLayer(map, Leaflet);

      // Tegn ruten og fit til den (overskriver maskLayer sin fitBounds)
      const line = Leaflet.polyline(latLngs, { color: "#ff4d4d", weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });

      // Start-markør med label
      const startIcon = Leaflet.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="background:#065f46;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">Start</div>
            <div style="width:10px;height:10px;background:#065f46;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
          </div>`,
        iconAnchor: [18, 24],
      });

      // Slutt-markør med label
      const endIcon = Leaflet.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="background:#b91c1c;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">Slutt</div>
            <div style="width:10px;height:10px;background:#b91c1c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
          </div>`,
        iconAnchor: [18, 24],
      });

      Leaflet.marker(latLngs[0], { icon: startIcon }).addTo(map);
      Leaflet.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(map);

      // Hyttemarkører
      cabins.forEach((cabin) => {
        const lat = parseFloat(cabin.latitude);
        const lng = parseFloat(cabin.longitude);
        if (!lat || !lng) return;

        const cabinIcon = Leaflet.divIcon({
          className: "",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);max-width:120px;overflow:hidden;text-overflow:ellipsis">${cabin.name}</div>
              <div style="width:12px;height:12px;background:#7c3aed;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
            </div>`,
          iconAnchor: [30, 28],
        });

        Leaflet.marker([lat, lng], { icon: cabinIcon })
          .bindPopup(`<b>${cabin.name}</b><br>${cabin.location ?? ""}`)
          .addTo(map);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geometry]);

  if (!geometry?.coordinates?.length) return null;

  return (
    <div
      ref={containerRef}
      style={{
        height: 260,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        marginTop: "0.75rem",
      }}
    />
  );
}
