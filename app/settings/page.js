"use client";

import { useTranslations } from "../components/LanguageProvider";

export default function Settings() {
  const t = useTranslations("settingsPage");

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{t.title}</h1>
      <p>{t.description}</p>
    </div>
  );
}
