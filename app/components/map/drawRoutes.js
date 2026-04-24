/**
 * app/components/map/drawRoutes.js
 *
 * Author: Hasnain Malik
 *
 * Lar brukeren tegne en egendefinert rute på kartet ved å klikke på punkter.
 * Hvert klikk plasserer en pin, og OSRM-routing-API beregner en kjørbar rute
 * mellom alle punktene. Pins kan dras for å justere ruten, og klikk på en
 * pin fjerner den fra ruten.
 */

import L from "leaflet";

/**
 * Aktiverer rute-tegning på kartet.
 *
 * @param {L.Map} map - Leaflet-kartobjektet
 * @param {L} L - Leaflet-biblioteket
 * @param {Function} onRouteFinished - Callback med { points, geometry, distanceKm } etter beregning
 * @param {Function} getPlacing - Funksjon som returnerer true hvis bruker er i "plassér pin"-modus
 * @returns {Function} cleanup-funksjon som fjerner alle pins, ruten og klikk-lyttere
 */
export function enableRouteDrawing(map, L, onRouteFinished, getPlacing) {
  let points = [];    // Koordinater [lat, lng] for hvert plassert punkt
  let markers = [];   // Leaflet-markørobjekter som tilsvarer punktene
  let routeLine = null;       // Det tegnede GeoJSON-ruteobjektet på kartet
  let routeRequestId = 0;     // Brukes for å ignorere utdaterte rute-svar fra OSRM

  // Ikon for det første punktet (startpunkt) – grønn pin
  const firstIcon = L.icon({
    iconUrl: "/images/pinStart.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // Ikon for alle øvrige punkter (endepunkt/mellompunkter) – rød pin
  const otherIcon = L.icon({
    iconUrl: "/images/pinEnd.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // Sørger for at første markør alltid viser start-ikon og resten viser end-ikon
  function updateMarkerIcons() {
    markers.forEach((marker, index) => {
      marker.setIcon(index === 0 ? firstIcon : otherIcon);
    });
  }

  // Klikk på kartet: legg til nytt rutepunkt og beregn rute på nytt
  map.on("click", async (e) => {
    // Gjør ingenting hvis vi ikke er i "plassér pin"-modus
    if (getPlacing && !getPlacing()) return;

    const { lat, lng } = e.latlng;
    points.push([lat, lng]);

    // Opprett en draggbar markør på klikk-posisjonen
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: markers.length === 0 ? firstIcon : otherIcon,
    }).addTo(map);

    markers.push(marker);
    updateMarkerIcons();

    // Klikk på en eksisterende pin: fjern den og beregn ruten på nytt
    marker.on("click", () => {
      map.removeLayer(marker);
      markers = markers.filter((m) => m !== marker);
      // Synkroniser punktlisten med gjenværende markørposisjoner
      points = markers.map((m) => [
        m.getLatLng().lat,
        m.getLatLng().lng,
      ]);

      updateMarkerIcons();

      // Hvis alle pins er fjernet, fjern også ruten og nullstill data
      if (markers.length === 0) {
        routeRequestId++; // Invalider alle pågående OSRM-forespørsler
        if (routeLine) {
          map.removeLayer(routeLine);
          routeLine = null;
        }
        if (onRouteFinished) {
          onRouteFinished({ points: [], geometry: null });
        }
        return;
      }

      redrawRoute();
    });

    // Drag-end på en pin: oppdater koordinater og tegn ruten på nytt
    marker.on("dragend", () => {
      points = markers.map((m) => [
        m.getLatLng().lat,
        m.getLatLng().lng,
      ]);
      redrawRoute();
    });

    // Beregn rute så snart vi har minst to punkter
    if (points.length >= 2) await redrawRoute();
  });

  /**
   * Henter en kjørbar rute fra OSRM mellom alle plasserte punkter
   * og tegner den på kartet som en rød linje.
   */
  async function redrawRoute() {
    // Tildel nyeste forespørsel et unikt ID – brukes til å forkaste utdaterte svar
    const requestId = ++routeRequestId;

    // Fjern forrige rute-linje før vi tegner ny
    if (routeLine) map.removeLayer(routeLine);

    if (points.length < 2) {
      // For få punkter til å beregne en rute – nullstill
      if (onRouteFinished) {
        onRouteFinished({ points, geometry: null });
      }
      return;
    }

    // Bygg OSRM-URL: koordinater i format "lon,lat;lon,lat;..."
    const coordsStr = points
      .map((p) => `${p[1]},${p[0]}`)
      .join(";");

    // OSRM public routing API – driving-profil, full geometri i GeoJSON-format
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;

      // Forkast svaret hvis en nyere forespørsel er startet, eller vi har for få punkter
      if (requestId !== routeRequestId || points.length < 2) {
        return;
      }

      const route = data.routes[0];
      const geometry = route.geometry;
      // Regn ut lengde i km, avrundet til én desimal
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;

      // Tegn ruten på kartet som en rød GeoJSON-linje
      routeLine = L.geoJSON(geometry, {
        style: { color: "#ff4d4d", weight: 4 },
      }).addTo(map);

      // Send ferdig rute-data tilbake til foreldrekomponenten
      onRouteFinished({ points, geometry, distanceKm });
    } catch (err) {
      console.error("OSRM fetch error:", err);
    }
  }

  // Cleanup: fjern klikk-lytter, alle pins og rute-linjen fra kartet
  return () => {
    map.off("click");
    markers.forEach((m) => map.removeLayer(m));
    if (routeLine) map.removeLayer(routeLine);
  };
}
