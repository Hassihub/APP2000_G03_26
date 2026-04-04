"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import SosialFeed from "./components/SosialFeed";
import { useRouter } from "next/navigation";
import {
  FiChevronDown,
  FiSun,
  FiGlobe,
  FiMap,
  FiUsers,
  FiHome,
} from "react-icons/fi";
import { useLanguage, useTranslations } from "./components/LanguageProvider";

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [trips, setTrips] = useState([]);
  const [cabins, setCabins] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const { language } = useLanguage();
  const t = useTranslations("home");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (!cancelled) setCurrentUser(d?.user || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Move scroll snap to html so footer is reachable by scrolling past slide 3
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollSnapType = "y mandatory";
    html.style.overflowY = "scroll";
    html.style.overflowX = "hidden";
    html.style.scrollPaddingTop = "64px";
    return () => {
      html.style.scrollSnapType = "";
      html.style.overflowY = "";
      html.style.overflowX = "";
      html.style.scrollPaddingTop = "";
    };
  }, []);



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
    if (event) event.preventDefault();
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return;
    router.push(`/search?q=${encodeURIComponent(trimmedSearch)}`);
  };

  const scrollToNext = () => {
    const nextSection = document.getElementById("recommended-section");
    if (nextSection) nextSection.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToSocial = () => {
    const section = document.getElementById("social-section");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{
        width: "100%",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
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
          <source src="/videos/natur.mp4" type="video/mp4" />
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
            <CategoryBtn icon={<FiUsers size={42} />} label={t.social} onClick={scrollToSocial} />
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
                  background: "#fff",
                  color: "#111827",
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

      {/* SLIDE 2 — AKTIVITETSKARUSELL */}
      <section
        id="recommended-section"
        style={{
          minHeight: "100vh",
          scrollSnapAlign: "start",
          background: "linear-gradient(160deg, #0f1117 0%, #1a2035 100%)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "4rem 2rem",
          overflow: "hidden",
        }}
      >
        <ActivityCarousel cabins={cabins} />
      </section>

      {/* SLIDE 3 — LIVE SOSIAL FORUM */}
      <section
        id="social-section"
        style={{
          minHeight: "100vh",
          scrollSnapAlign: "start",
          background: "linear-gradient(160deg, #0d1117 0%, #111827 100%)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <SosialFeed currentUser={currentUser} embedded />
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

// ─── Activity Carousel ────────────────────────────────────────────────────────
const STATIC_CARDS = [
  // Page 0
  { label: "Overnatting", title: "Fjellhytte i Jotunheimen", desc: "Rustikk hytte med utsikt over Besseggen. Plass til 8.", img: "/images/hytte.jpg", tag: "Hytte", href: "/reserver", cta: "Reserver nå" },
  { label: "Aktivitet", title: "Langtur på Hardangervidda", desc: "5-dagersrute gjennom ett av Europas største høyfjellsplatåer.", img: "/images/fjell.jpg", tag: "Fottur", href: "/explore", cta: "Se ruten" },
  { label: "Utstyr", title: "Fjellsko til alle terreng", desc: "Testet og godkjent av norske turfolk. Nå i Marked.", img: "/images/Explore.jpg", tag: "Marked", href: "/annonser", cta: "Se tilbud" },
  // Page 1
  { label: "Overnatting", title: "Kystferie på Lofoten", desc: "Rorbu rett ved sjøen. Sol, sjømat og midnattssol.", img: "/images/Reserve.jpg", tag: "Rorbu", href: "/reserver", cta: "Reserver nå" },
  { label: "Aktivitet", title: "Sykkeltur langs Rallarvegen", desc: "82 km over fjellet – Norges kuleste sykkelrute.", img: "/images/Map.jpg", tag: "Sykkel", href: "/explore", cta: "Se ruten" },
  { label: "Fellesskap", title: "Del din neste tur", desc: "Finn turkamerater og del opplevelser i forumet.", img: "/images/Social.jpg", tag: "Forum", href: "/sosial", cta: "Gå til forum" },
  // Page 2
  { label: "Vær", title: "Sjekk værvarselet", desc: "Oppdatert fjellvær for over 500 norske topper.", img: "/images/Weather.jpg", tag: "Vær", href: "/vaer", cta: "Åpne kart" },
  { label: "Aktivitet", title: "Toppturer i Romsdalen", desc: "Klassiske ruter med spektakulær utsikt. Alle nivåer.", img: "/images/Galdhopiggen.jpg", tag: "Klatring", href: "/explore", cta: "Utforsk" },
  { label: "Overnatting", title: "Sommerhytte ved innsjø", desc: "Stillhet, padling og fiske. Booking åpent for sommer.", img: "/images/hytte.jpg", tag: "Hytte", href: "/reserver", cta: "Reserver nå" },
];

function ActivityCarousel({ cabins }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(STATIC_CARDS.length / 3);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 10000);
    return () => clearInterval(timer);
  }, [totalPages]);

  const cards = STATIC_CARDS.slice(page * 3, page * 3 + 3);

  const tagColors = {
    Hytte: "#4f6ef7", Fottur: "#10b981", Marked: "#f59e0b",
    Rorbu: "#4f6ef7", Sykkel: "#10b981", Forum: "#8b5cf6",
    Vær: "#0ea5e9", Klatring: "#ef4444", default: "#6b7280",
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6b7280" }}>Populært nå</p>
          <h2 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#f9fafb" }}>Utforsk det beste</h2>
        </div>
        {/* Arrows + dots */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => setPage((p) => (p - 1 + totalPages) % totalPages)}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #2d3347", background: "#1a2035", color: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}
          >‹</button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{ width: 8, height: 8, borderRadius: "50%", border: "none", background: i === page ? "#f9fafb" : "#2d3347", cursor: "pointer", padding: 0, transition: "background 0.2s" }} />
          ))}
          <button
            onClick={() => setPage((p) => (p + 1) % totalPages)}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #2d3347", background: "#1a2035", color: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}
          >›</button>
        </div>
      </div>

      {/* Cards — 3 sharp boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
        {cards.map((card, i) => (
          <Link key={`${page}-${i}`} href={card.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#111827", border: "1px solid #1e2538", borderRadius: "4px", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#4f6ef7"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e2538"}
            >
              {/* Image */}
              <div style={{ position: "relative", height: 200, flexShrink: 0 }}>
                <Image src={card.img} alt={card.title} fill unoptimized style={{ objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
                <span style={{ position: "absolute", top: "1rem", left: "1rem", background: tagColors[card.tag] || tagColors.default, color: "#fff", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.25rem 0.65rem", borderRadius: "2px" }}>
                  {card.tag}
                </span>
              </div>
              {/* Content */}
              <div style={{ padding: "1.4rem 1.5rem 1.6rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>{card.label}</p>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#f9fafb", lineHeight: 1.25, letterSpacing: "-0.01em" }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#9ca3af", lineHeight: 1.6, flex: 1 }}>{card.desc}</p>
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "#4f6ef7", fontWeight: 700, fontSize: "0.82rem" }}>
                  {card.cta} <span>→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: "2rem", height: 2, background: "#1e2538", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#4f6ef7", width: `${((page + 1) / totalPages) * 100}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function Category({ icon, label, link }) {
  return (
    <Link href={link} style={{ textDecoration: "none", color: "#fff" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
        {icon}
        <span style={{ marginTop: "0.5rem", fontWeight: 600 }}>{label}</span>
      </div>
    </Link>
  );
}

function CategoryBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", fontFamily: "inherit", padding: 0 }}>
      {icon}
      <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}