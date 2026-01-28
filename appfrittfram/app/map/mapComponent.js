"use client";

import { useEffect } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Polygon from "ol/geom/Polygon";
import Feature from "ol/Feature";
import Fill from "ol/style/Fill";
import Style from "ol/style/Style";
import { fromLonLat } from "ol/proj";

export default function MapComponent() {
  useEffect(() => {
    const baseLayer = new TileLayer({
      source: new OSM(),
    });

    const map = new Map({
      target: "map",
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([10, 63]),
        zoom: 4,
        minZoom: 4,               // ⭐ lås zoom
        maxZoom: 18,
      }),
    });

    fetch("/norway.geojson")
      .then((res) => res.json())
      .then((norwayGeoJSON) => {
        const geojsonFormat = new GeoJSON();

        const norwayFeatures = geojsonFormat.readFeatures(norwayGeoJSON, {
          featureProjection: "EPSG:3857",
        });

        // 🌍 Ytre polygon = hele verden
        const worldRing = [
          fromLonLat([-180, -90]),
          fromLonLat([-180, 90]),
          fromLonLat([180, 90]),
          fromLonLat([180, -90]),
          fromLonLat([-180, -90]),
        ];

        // 🇳🇴 Hull = alle polygoner i Norge
        const holes = norwayFeatures.flatMap((f) => {
          const geom = f.getGeometry();

          if (geom.getType() === "Polygon") {
            return [geom.getCoordinates()[0]];
          }

          if (geom.getType() === "MultiPolygon") {
            return geom.getCoordinates().map((p) => p[0]);
          }

          return [];
        });

        // ⭐ VERDEN med NORGE som hull
        const maskPolygon = new Polygon([worldRing, ...holes]);

        const maskFeature = new Feature(maskPolygon);

        const maskLayer = new VectorLayer({
          source: new VectorSource({
            features: [maskFeature],
          }),
          style: new Style({
            fill: new Fill({
              color: "rgb(60, 125, 190, 1)", // 🔵 BLÅ MASKE
            }),
          }),
        });

        map.addLayer(maskLayer);

        // 🔒 Lås kartet til Norge
        map.getView().fit(maskPolygon, {
          padding: [2000, 500, 50, 50],
          maxZoom: 1000000,
        });
      });
  }, []);

  return <div id="map" style={{ width: "100%", height: "100vh" }} />;
}
