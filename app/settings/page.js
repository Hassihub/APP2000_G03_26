"use client";

import { useState, useEffect } from "react";

const translations = {
  no: {
    settings: "Innstillinger",
    language: "Språk",
    theme: "Tema",
    chooseLanguage: "Velg språk for appen.",
    chooseTheme: "Velg mørk eller lys modus.",
    light: "Light",
    dark: "Dark",
  },
  en: {
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    chooseLanguage: "Select the app language.",
    chooseTheme: "Select dark or light mode.",
    light: "Light",
    dark: "Dark",
  },
  fr: {
    settings: "Paramètres",
    language: "Langue",
    theme: "Thème",
    chooseLanguage: "Choisissez la langue de l'application.",
    chooseTheme: "Choisissez le mode clair ou sombre.",
    light: "Clair",
    dark: "Sombre",
  },
  es: {
    settings: "Configuración",
    language: "Idioma",
    theme: "Tema",
    chooseLanguage: "Seleccione el idioma de la aplicación.",
    chooseTheme: "Seleccione modo claro u oscuro.",
    light: "Claro",
    dark: "Oscuro",
  },
  it: {
    settings: "Impostazioni",
    language: "Lingua",
    theme: "Tema",
    chooseLanguage: "Seleziona la lingua dell'app.",
    chooseTheme: "Seleziona modalità chiara o scura.",
    light: "Chiaro",
    dark: "Scuro",
  },
};

export default function SettingsPage() {
  const [language, setLanguage] = useState("no");
  const [theme, setTheme] = useState("light");

  // Hent lagrede innstillinger fra localStorage når komponenten mountes
  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    const savedTheme = localStorage.getItem("theme");

    if (savedLang) setLanguage(savedLang);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // Oppdater theme og lagre i localStorage
  useEffect(() => {
    document.body.style.backgroundColor = theme === "dark" ? "#121212" : "#f8f8f8";
    document.body.style.color = theme === "dark" ? "#fff" : "#111";
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Lagre språkvalg i localStorage
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const t = translations[language]; // oversettelser basert på valgt språk

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "'Inter', sans-serif",
        backgroundColor: theme === "dark" ? "#121212" : "#f8f8f8",
        color: theme === "dark" ? "#fff" : "#111",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "2rem" }}>{t.settings}</h1>

      {/* Språk */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{t.language}</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {["no", "en", "fr", "es", "it"].map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                border: language === lang ? "2px solid #0070f3" : "1px solid #ccc",
                backgroundColor: language === lang ? "#0070f3" : theme === "dark" ? "#222" : "#eee",
                color: language === lang ? "#fff" : theme === "dark" ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: theme === "dark" ? "#aaa" : "#555" }}>
          {t.chooseLanguage}
        </p>
      </section>

      {/* Dark / Light mode */}
      <section>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>{t.theme}</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setTheme("light")}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              border: theme === "light" ? "2px solid #0070f3" : "1px solid #ccc",
              backgroundColor: theme === "light" ? "#fff" : "#eee",
              color: "#111",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {t.light}
          </button>
          <button
            onClick={() => setTheme("dark")}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              border: theme === "dark" ? "2px solid #0070f3" : "1px solid #ccc",
              backgroundColor: theme === "dark" ? "#222" : "#eee",
              color: theme === "dark" ? "#fff" : "#111",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {t.dark}
          </button>
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: theme === "dark" ? "#aaa" : "#555" }}>
          {t.chooseTheme}
        </p>
      </section>
    </div>
  );
}