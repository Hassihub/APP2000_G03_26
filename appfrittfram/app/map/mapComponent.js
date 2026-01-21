"use client";

import { useEffect, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import Polygon from "ol/geom/Polygon";
import Feature from "ol/Feature";
import { fromLonLat } from "ol/proj";

export default function MapComponent() {
  const [map, setMap] = useState(null);
  const [layers, setLayers] = useState({});

  useEffect(() => {
    const baseLayer = new TileLayer({ source: new OSM() });

    const mapInstance = new Map({
      target: "map",
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([10, 63]),
        zoom: 4,
        minZoom: 4,
        maxZoom: 18,
      }),
    });

    setMap(mapInstance);

    const newLayers = {};

    // --- 1️⃣ Masken for resten av verden utenom Norge ---
    fetch("/norway.geojson")
      .then((res) => res.json())
      .then((norwayGeoJSON) => {
        const geojsonFormat = new GeoJSON();
        const norwayFeatures = geojsonFormat.readFeatures(norwayGeoJSON, {
          featureProjection: "EPSG:3857",
        });

        // Hele verden polygon
        const worldRing = [
          fromLonLat([-180, -90]),
          fromLonLat([-180, 90]),
          fromLonLat([180, 90]),
          fromLonLat([180, -90]),
          fromLonLat([-180, -90]),
        ];

        // Hull = alle Norge polygons
        const holes = norwayFeatures.flatMap((f) => {
          const geom = f.getGeometry();
          if (geom.getType() === "Polygon") return [geom.getCoordinates()[0]];
          if (geom.getType() === "MultiPolygon") return geom.getCoordinates().map((p) => p[0]);
          return [];
        });

        const maskPolygon = new Polygon([worldRing, ...holes]);
        const maskFeature = new Feature(maskPolygon);

        const maskLayer = new VectorLayer({
          source: new VectorSource({ features: [maskFeature] }),
          style: new Style({
            fill: new Fill({ color: "rgb(60, 125, 190, 1)" }), // 🔵 Blå maske
          }),
        });

        mapInstance.addLayer(maskLayer);
        newLayers["mask"] = maskLayer;

        // Lås kartet til Norge
        mapInstance.getView().fit(maskPolygon, {
          padding: [50, 50, 50, 50],
        });

        setLayers({ ...newLayers });
      });

    // --- 2️⃣ Alle ruter ---
    const routeFiles = [
      { name: "annenrute", url: "/annenrute.geojson", color: "orange" },
      { name: "fotrute", url: "/fotrute.geojson", color: "green" },
      { name: "skiløype", url: "/skiløype.geojson", color: "blue" },
      { name: "sykkelrute", url: "/sykkelrute.geojson", color: "purple" },
    ];

    routeFiles.forEach((route) => {
      fetch(route.url)
        .then((res) => res.json())
        .then((geojsonData) => {
          const vectorSource = new VectorSource({
            features: new GeoJSON({ featureProjection: "EPSG:3857" }).readFeatures(geojsonData),
          });

          const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: new Style({
              stroke: new Stroke({ color: route.color, width: 4 }),
              image: new CircleStyle({ radius: 5, fill: new Fill({ color: route.color }) }),
            }),
          });

          mapInstance.addLayer(vectorLayer);
          newLayers[route.name] = vectorLayer;
          setLayers({ ...newLayers });
        });
    });

    // --- 3️⃣ Ruteinfopunkt ---
    fetch("/ruteinfopunkt.geojson")
      .then((res) => res.json())
      .then((geojsonData) => {
        const vectorSource = new VectorSource({
          features: new GeoJSON({ featureProjection: "EPSG:3857" }).readFeatures(geojsonData),
        });

        const pointLayer = new VectorLayer({
          source: vectorSource,
          style: new Style({
            image: new CircleStyle({ radius: 6, fill: new Fill({ color: "red" }), stroke: new Stroke({ color: "white", width: 2 }) }),
          }),
        });

        mapInstance.addLayer(pointLayer);
        newLayers["ruteinfopunkt"] = pointLayer;
        setLayers({ ...newLayers });
      });
  }, []);

  // --- Toggle funksjon ---
  const toggleLayer = (name) => {
    if (layers[name]) {
      layers[name].setVisible(!layers[name].getVisible());
    }
  };

  return (
    <>
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, background: "white", padding: "10px", borderRadius: "6px" }}>
        <h4>Lagvalg</h4>
        {["mask", "annenrute", "fotrute", "skiløype", "sykkelrute", "ruteinfopunkt"].map((name) => (
          <div key={name}>
            <input type="checkbox" defaultChecked onChange={() => toggleLayer(name)} /> {name}
          </div>
        ))}
      </div>
      <div id="map" style={{ width: "100%", height: "100vh" }} />
    </>
  );
}
