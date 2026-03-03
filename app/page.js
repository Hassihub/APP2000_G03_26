"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import {
  FiChevronDown,
  FiMap,
  FiSun,
  FiDroplet,
  FiHome,
} from "react-icons/fi";

/* TRANSLATIONS */
const translations = {
  no: {
    title: "Fritt Fram",
    searchPlaceholder: "Søk etter tur, sted eller aktivitet...",
    noResults: "Ingen resultater",
    todaysTrip: "Dagens tur",
    start: "Start",
  },
  en: {
    title: "Free Path",
    searchPlaceholder: "Search for trip, place or activity...",
    noResults: "No results",
    todaysTrip: "Today's trip",
    start: "Start",
  },
  fr: {
    title: "Chemin Libre",
    searchPlaceholder: "Rechercher une randonnée ou activité...",
    noResults: "Aucun résultat",
    todaysTrip: "Randonnée du jour",
    start: "Départ",
  },
  es: {
    title: "Camino Libre",
    searchPlaceholder: "Buscar ruta o actividad...",
    noResults: "Sin resultados",
    todaysTrip: "Ruta del día",
    start: "Inicio",
  },
  it: {
    title: "Percorso Libero",
    searchPlaceholder: "Cerca escursione o attività...",
    noResults: "Nessun risultato",
    todaysTrip: "Escursione del giorno",
    start: "Partenza",
  },
};

export default function Home() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("no");
  const [theme, setTheme] = useState("light");

  /* HENT LAGREDE INNSTILLINGER */
  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    const savedTheme = localStorage.getItem("theme");

    if (savedLang) setLanguage(savedLang);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  /* OPPDATER BODY THEME */
  useEffect(() => {
    document.body.style.backgroundColor =
      theme === "dark" ? "#121212" : "#ffffff";
    document.body.style.color = theme === "dark" ? "#ffffff" : "#000000";
  }, [theme]);

  const t = translations[language];

  const locations = [
    { name: "Foss", link: "/explore" },
    { name: "Fjelltur", link: "/explore" },
    { name: "Fjellheimen", link: "/explore" },
    { name: "Galdhøpiggen", link: "/explore" },
    { name: "Gaustatoppen", link: "/explore" },
    { name: "Hardangervidda", link: "/explore" },
    { name: "Hytte", link: "/reserver" },
    { name: "Padletur", link: "/explore" },
    { name: "Preikestolen", link: "/explore" },
    { name: "Skitur", link: "/explore" },
    { name: "Trolltunga", link: "/explore" },
  ];

  const filteredResults = locations.filter((item) =>
    item.name.toLowerCase().startsWith(search.toLowerCase())
  );

  const scrollToNext = () => {
    const nextSection = document.getElementById("recommended-section");
    if (nextSection) nextSection.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        fontFamily: "'Inter', sans-serif",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
      }}
    >
      {/* VIDEO */}
      <div style={{ position: "relative", height: "100vh" }}>
        <video
          autoPlay
          loop
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
          }}
        >
          <source src="/images/Natur.mp4" type="video/mp4" />
        </video>

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,50,20,0.35)",
          }}
        />

        {/* HERO */}
        <section
          style={{
            height: "100vh",
            scrollSnapAlign: "start",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: "4rem",
              fontWeight: 700,
              marginBottom: "2rem",
              textShadow: "2px 2px 10px rgba(0,0,0,0.7)",
            }}
          >
            {t.title}
          </h1>

          {/* IKONER */}
          <div
            style={{
              display: "flex",
              gap: "3rem",
              marginBottom: "2.5rem",
            }}
          >
            <Category icon={<FiMap size={42} />} label="Fjelltur" link="/explore" />
            <Category icon={<FiSun size={42} />} label="Skitur" link="/explore" />
            <Category icon={<FiDroplet size={42} />} label="Padletur" link="/explore" />
            <Category icon={<FiHome size={42} />} label="Hytte" link="/reserver" />
          </div>

          {/* SØK */}
          <div style={{ width: "100%", maxWidth: "600px", position: "relative" }}>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "1rem 1.5rem",
                borderRadius: "40px",
                border: "none",
                fontSize: "1.1rem",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                outline: "none",
              }}
            />

            {search && (
              <div
                style={{
                  marginTop: "0.8rem",
                  background: "#0f1f17",
                  borderRadius: "4px",
                  border: "2px solid #2e5c44",
                  overflow: "hidden",
                  textAlign: "left",
                }}
              >
                {filteredResults.length > 0 ? (
                  filteredResults.map((item, index) => (
                    <Link
                      key={index}
                      href={item.link}
                      style={{
                        display: "block",
                        padding: "1rem",
                        borderBottom: "1px solid #1e3c2f",
                        color: "#fff",
                        textDecoration: "none",
                      }}
                    >
                      {item.name}
                    </Link>
                  ))
                ) : (
                  <div style={{ padding: "1rem", color: "#aaa" }}>
                    {t.noResults}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SCROLL PIL */}
          <button
            onClick={scrollToNext}
            style={{
              marginTop: "3rem",
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              animation: "bounce 1.5s infinite",
            }}
          >
            <FiChevronDown size={50} />
          </button>

          <style jsx>{`
            @keyframes bounce {
              0%,20%,50%,80%,100% { transform: translateY(0); }
              40% { transform: translateY(10px); }
              60% { transform: translateY(5px); }
            }
          `}</style>
        </section>
      </div>

      {/* DAGENS TUR */}
      <section
        id="recommended-section"
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to right, #1e3c2f, #16261d)",
          padding: "4rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1200px",
            display: "flex",
            gap: "4rem",
            alignItems: "center",
            color: "#fff",
          }}
        >
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: "1rem", opacity: 0.8 }}>
              {t.todaysTrip}
            </h2>

            <Image
              src="/images/Galdhøpiggen.jpg"
              alt="Kart"
              width={600}
              height={450}
              style={{
                borderRadius: "20px",
                boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
                objectFit: "cover",
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
              Galdhøpiggen
            </h1>

            <p>📍 {t.start}: Juvasshytta</p>
            <p>⛰️ 2469 moh</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* IKON KOMPONENT */
function Category({ icon, label, link }) {
  return (
    <Link href={link} style={{ textDecoration: "none", color: "#fff" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {icon}
        <span style={{ marginTop: "0.5rem", fontWeight: 600 }}>
          {label}
        </span>
      </div>
    </Link>
  );
}