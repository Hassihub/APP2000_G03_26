"use client";

import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Style } from "ol/style";
import { fromLonLat, transformExtent } from "ol/proj";

export default function MapComponent() {
  const mapRef = useRef(null);

  useEffect(() => {
    /** 🇳🇴 Norges utstrekning */
    const norwayExtent = transformExtent(
      [4.5, 57.8, 31.5, 71.5],
      "EPSG:4326",
      "EPSG:3857"
    );

    /** 🌍 OSM bakgrunn */
    const osmLayer = new TileLayer({
      source: new XYZ({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      }),
    });

    /** ⬛ Maskelag (svart rundt Norge) */
    const maskLayer = new VectorLayer({
      source: new VectorSource({
        url: "/norway-mask.geojson",
        format: new GeoJSON(),
      }),
      style: new Style({
        fill: new Fill({
          color: "rgba(0, 0, 0, 0.6)",
        }),
      }),
    });

    /** 🗺️ Kart */
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, maskLayer],
      view: new View({
        center: fromLonLat([10.75, 59.91]), // Oslo
        zoom: 5,
        minZoom: 4,
        maxZoom: 8,
      }),
    });

    return () => map.setTarget(null);
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "700px",
        border: "1px solid #ccc",
      }}
    />
  );
}
