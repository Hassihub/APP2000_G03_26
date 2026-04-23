"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SLIDES = [
  {
    title: "Oppdag utopiske fjell",
    description:
      "Finn de beste fotturer rett utenfor din dør. Mer enn 500 merkede ruter over hele landet.",
    cta: "Utforsk turer →",
    href: "/explore",
    accent: "#2d6a4f",
  },
  {
    title: "Reserver hytte i dag",
    description:
      "Velg blant hundrevis av hytter i utopisk natur. Bestill enkelt og trygt.",
    cta: "Se hytter →",
    href: "/reserver",
    accent: "#1a4a8a",
  },
  {
    title: "Del turen med venner",
    description:
      "Last opp bilder, skriv turrapporter og inspirer andre til å komme seg ut.",
    cta: "Gå til sosial →",
    href: "/sosial",
    accent: "#7c3aed",
  },
];

export default function Hjem() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        fontFamily: "Poppins, sans-serif",
        background: "#0a0a0a",
      }}
    >
      {/* Video background – place /public/videos/natur.mp4 to activate */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      >
        <source src="/videos/natur.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)",
          zIndex: 1,
        }}
      />

      {/* Hero */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "65vh",
          textAlign: "center",
          padding: "4rem 2rem 2rem",
          color: "#fff",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
            fontWeight: 900,
            margin: "0 0 1.2rem",
            letterSpacing: "-0.03em",
            textShadow: "0 2px 30px rgba(0,0,0,0.6)",
            lineHeight: 1.1,
          }}
        >
          Friluftsliv starter her
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.2vw, 1.35rem)",
            maxWidth: "580px",
            opacity: 0.88,
            lineHeight: 1.65,
            textShadow: "0 1px 12px rgba(0,0,0,0.5)",
            margin: "0 0 2.5rem",
          }}
        >
          Finn turer, reserver hytter og del opplevelser i utopisk natur.
        </p>
        <Link
          href="/explore"
          style={{
            padding: "1rem 2.8rem",
            borderRadius: "50px",
            background: "#fff",
            color: "#111827",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "1.05rem",
            letterSpacing: "0.03em",
            boxShadow: "0 6px 30px rgba(0,0,0,0.35)",
          }}
        >
          Kom i gang
        </Link>
      </div>

      {/* Slides */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 2rem 5rem" }}>
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {/* Slide viewport */}
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
                transform: `translateX(-${current * 100}%)`,
              }}
            >
              {SLIDES.map((slide, i) => (
                <div
                  key={i}
                  style={{
                    minWidth: "100%",
                    padding: "2.5rem 3rem",
                    color: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    borderLeft: `5px solid ${slide.accent}`,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.7rem",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {slide.title}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      opacity: 0.82,
                      lineHeight: 1.65,
                      fontSize: "1rem",
                      maxWidth: "520px",
                    }}
                  >
                    {slide.description}
                  </p>
                  <Link
                    href={slide.href}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: "0.25rem",
                      padding: "0.65rem 1.5rem",
                      borderRadius: "50px",
                      background: slide.accent,
                      color: "#fff",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {slide.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
              padding: "1.2rem",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: i === current ? "28px" : "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background:
                    i === current ? "#fff" : "rgba(255,255,255,0.35)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.35s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
