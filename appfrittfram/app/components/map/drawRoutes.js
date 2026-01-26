export function enableRouteDrawing(map, L, onRouteFinished, getPlacing) {
  let points = [];
  let markers = [];
  let routeLine = null;

  const customIcon = L.icon({
    iconUrl: "/images/mapPin.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  map.on("click", async (e) => {
    if (getPlacing && !getPlacing()) return; // ⚡ sjekk dynamisk

    const { lat, lng } = e.latlng;
    points.push([lat, lng]);

    const marker = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(map);
    markers.push(marker);

    marker.on("click", () => {
      map.removeLayer(marker);
      markers = markers.filter((m) => m !== marker);
      points = markers.map((m) => [m.getLatLng().lat, m.getLatLng().lng]);
      redrawRoute();
    });

    marker.on("dragend", () => {
      points = markers.map((m) => [m.getLatLng().lat, m.getLatLng().lng]);
      redrawRoute();
    });

    if (points.length >= 2) await redrawRoute();
  });

  async function redrawRoute() {
    if (routeLine) map.removeLayer(routeLine);
    if (points.length < 2) return;

    const coordsStr = points.map((p) => `${p[1]},${p[0]}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;

      const geometry = data.routes[0].geometry;
      routeLine = L.geoJSON(geometry, { style: { color: "#ff4d4d", weight: 4 } }).addTo(map);

      onRouteFinished({ points, geometry });
    } catch (err) {
      console.error("OSRM fetch error:", err);
    }
  }

  return () => {
    map.off("click");
    markers.forEach((m) => map.removeLayer(m));
    if (routeLine) map.removeLayer(routeLine);
  };
}
