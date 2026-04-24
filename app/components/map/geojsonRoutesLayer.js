/**
 * app/components/map/geojsonRoutesLayer.js
 *
 * Author: Hasnain Malik
 *
 * Håndterer dynamisk lasting og visning av GeoJSON-ruter på kartet.
 * Rutene lastes kun når zoomnivået er høyt nok (≥ 11), og kun de
 * rutekategoriene brukeren har skrudd på vises.
 *
 * Kategorier:
 *   - annenrute    → andre ruter (oransje)
 *   - skiløype     → skiløyper (blå)
 *   - sykkelrute   → sykkelruter (grønn)
 *   - ruteinfopunkt → informasjonspunkter langs ruter (rød)
 */

// Minimalt zoomnivå for at rutene skal vises – hindrer kaos ved oversiktszoom
const ZOOM_THRESHOLD = 11;

/**
 * Aktiverer dynamisk GeoJSON-rutevisning på kartet.
 *
 * @param {L.Map} map - Leaflet-kartobjektet
 * @param {L} L - Leaflet-biblioteket
 * @param {Function} getEnabledMap - Funksjon som returnerer hvilke lag som er på/av,
 *   f.eks. { annenrute: true, skiløype: false, sykkelrute: true, ruteinfopunkt: false }
 * @returns {Function} cleanup-funksjon – kall denne for å fjerne alle lag og lyttere
 */
export function enableGeojsonRoutes(map, L, getEnabledMap) {
  // Definerer alle tilgjengelige GeoJSON-lag med fil-URL, type og farge
  const files = [
    {
      id: "annenrute",
      url: "/geojson/annenrute.geojson",
      type: "line",      // Linjetype → tegnes som L.geoJSON med style
      color: "#ff7f0e",  // Oransje
    },
    {
      id: "skiløype",
      url: "/geojson/skiløype.geojson",
      type: "line",
      color: "#1f77b4",  // Blå
    },
    {
      id: "sykkelrute",
      url: "/geojson/sykkelrute.geojson",
      type: "line",
      color: "#2ca02c",  // Grønn
    },
    {
      id: "ruteinfopunkt",
      url: "/geojson/ruteinfopunkt.geojson",
      type: "point",     // Punkttype → tegnes som circleMarker
      color: "#d62728",  // Rød
    },
  ];

  // Lagrer allerede opprettede Leaflet-lag per ID (unngår å laste samme fil flere ganger)
  const layersById = {};
  // Holder styr på hvilke filer som er lastet fra serveren
  const loadedById = {};

  // Laster GeoJSON-data fra server og oppretter Leaflet-lag – kjøres maks én gang per fil
  async function ensureLayerLoaded(file) {
    if (loadedById[file.id]) return; // Allerede lastet, ikke last på nytt
    loadedById[file.id] = true;

    try {
      const res = await fetch(file.url);
      if (!res.ok) return;
      const data = await res.json();

      let layer;
      if (file.type === "line") {
        // Linjetype: tegn som GeoJSON-lag med farge og tykkelse
        layer = L.geoJSON(data, {
          style: { color: file.color, weight: 3 },
        });
      } else {
        // Punkttype: tegn hvert punkt som en farget sirkelmarkør
        layer = L.geoJSON(data, {
          pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, {
              radius: 5,
              color: file.color,
              fillColor: file.color,
              fillOpacity: 0.8,
            }),
        });
      }

      layersById[file.id] = layer;
    } catch (e) {
      console.error("Kunne ikke laste", file.url, e);
    }
  }

  // Legger et ferdig-lastet lag til kartet (hvis det ikke allerede er der)
  function addLayerToMap(id) {
    const layer = layersById[id];
    if (layer && !map.hasLayer(layer)) {
      layer.addTo(map);
    }
  }

  // Fjerner et lag fra kartet (hvis det er synlig)
  function removeLayerFromMap(id) {
    const layer = layersById[id];
    if (layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  }

  // Oppdaterer hvilke lag som er synlige basert på toggles og zoomnivå.
  // Kalles ved kartbevegelse (moveend) og ved initialisering.
  async function updateVisibility() {
    const enabledMap = getEnabledMap ? getEnabledMap() : {};
    const zoomOk = map.getZoom() >= ZOOM_THRESHOLD; // Sjekk at zoom er høy nok

    for (const file of files) {
      // Et lag skal vises kun hvis brukeren har skrudd det på OG zoom er tilstrekkelig
      const shouldShow = !!enabledMap[file.id] && zoomOk;

      if (shouldShow) {
        await ensureLayerLoaded(file); // Last fil hvis ikke allerede gjort
        addLayerToMap(file.id);
      } else {
        removeLayerFromMap(file.id);
      }
    }
  }

  // Lytt på kartbevegelser slik at synlighet oppdateres ved zoom/pan
  map.on("moveend", updateVisibility);

  // Kjør synlighetssjekk umiddelbart ved oppstart
  updateVisibility();

  // Returnerer en cleanup-funksjon som fjerner lyttere og alle GeoJSON-lag
  return () => {
    map.off("moveend", updateVisibility);
    Object.keys(layersById).forEach((id) => {
      removeLayerFromMap(id);
    });
  };
}
