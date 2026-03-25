"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { useLanguage, useTranslations } from "./components/LanguageProvider";

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trips, setTrips] = useState([]);
  const [cabins, setCabins] = useState([]);
  const { language } = useLanguage();
  const t = useTranslations("home");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [preferencesRes, tripsRes, cabinsRes] = await Promise.all([
          fetch("/api/preferences", { cache: "no-store" }),
          fetch("/api/trips", { cache: "no-store" }),
          fetch("/api/cabins", { cache: "no-store" }),
        ]);

        const [preferencesJson, tripsJson, cabinsJson] = await Promise.all([
          preferencesRes.json().catch(() => ({})),
          tripsRes.json().catch(() => []),
          cabinsRes.json().catch(() => ({})),
        ]);

        if (cancelled) {
          return;
        }

        if (preferencesRes.ok && preferencesJson?.theme) {
          setTheme(normalizeHomeTheme(preferencesJson.theme));
        }

        setTrips(Array.isArray(tripsJson) ? tripsJson : []);
        setCabins(Array.isArray(cabinsJson?.cabins) ? cabinsJson.cabins : []);
      } catch (error) {
        console.error("Home data load error:", error);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor =
      theme === "dark" ? "#121212" : "#ffffff";
    document.body.style.color = theme === "dark" ? "#ffffff" : "#000000";
    document.body.style.overflowX = "hidden";
  }, [theme]);

  const locations = buildLocationSuggestions(trips, cabins);

  const filteredResults = locations.filter((item) =>
    item.name.toLowerCase().startsWith(search.toLowerCase())
  );

  const handleSearchSubmit = (event) => {
    if (event) {
      event.preventDefault();
    }

    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return;
    }

    router.push(`/search?q=${encodeURIComponent(trimmedSearch)}`);
  };

  const scrollToNext = () => {
    const nextSection = document.getElementById("recommended-section");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const slides = buildSlides(trips, cabins, t);

  useEffect(() => {
    if (slides.length === 0) {
      setCurrentSlide(0);
      return;
    }

    if (currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [slides, currentSlide]);

  const prevSlide = () => {
    if (slides.length === 0) {
      return;
    }

    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    if (slides.length === 0) {
      return;
    }

    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

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
            <Category icon={<FiSun size={42} />} label={t.weather} link="/vaer" />
            <Category icon={<FiGlobe size={42} />} label={t.explore} link="/explore" />
            <Category icon={<FiMap size={42} />} label={t.map} link="/map" />
            <Category icon={<FiUsers size={42} />} label={t.social} link="/sosial" />
            <Category icon={<FiHome size={42} />} label={t.reserve} link="/reserver" />
          </div>

          <div style={{ width: "100%", maxWidth: "600px", padding: "0 1rem", boxSizing: "border-box" }}>
            <form
              onSubmit={handleSearchSubmit}
              style={{ position: "relative", width: "100%" }}
            >
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "1rem 7rem 1rem 1.5rem",
                  border: "none",
                  borderRadius: "999px",
                  fontSize: "1.1rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="submit"
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  borderRadius: "999px",
                  background: "#2e5c44",
                  color: "#fff",
                  padding: "0.7rem 1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Søk
              </button>
            </form>

            {search.trim() ? (
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {filteredResults.slice(0, 5).map((item) => (
                  <Link
                    key={item.name}
                    href={item.link}
                    style={{
                      background: "rgba(255,255,255,0.16)",
                      color: "#fff",
                      padding: "0.45rem 0.8rem",
                      borderRadius: "999px",
                      textDecoration: "none",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {item.name}
                  </Link>
                ))}

                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  style={{
                    background: "rgba(46,92,68,0.92)",
                    color: "#fff",
                    border: "none",
                    padding: "0.45rem 0.8rem",
                    borderRadius: "999px",
                    cursor: "pointer",
                  }}
                >
                  Se alle treff
                </button>
              </div>
            ) : null}
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
        {slides.length > 0 ? (
          <>
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
          </>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "1.4rem",
            }}
          >
            Laster anbefalinger fra API...
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeHomeTheme(theme) {
  if (theme === "dark" || theme === "Mørk") return "dark";
  return "light";
}

function buildLocationSuggestions(trips, cabins) {
  const suggestions = [
    ...trips.map((trip) => ({
      name: trip.navn,
      link: `/explore?search=${encodeURIComponent(trip.navn)}`,
    })),
    ...cabins.map((cabin) => ({
      name: cabin.name,
      link: `/reserver?cabinId=${encodeURIComponent(cabin.id)}`,
    })),
  ];

  const seen = new Set();
  const uniqueSuggestions = [];

  for (const suggestion of suggestions) {
    const key = suggestion.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueSuggestions.push(suggestion);

    if (uniqueSuggestions.length === 8) {
      break;
    }
  }

  return uniqueSuggestions;
}

function buildSlides(trips, cabins, translationsForLanguage) {
  const tripSlides = trips.slice(0, 2).map((trip, index) => ({
    category:
      index === 0
        ? translationsForLanguage.todaysTrip
        : translationsForLanguage.popularRoutes,
    title: trip.navn,
    img: trip.bilde_url || "/images/fjell.jpg",
    start: trip.beskrivelse || "Se turdetaljer i utforsk",
    difficulty: trip.vanskelighetsgrad || "Ukjent",
    duration: trip.lengde_km ? `${trip.lengde_km} km` : "Lengde ikke oppgitt",
    link: `/explore?search=${encodeURIComponent(trip.navn)}`,
  }));

  const cabinSlide = cabins[0]
    ? {
        category: translationsForLanguage.cabinSuggestions,
        title: cabins[0].name,
        img: "/images/hytte.jpg",
        start: cabins[0].location || "Se detaljer i reserver",
        difficulty: `${cabins[0].capacity || "?"} personer`,
        duration: cabins[0].price_per_night
          ? `${cabins[0].price_per_night} kr/natt`
          : "Pris ikke oppgitt",
        link: `/reserver?cabinId=${encodeURIComponent(cabins[0].id)}`,
      }
    : null;

  return cabinSlide ? [...tripSlides, cabinSlide] : tripSlides;
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