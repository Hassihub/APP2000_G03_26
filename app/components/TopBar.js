"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FiSearch, FiSettings, FiLogIn, FiHome, FiMenu } from "react-icons/fi";

// Oversettelser
const translations = {
  no: {
    search: "Søk",
    explore: "Utforsk",
    reserve: "Reserver",
    map: "Kart",
    weather: "Vær",
    social: "Sosial",
    navigate: "Naviger",
  },
  en: {
    search: "Search",
    explore: "Explore",
    reserve: "Reserve",
    map: "Map",
    weather: "Weather",
    social: "Social",
    navigate: "Navigate",
  },
  fr: {
    search: "Recherche",
    explore: "Explorer",
    reserve: "Réserver",
    map: "Carte",
    weather: "Météo",
    social: "Social",
    navigate: "Naviguer",
  },
  es: {
    search: "Buscar",
    explore: "Explorar",
    reserve: "Reservar",
    map: "Mapa",
    weather: "Clima",
    social: "Social",
    navigate: "Navegar",
  },
  it: {
    search: "Cerca",
    explore: "Esplora",
    reserve: "Prenota",
    map: "Mappa",
    weather: "Meteo",
    social: "Social",
    navigate: "Naviga",
  },
};

// Flagg for språk
const flags = { no: "🇳🇴", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹" };

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("no");

  const pages = [
    { nameKey: "explore", href: "/explore" },
    { nameKey: "reserve", href: "/reserver" },
    { nameKey: "map", href: "/map" },
    { nameKey: "weather", href: "/vaer" },
    { nameKey: "social", href: "/sosial" },
  ];

  const languages = ["no", "en", "fr", "es", "it"];

  // Hent lagret språk ved load
  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    if (savedLang) setLanguage(savedLang);
  }, []);

  // Lagre språk i localStorage når det endres
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  return (
    <header
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Venstre: tom for å gi plass til midten */}
      <div style={{ width: "24px" }} />

      {/* Midten: Hjem-ikon */}
      <div style={{ display: "flex", justifyContent: "center", flex: 1 }}>
        <Link href="/">
          <FiHome size={28} title="Hjem" style={{ cursor: "pointer" }} />
        </Link>
      </div>

      {/* Høyre: Hamburger + ikoner */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
        {/* Hamburger-meny */}
        <div style={{ position: "relative" }}>
          <FiMenu
            size={28}
            title="Meny"
            style={{ cursor: "pointer" }}
            onClick={() => setOpen(!open)}
          />

          {open && (
            <div
              onMouseLeave={() => setOpen(false)}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "300px",
                backgroundColor: "#fff",
                borderLeft: "1px solid #ddd",
                boxShadow: "-5px 0 15px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                zIndex: 2000,
                overflowY: "auto",
              }}
            >
              {/* Øverst: Naviger */}
              <div style={{ padding: "2rem 2rem 1rem 2rem" }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#333" }}>
                  {translations[language].navigate}
                </h2>
              </div>

              {/* Midt: Menylenker */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0 2rem" }}>
                {pages.map((p) => (
                  <Link
                    key={p.nameKey}
                    href={p.href}
                    style={{
                      padding: "1rem 0",
                      textDecoration: "none",
                      color: "#333",
                      fontWeight: 600,
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    onClick={() => setOpen(false)}
                  >
                    {translations[language][p.nameKey]}
                  </Link>
                ))}
              </div>

              {/* Nederst: Språkvelger med flagg */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "1rem 0",
                  borderTop: "1px solid #eee",
                }}
              >
                {languages.map((lang) => (
                  <button
                    key={lang}
                    style={{
                      padding: "0.5rem 0.8rem",
                      borderRadius: "4px",
                      border: language === lang ? "2px solid #333" : "1px solid #ccc",
                      background: language === lang ? "#f0f0f0" : "#fff",
                      cursor: "pointer",
                      fontSize: "1.2rem",
                    }}
                    onClick={() => setLanguage(lang)}
                  >
                    {flags[lang]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ikoner: Søk, Innstillinger, Logg inn */}
        <Link href="/search" title={translations[language].search}>
          <FiSearch size={24} />
        </Link>
        <Link href="/settings" title="Innstillinger">
          <FiSettings size={24} />
        </Link>
        <Link href="/login" title="Logg inn">
          <FiLogIn size={24} />
        </Link>
      </div>
    </header>
  );
}