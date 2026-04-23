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
  const [bgImageIndex, setBgImageIndex] = useState(0);
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const { language } = useLanguage();
  const t = useTranslations("home");

  const backgroundImages = ["/images/Gif1.gif", "/images/Gif2.gif", "/images/Gif3.jpg", "/images/Gif4.jpg"];
  const totalImages = 4;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (!cancelled) setCurrentUser(d?.user || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Wheel-based section navigation: 1 scroll = 1 section
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflowX = "hidden";

    let locked = false;

    const getActiveIdx = () => {
      const ids = ["hero-section", "recommended-section", "social-section"];
      const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
      let best = 0;
      let bestOverlap = 0;
      sections.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 64));
        if (overlap > bestOverlap) { bestOverlap = overlap; best = i; }
      });
      return best;
    };

    const onWheel = (e) => {
      const ids = ["hero-section", "recommended-section", "social-section"];
      const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
      if (sections.length < 3) return;

      const currentIdx = getActiveIdx();
      const feedWrapper = document.getElementById("social-feed-scroll");

      // Social section: allow internal scroll; navigate out only when at edge
      if (currentIdx === 2) {
        if (e.deltaY > 0) return; // scrolling down inside social — let it go
        const scrollTop = feedWrapper ? feedWrapper.scrollTop : 0;
        if (scrollTop > 0) return; // has content above — let it scroll up
        // At top of social, scrolling up → go to section 2
        if (!locked) {
          e.preventDefault();
          locked = true;
          sections[1].scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => { locked = false; }, 900);
        } else {
          e.preventDefault();
        }
        return;
      }

      if (locked) { e.preventDefault(); return; }

      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = Math.max(0, Math.min(sections.length - 1, currentIdx + dir));
      if (nextIdx === currentIdx) return;

      e.preventDefault();
      locked = true;
      sections[nextIdx].scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { locked = false; }, 900);
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      html.style.overflowX = "";
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

  useEffect(() => {
    const interval = setInterval(() => {
      setBgImageIndex((prev) => (prev + 1) % totalImages);
    }, 8000); // 8 sekunder per bilde
    return () => clearInterval(interval);
  }, [totalImages]);

  // Når bgImageIndex endres, oppdater displayedIndex etter fade
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedIndex(bgImageIndex);
    }, 5000); // Vent 5 sekunder før du viser neste bilde
    return () => clearTimeout(timer);
  }, [bgImageIndex]);

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



  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* HERO BACKGROUND */}
      <div style={{ position: "relative", height: "100vh" }}>
        {/* Bakgrunnsbilde - Neste (under) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            backgroundImage: `url(${backgroundImages[bgImageIndex]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: -2,
          }}
        />

        {/* Bakgrunnsbilde - Gjeldende (over, fader ut) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            backgroundImage: `url(${backgroundImages[displayedIndex]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: displayedIndex === bgImageIndex ? 1 : 0,
            transition: "opacity 3s ease-in-out",
            zIndex: -1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,50,20,0.35)",
          }}
        />

        <section
          id="hero-section"
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
            <Category icon={<FiSun size={42} />} label={t.weather} link="/weather" />
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
                  background: "#fff",
                  color: "var(--bg-panel)",
                  padding: "0.7rem 1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.searchBtn}
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
                  {t.showAllResults}
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

      {/* SLIDE 2 â€” AKTIVITETSKARUSELL */}
      <section
        id="recommended-section"
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          background: "var(--bg)",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "4rem 2rem",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <ActivityCarousel cabins={cabins} />
      </section>

      {/* SLIDE 3 — LIVE SOSIAL FORUM */}
      <section
        id="social-section"
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          background: "var(--bg)",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Section header */}
        <div style={{ padding: "1.25rem 2rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0, paddingTop: "calc(1.25rem + 64px)" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {t.social}
          </h2>
        </div>
        {/* Scrollable feed */}
        <div
          id="social-feed-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "1.25rem 2rem 2rem" }}
        >
          <SosialFeed currentUser={currentUser} embedded />
        </div>
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

// â”€â”€â”€ Activity Carousel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ─── Activity Carousel ─────────────────────────────────────────────────
// Static technical data only — all display text comes from translations
const CARD_DATA = [
  { img: "/images/hytte.jpg",        href: "/reserver", tag: "cabin"   },
  { img: "/images/fjell.jpg",        href: "/explore",  tag: "hike"    },
  { img: "/images/Explore.jpg",      href: "/annonser", tag: "market"  },
  { img: "/images/Reserve.jpg",      href: "/reserver", tag: "rorbu"   },
  { img: "/images/Map.jpg",          href: "/explore",  tag: "bike"    },
  { img: "/images/Social.jpg",       href: "/sosial",   tag: "forum"   },
  { img: "/images/Weather.jpg",      href: "/weather",     tag: "weather" },
  { img: "/images/Galdhopiggen.jpg", href: "/explore",  tag: "climb"   },
  { img: "/images/hytte.jpg",        href: "/reserver", tag: "cabin"   },
];

const TAG_COLORS = {
  cabin: "#6675ff", hike: "#10b981", market: "#f59e0b",
  rorbu: "#6675ff", bike: "#10b981", forum: "#8b5cf6",
  weather: "#0ea5e9", climb: "#ef4444", default: "#6b7280",
};

function ActivityCarousel({ cabins }) {
  const t = useTranslations("home");
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(CARD_DATA.length / 3);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 10000);
    return () => clearInterval(timer);
  }, [totalPages]);

  const cards = CARD_DATA.slice(page * 3, page * 3 + 3).map((data, i) => ({
    ...data,
    ...(Array.isArray(t.cards) ? t.cards[page * 3 + i] : {}),
  }));

  const tagLabels = t.tagLabels && typeof t.tagLabels === "object" ? t.tagLabels : {};

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-dim)" }}>
            {t.carouselEyebrow}
          </p>
          <h2 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text)" }}>
            {t.carouselTitle}
          </h2>
        </div>
        {/* Arrows + dots */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => setPage((p) => (p - 1 + totalPages) % totalPages)}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}
          >&#8249;</button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={`${page}-dot-${i}`} onClick={() => setPage(i)} style={{ width: 8, height: 8, borderRadius: "50%", border: "none", background: i === page ? "var(--accent)" : "var(--border)", cursor: "pointer", padding: 0, transition: "background 0.2s" }} />
          ))}
          <button
            onClick={() => setPage((p) => (p + 1) % totalPages)}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}
          >&#8250;</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
        {cards.map((card, i) => (
          <Link key={`${page}-${i}`} href={card.href} style={{ textDecoration: "none" }}>
            <div
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", transition: "border-color 0.2s", boxShadow: "var(--shadow)" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              {/* Image */}
              <div style={{ position: "relative", height: 200, flexShrink: 0 }}>
                <Image src={card.img} alt={card.title || ""} fill unoptimized style={{ objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
                <span style={{ position: "absolute", top: "1rem", left: "1rem", background: TAG_COLORS[card.tag] || TAG_COLORS.default, color: "#fff", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.25rem 0.65rem", borderRadius: "2px" }}>
                  {tagLabels[card.tag] || card.tag}
                </span>
              </div>
              {/* Content */}
              <div style={{ padding: "1.4rem 1.5rem 1.6rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, borderTop: "1px solid var(--divider)" }}>
                <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)" }}>{card.label}</p>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.6, flex: 1 }}>{card.desc}</p>
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent)", fontWeight: 700, fontSize: "0.82rem" }}>
                  {card.cta} <span>&#8594;</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: "2rem", height: 2, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${((page + 1) / totalPages) * 100}%`, transition: "width 0.4s ease" }} />
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

