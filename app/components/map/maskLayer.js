/**
 * app/components/map/maskLayer.js
 *
 * Author: Hasnain Malik
 *
 * Legger til et maskelag over kartet som skjuler alt utenfor Utopia.
 * Effekten lages ved å tegne et verdensdekkende polygon med et hull
 * der Utopia (Norge) befinner seg – alt utenfor dekkes av en mørk overlay.
 */

// Henter GeoJSON-grensedata for Utopia og legger til maskelaget på kartet
export async function addMaskLayer(map, L) {
  // Last ned GeoJSON-filen som definerer grensen til Utopia
  const res = await fetch("/geojson/norway.geojson");
  const norwayGeoJSON = await res.json();

  // Ytterring som dekker hele verden (brukes som bakgrunn for masken)
  const worldRing = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
  ];

  // Samle inn alle polygon-ringer fra Utopia-GeoJSON som hull i masken
  const holes = [];
  norwayGeoJSON.features.forEach((f) => {
    // Enkel polygon – ta første ring (ytre grense)
    if (f.geometry.type === "Polygon") holes.push(f.geometry.coordinates[0]);
    // MultiPolygon – ta første ring fra hvert delpolygon
    else if (f.geometry.type === "MultiPolygon")
      f.geometry.coordinates.forEach((poly) => holes.push(poly[0]));
  });

  // Bygg maskepolygon: verden som ytre ring, Utopia-grenser som hull
  // Dette gjør at kun Utopia vises, resten dekkes av mørk farge
  const mask = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [worldRing, ...holes],
    },
  };

  // Tegn maskelaget på kartet – ikke-interaktivt, mørk navy-farge
  L.geoJSON(mask, {
    interactive: false,
    style: { fillColor: "#1e3a5f", fillOpacity: 1, color: "transparent" },
  }).addTo(map);

  // Zoom/sentrér kartet automatisk til Utopia-grensene ved oppstart
  const norwayLayer = L.geoJSON(norwayGeoJSON);
  map.fitBounds(norwayLayer.getBounds(), { padding: [50, 50] });
}
