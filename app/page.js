"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import {
  FiChevronDown,
  FiSun,
  FiGlobe,
  FiMap,
  FiUsers,
  FiHome,
  FiClock,
  FiTrendingUp,
  FiMapPin,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

const translations = {
  no: {
    title: "Fritt Fram",
    subtitle: "Oppdag nye stier, pust inn fjelluften og finn ditt neste eventyr",
    searchPlaceholder: "Søk etter tur, sted eller aktivitet...",
    noResults: "Ingen resultater",
    todaysTrip: "Dagens tur",
    popularRoutes: "Populære turer",
    cabinSuggestions: "Hytteforslag",
    start: "Start",
  },
  en: {
    title: "Free Path",
    subtitle: "Discover new trails, breathe the mountain air and find your next adventure",
    searchPlaceholder: "Search for trip, place or activity...",
    noResults: "No results",
    todaysTrip: "Today's trip",
    popularRoutes: "Popular routes",
    cabinSuggestions: "Cabin suggestions",
    start: "Start",
  },
};

export default function Home() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("no");
  const [theme, setTheme] = useState("light");
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const savedLang = localStorage.getItem("language");
    const savedTheme = localStorage.getItem("theme");

    if (savedLang) setLanguage(savedLang);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor =
      theme === "dark" ? "#121212" : "#ffffff";
    document.body.style.color = theme === "dark" ? "#ffffff" : "#000000";
    document.body.style.overflowX = "hidden";
  }, [theme]);

  const t = translations[language];

  const locations = [
    { name: "Foss", link: "/explore" },
    { name: "Fjelltur", link: "/explore" },
    { name: "Galdhøpiggen", link: "/explore" },
    { name: "Gaustatoppen", link: "/explore" },
    { name: "Hardangervidda", link: "/explore" },
    { name: "Hytte", link: "/reserver" },
    { name: "Preikestolen", link: "/explore" },
    { name: "Trolltunga", link: "/explore" },
  ];

  const filteredResults = locations.filter((item) =>
    item.name.toLowerCase().startsWith(search.toLowerCase())
  );

  const scrollToNext = () => {
    const nextSection = document.getElementById("recommended-section");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const slides = [
    {
      category: t.todaysTrip,
      title: "Galdhøpiggen",
      img: "/images/Galdhopiggen.jpg",
      start: "Juvasshytta",
      difficulty: "Middels",
      duration: "5-7 timer",
      link: "/reserver",
    },
    {
      category: t.popularRoutes,
      title: "Populære turer",
      img: "/images/fjell.jpg",
      start: "Ulike startpunkter",
      difficulty: "Variert",
      duration: "3-8 timer",
      link: "/explore",
    },
    {
      category: t.cabinSuggestions,
      title: "Hytteforslag",
      img: "/images/hytte.jpg",
      start: "Flere lokasjoner",
      difficulty: "Enkel",
      duration: "Helgetur",
      link: "/reserver",
    },
  ];

  const prevSlide = () =>
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        fontFamily: "'Inter', sans-serif",
        overflowY: "scroll",
        overflowX: "hidden",
        scrollSnapType: "y mandatory",
      }}
    >
      {/* HERO VIDEO */}
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
              marginBottom: "1rem",
              textShadow: "2px 2px 10px rgba(0,0,0,0.7)",
            }}
          >
            {t.title}
          </h1>

          <p
            style={{
              fontSize: "1.4rem",
              maxWidth: "700px",
              marginBottom: "2.5rem",
              lineHeight: "1.5",
              opacity: 0.95,
              textShadow: "2px 2px 10px rgba(0,0,0,0.7)",
            }}
          >
            {t.subtitle}
          </p>

          <div
            style={{
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "2rem",
            }}
          >
            <Category icon={<FiSun size={42} />} label="Vær" link="/vaer" />
            <Category icon={<FiGlobe size={42} />} label="Utforsk" link="/explore" />
            <Category icon={<FiMap size={42} />} label="Kart" link="/map" />
            <Category icon={<FiUsers size={42} />} label="Sosial" link="/sosial" />
            <Category icon={<FiHome size={42} />} label="Reserver" link="/reserver" />
          </div>

          <div style={{ width: "100%", maxWidth: "600px" }}>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "1rem 1.5rem",
                border: "none",
                fontSize: "1.1rem",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                outline: "none",
              }}
            />
          </div>

          <button
            onClick={scrollToNext}
            style={{
              marginTop: "3rem",
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <FiChevronDown size={50} />
          </button>
        </section>
      </div>

      {/* FULLSCREEN KARUSELL */}
      <section
        id="recommended-section"
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {slides.map((slide, idx) => (
          <div
            key={idx}
            style={{
              position: idx === currentSlide ? "relative" : "absolute",
              opacity: idx === currentSlide ? 1 : 0,
              transition: "opacity 0.5s ease-in-out",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src={slide.img}
              alt={slide.title}
              fill
              style={{
                objectFit: "cover",
                filter: "blur(8px) brightness(0.6)",
              }}
            />

            <div
              style={{
                width: "90%",
                maxWidth: "1200px",
                display: "flex",
                gap: "2rem",
                alignItems: "center",
                color: "#fff",
                position: "relative",
                zIndex: 2,
              }}
            >
              <div style={{ flex: 1 }}>
                <h2 style={{ opacity: 0.8 }}>{slide.category}</h2>

                <Image
                  src={slide.img}
                  alt={slide.title}
                  width={600}
                  height={450}
                  style={{
                    boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
                    objectFit: "cover",
                    maxWidth: "100%",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: "3rem" }}>{slide.title}</h1>

                <p>
                  <FiMapPin /> {slide.start}
                </p>

                <p>
                  <FiClock /> {slide.duration}
                </p>

                <p>
                  <FiTrendingUp /> {slide.difficulty}
                </p>

                <Link
                  href={slide.link}
                  style={{
                    marginTop: "1rem",
                    padding: "1rem 2rem",
                    backgroundColor: "#2e5c44",
                    color: "#fff",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {t.start}
                </Link>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={prevSlide}
          style={{
            position: "absolute",
            left: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.4)",
            border: "none",
            padding: "1rem",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <FiChevronLeft size={32} color="#fff" />
        </button>

        <button
          onClick={nextSlide}
          style={{
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.4)",
            border: "none",
            padding: "1rem",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <FiChevronRight size={32} color="#fff" />
        </button>
      </section>
    </div>
  );
}

function Category({ icon, label, link }) {
  return (
    <Link href={link} style={{ textDecoration: "none", color: "#fff" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        {icon}
        <span style={{ marginTop: "0.5rem", fontWeight: 600 }}>{label}</span>
      </div>
    </Link>
  );
}