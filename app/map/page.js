"use client";

import MapComponent from "../components/map/mapComponent";
import { useTranslations } from "../components/LanguageProvider";

export default function MapPage() {
  const t = useTranslations("mapPage");

  return (
    <main style={{ padding: "1rem" }}>
      <h1>{t.title}</h1>
      <MapComponent />
    </main>
  );
}