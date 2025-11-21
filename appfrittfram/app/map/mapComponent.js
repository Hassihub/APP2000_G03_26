"use client";

import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";

export default function MapComponent() {
  const mapRef = useRef(null);

  useEffect(() => {
    // OSM kartdata
    const osmLayer = new TileLayer({
      source: new XYZ({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      }),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer],
      view: new View({
        center: fromLonLat([10.75, 59.91]), // Oslo
        zoom: 5,
        minZoom: 4,
        maxZoom: 18,
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
    ></div>
  );
}