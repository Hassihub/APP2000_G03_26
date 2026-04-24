/**
 * app/explore/[id]/TripMap.jsx
 *
 * Author: Hasnain Malik
 *
 * Viser et mini-kart for en enkelt tur på utforsk-siden.
 * Tegner turstien som en rød linje, og plasserer markører for
 * start- og sluttpunkt samt hytter langs ruten.
 *
 * Props:
 *   geometry  → GeoJSON LineString-objekt med rutekoordinater
 *   cabins    → liste med hytteobjekter (latitude, longitude, name, location)
 */
"use client";

import { useEffect, useRef } from "react";

export default function TripMap({ geometry, cabins = [] }) {
  const containerRef = useRef(null); // Referanse til div-elementet Leaflet bruker
  const mapRef = useRef(null);       // Lagrer Leaflet-kartobjektet mellom renders

  useEffect(() => {
    // Ikke initialiser hvis geometri mangler, DOM-noden ikke er klar, eller kartet allerede eksisterer
    if (!geometry?.coordinates?.length || !containerRef.current || mapRef.current) return;

    let cancelled = false;

    // Last Leaflet dynamisk (kun klient-side, ikke server-side rendering)
    import("leaflet").then(async (L) => {
      // Avbryt hvis komponenten er unmountet eller kartet allerede er initialisert
      if (cancelled || !containerRef.current || containerRef.current._leaflet_id) return;

      const Leaflet = L.default ?? L;

      // Legg til Leaflet CSS én gang – nødvendig for korrekt kartvisning
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Dobbel-sjekk mot React Strict Mode som kan kjøre useEffect to ganger
      if (containerRef.current._leaflet_id) return;

      // Konverter GeoJSON-koordinater fra [lon, lat] (GeoJSON-standard) til [lat, lon] (Leaflet-standard)
      const latLngs = geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      // Opprett kartet uten attribusjon – dette er et mini-kart uten overflødige kontroller
      const map = Leaflet.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // Deaktiver scroll-zoom for å unngå konflikt med sidescroll
        dragging: true,
        attributionControl: false,
      });

      // Legg til OpenStreetMap-bakgrunnskart
      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      // Legg til maskelaget (mørk overlay utenfor Utopia).
      // addMaskLayer kaller fitBounds internt, men vi overskriver det med rute-bounds etterpå.
      const { addMaskLayer } = await import("../../components/map/maskLayer");
      await addMaskLayer(map, Leaflet);

      // Tegn ruten som en rød linje og zoom kartet inn til rutens utstrekning
      const line = Leaflet.polyline(latLngs, { color: "#ff4d4d", weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });

      // Start-markør: grønn label med prikk, forankret under teksten
      const startIcon = Leaflet.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="background:#065f46;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">Start</div>
            <div style="width:10px;height:10px;background:#065f46;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
          </div>`,
        iconAnchor: [18, 24],
      });

      // Slutt-markør: rød label med prikk
      const endIcon = Leaflet.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="background:#b91c1c;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">Slutt</div>
            <div style="width:10px;height:10px;background:#b91c1c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
          </div>`,
        iconAnchor: [18, 24],
      });

      // Plasser start- og slutt-markører på første og siste koordinat i ruten
      Leaflet.marker(latLngs[0], { icon: startIcon }).addTo(map);
      Leaflet.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(map);

      // Plasser markører for hytter langs ruten med lilla farge og hyttenavn
      cabins.forEach((cabin) => {
        const lat = parseFloat(cabin.latitude);
        const lng = parseFloat(cabin.longitude);
        // Hopp over hytter uten gyldige koordinater
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

        // Legg til hytte-markør med popup som viser navn og sted
        Leaflet.marker([lat, lng], { icon: cabinIcon })
          .bindPopup(`<b>${cabin.name}</b><br>${cabin.location ?? ""}`)
          .addTo(map);
      });

      mapRef.current = map;
    });

    // Cleanup: fjern kartet og nullstill refs når komponenten unmountes
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geometry]); // Kjør på nytt kun hvis geometrien endres

  // Vis ingenting hvis det ikke finnes gyldig geometri
  if (!geometry?.coordinates?.length) return null;

  return (
    <div
      ref={containerRef}
      style={{
        height: 260,
        borderRadius: 10,
        overflow: "hidden",          // Skjul Leaflet-innhold utenfor avrundede hjørner
        border: "1px solid #e5e7eb",
        marginTop: "0.75rem",
      }}
    />
  );
}
