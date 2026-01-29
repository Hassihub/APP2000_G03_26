// app/components/map/maskLayer.js
export async function addMaskLayer(map, L) {
  const res = await fetch("/geojson/norway.geojson");
  const norwayGeoJSON = await res.json();

  // Ytterring for hele verden
  const worldRing = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
  ];

  // Hull for Norge
  const holes = [];
  norwayGeoJSON.features.forEach((f) => {
    if (f.geometry.type === "Polygon") holes.push(f.geometry.coordinates[0]);
    else if (f.geometry.type === "MultiPolygon")
      f.geometry.coordinates.forEach((poly) => holes.push(poly[0]));
  });

  const mask = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [worldRing, ...holes],
    },
  };

  L.geoJSON(mask, {
    interactive: false,
    style: { fillColor: "#1e3a5f", fillOpacity: 1, color: "transparent" },
  }).addTo(map);

  // Zoom til Norge
  const norwayLayer = L.geoJSON(norwayGeoJSON);
  map.fitBounds(norwayLayer.getBounds(), { padding: [50, 50] });
}
