// Laster inn GeoJSON-ruter dynamisk ved høy zoom

const ZOOM_THRESHOLD = 11; // bare vis ruter når man er ganske nærme

// getEnabledMap skal returnere et objekt, f.eks.:
// { annenrute: true/false, skiløype: true/false, sykkelrute: true/false, ruteinfopunkt: true/false }
export function enableGeojsonRoutes(map, L, getEnabledMap) {
  const files = [
    {
      id: "annenrute",
      url: "/geojson/annenrute.geojson",
      type: "line",
      color: "#ff7f0e",
    },
    {
      id: "skiløype",
      url: "/geojson/skiløype.geojson",
      type: "line",
      color: "#1f77b4",
    },
    {
      id: "sykkelrute",
      url: "/geojson/sykkelrute.geojson",
      type: "line",
      color: "#2ca02c",
    },
    {
      id: "ruteinfopunkt",
      url: "/geojson/ruteinfopunkt.geojson",
      type: "point",
      color: "#d62728",
    },
  ];

  const layersById = {};
  const loadedById = {};

  async function ensureLayerLoaded(file) {
    if (loadedById[file.id]) return;
    loadedById[file.id] = true;

    try {
      const res = await fetch(file.url);
      if (!res.ok) return;
      const data = await res.json();

      let layer;
      if (file.type === "line") {
        layer = L.geoJSON(data, {
          style: { color: file.color, weight: 3 },
        });
      } else {
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

  function addLayerToMap(id) {
    const layer = layersById[id];
    if (layer && !map.hasLayer(layer)) {
      layer.addTo(map);
    }
  }

  function removeLayerFromMap(id) {
    const layer = layersById[id];
    if (layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  }

  async function updateVisibility() {
    const enabledMap = getEnabledMap ? getEnabledMap() : {};
    const zoomOk = map.getZoom() >= ZOOM_THRESHOLD;

    for (const file of files) {
      const shouldShow = !!enabledMap[file.id] && zoomOk;

      if (shouldShow) {
        await ensureLayerLoaded(file);
        addLayerToMap(file.id);
      } else {
        removeLayerFromMap(file.id);
      }
    }
  }


  map.on("moveend", updateVisibility);

  // init
  updateVisibility();

  return () => {

    map.off("moveend", updateVisibility);
    Object.keys(layersById).forEach((id) => {
      removeLayerFromMap(id);
    });
  };
}
