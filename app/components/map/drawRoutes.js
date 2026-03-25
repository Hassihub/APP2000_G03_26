import L from "leaflet";

export function enableRouteDrawing(map, L, onRouteFinished, getPlacing) {
  let points = [];
  let markers = [];
  let routeLine = null;
  let routeRequestId = 0; // brukes for å ignorere utdaterte rute-svar

  // 🔹 Start-pin
  const firstIcon = L.icon({
    iconUrl: "/images/pinStart.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // 🔹 Øvrige pins
  const otherIcon = L.icon({
    iconUrl: "/images/pinEnd.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // 🔄 Sørger for at første marker alltid har riktig ikon
  function updateMarkerIcons() {
    markers.forEach((marker, index) => {
      marker.setIcon(index === 0 ? firstIcon : otherIcon);
    });
  }

  map.on("click", async (e) => {
    if (getPlacing && !getPlacing()) return;

    const { lat, lng } = e.latlng;
    points.push([lat, lng]);

    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: markers.length === 0 ? firstIcon : otherIcon,
    }).addTo(map);

    markers.push(marker);

    updateMarkerIcons();

    marker.on("click", () => {
      map.removeLayer(marker);
      markers = markers.filter((m) => m !== marker);
      points = markers.map((m) => [
        m.getLatLng().lat,
        m.getLatLng().lng,
      ]);

      updateMarkerIcons();
      // Hvis alle pins er fjernet, sørg for at ruten også forsvinner
      if (markers.length === 0) {
        // Invalider alle pågående rute-forespørsler
        routeRequestId++;
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

    marker.on("dragend", () => {
      points = markers.map((m) => [
        m.getLatLng().lat,
        m.getLatLng().lng,
      ]);
      redrawRoute();
    });

    if (points.length >= 2) await redrawRoute();
  });

  async function redrawRoute() {
    // Nyeste rute-forespørsel får et eget id
    const requestId = ++routeRequestId;

    if (routeLine) map.removeLayer(routeLine);
    if (points.length < 2) {
      // Mindre enn to punkter betyr at vi ikke har noen gyldig rute
      if (onRouteFinished) {
        onRouteFinished({ points, geometry: null });
      }
      return;
    }

    const coordsStr = points
      .map((p) => `${p[1]},${p[0]}`)
      .join(";");

    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;

      // Hvis en nyere forespørsel har blitt gjort siden denne startet,
      // eller vi ikke lenger har en gyldig rute, gjør ingenting
      if (requestId !== routeRequestId || points.length < 2) {
        return;
      }

      const geometry = data.routes[0].geometry;
      routeLine = L.geoJSON(geometry, {
        style: { color: "#ff4d4d", weight: 4 },
      }).addTo(map);

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
