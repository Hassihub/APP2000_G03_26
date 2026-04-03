"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FiSearch,
  FiSettings,
  FiHome,
  FiMenu,
  FiChevronLeft,
  FiUser,
} from "react-icons/fi";

const translations = {
  no: {
    search: "Søk",
    explore: "Utforsk",
    reserve: "Reserver",
    map: "Kart",
    weather: "Vær",
    social: "Sosial",
    navigate: "Naviger",
    home: "Hjem",
  },
  en: {
    search: "Search",
    explore: "Explore",
    reserve: "Reserve",
    map: "Map",
    weather: "Weather",
    social: "Social",
    navigate: "Navigate",
    home: "Home",
  },
  fr: {
    search: "Recherche",
    explore: "Explorer",
    reserve: "Réserver",
    map: "Carte",
    weather: "Météo",
    social: "Social",
    navigate: "Naviguer",
    home: "Accueil",
  },
  es: {
    search: "Buscar",
    explore: "Explorar",
    reserve: "Reservar",
    map: "Mapa",
    weather: "Clima",
    social: "Social",
    navigate: "Navegar",
    home: "Inicio",
  },
  it: {
    search: "Cerca",
    explore: "Esplora",
    reserve: "Prenota",
    map: "Mappa",
    weather: "Meteo",
    social: "Social",
    navigate: "Naviga",
    home: "Home",
  },
};

const flags = { no: "🇳🇴", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹" };

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("no");
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();
  const pathname = usePathname();

  const pages = [
    { nameKey: "explore", href: "/explore" },
    { nameKey: "reserve", href: "/reserver" },
    { nameKey: "map", href: "/map" },
    { nameKey: "weather", href: "/vaer" },
    { nameKey: "social", href: "/sosial" },
  ];

  const languages = ["no", "en", "fr", "es", "it"];

  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    if (savedLang) setLanguage(savedLang);
  }, []);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    if (pathname === "/") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname]);

  const handleSearch = () => {
    if (searchQuery.trim() !== "") {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  return (
    <header
      style={{
        width: "100%",
        maxWidth: "100vw",
        overflowX: "hidden",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        boxSizing: "border-box",
      }}
    >
      {/* Venstre: Hjem + søkefelt */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <FiHome size={28} style={{ cursor: "pointer" }} />
        </Link>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            placeholder={translations[language].search}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            style={{
              padding: "0.5rem 2.5rem 0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "1rem",
              outline: "none",
              width: "220px",
            }}
          />

          <FiSearch
            size={18}
            onClick={handleSearch}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
              color: "#555",
            }}
          />
        </div>
      </div>

      {/* Høyre: Hamburger + ikoner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          position: "relative",
        }}
      >
        {/* Hamburger */}
        <div style={{ position: "relative" }}>
          <FiMenu
            size={28}
            style={{ cursor: "pointer" }}
            onClick={() => setOpen(!open)}
          />

          {open && (
            <>
              <div
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  zIndex: 1500,
                }}
              />

              <div
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
                <div
                  style={{
                    padding: "2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <FiChevronLeft
                    size={28}
                    style={{ cursor: "pointer" }}
                    onClick={() => setOpen(false)}
                  />
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {translations[language].navigate}
                  </h2>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "0 2rem",
                  }}
                >
                  {pages.map((p) => (
                    <Link
                      key={p.nameKey}
                      href={p.href}
                      style={{
                        padding: "1rem 0",
                        textDecoration: "none",
                        color: "#333",
                        fontWeight: 600,
                      }}
                      onClick={() => setOpen(false)}
                    >
                      {translations[language][p.nameKey]}
                    </Link>
                  ))}
                </div>

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
                      onClick={() => setLanguage(lang)}
                      style={{
                        padding: "0.5rem 0.8rem",
                        borderRadius: "4px",
                        border:
                          language === lang
                            ? "2px solid #333"
                            : "1px solid #ccc",
                        background:
                          language === lang ? "#f0f0f0" : "#fff",
                        cursor: "pointer",
                        fontSize: "1.2rem",
                      }}
                    >
                      {flags[lang]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Ikoner */}
        <Link href="/profile">
          <FiUser size={24} />
        </Link>

        <Link href="/search">
          <FiSearch size={24} />
        </Link>

        <Link href="/settings">
          <FiSettings size={24} />
        </Link>
      </div>
    </header>
  );
}