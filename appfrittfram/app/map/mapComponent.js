"use client";

import { useEffect } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Polygon from 'ol/geom/Polygon';
import Feature from 'ol/Feature';
import Fill from 'ol/style/Fill';
import Style from 'ol/style/Style';
import { fromLonLat } from 'ol/proj';

export default function MapComponent() {

  useEffect(() => {
    const baseLayer = new TileLayer({ source: new OSM() });

    const map = new Map({
      target: 'map',
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([10, 63]), // sentrum Norge
        zoom: 4
      })
    });

    // Hent hele Norge
    fetch('/norway.geojson')
      .then(res => res.json())
      .then(norwayGeoJSON => {

        const geojsonFormat = new GeoJSON();
        const norwayFeatures = geojsonFormat.readFeatures(norwayGeoJSON, {
          featureProjection: 'EPSG:3857'
        });

        // Hele verden som ytre polygon
        const worldCoords = [[
          [-180, -90],
          [-180, 90],
          [180, 90],
          [180, -90],
          [-180, -90]
        ]].map(ring => ring.map(c => fromLonLat(c)));

        // Hull = alle Norge-polygons fra GeoJSON
        const holes = norwayFeatures.flatMap(f => {
          const geom = f.getGeometry();
          if (geom.getType() === 'Polygon') {
            return [geom.getCoordinates()[0]]; // OBS: allerede i EPSG:3857
          } else if (geom.getType() === 'MultiPolygon') {
            return geom.getPolygons().map(p => p.getCoordinates()[0]);
          }
          return [];
        });

        // Lag Polygon med hull
        const maskPolygon = new Polygon([worldCoords[0], ...holes]);

        const maskFeature = new Feature(maskPolygon);

        const maskLayer = new VectorLayer({
          source: new VectorSource({ features: [maskFeature] }),
          style: new Style({
            fill: new Fill({ color: 'rgba(128,128,128,0.5)' })
          })
        });

        map.addLayer(maskLayer);

      });

  }, []);

  return <div id="map" style={{ width: '100%', height: '100vh' }}></div>;
}
