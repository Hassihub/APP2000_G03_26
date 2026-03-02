"use client";

import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const pages = [
    { name: "Utforsk", href: "/explore", image: "/images/Explore.jpg", tooltip: "Utforsk nye steder" },
    { name: "Reserver", href: "/reserver", image: "/images/Reserve.jpg", tooltip: "Reserver ting enkelt" },
    { name: "Kart", href: "/map", image: "/images/Map.jpg", tooltip: "Se kartet" },
    { name: "Vær", href: "/vaer", image: "/images/Weather.jpg", tooltip: "Sjekk været" },
    { name: "Sosial", href: "/sosial", image: "/images/Social.jpg", tooltip: "Knytt nye kontakter" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#eef2ff", fontFamily: "'Inter', sans-serif" }}>
      <main style={{
        display: "flex",
        flexDirection: "column",
        scrollSnapType: "y mandatory",
        overflowY: "scroll",
        height: "100vh",
      }}>
        {pages.map((p) => (
          <Link
            key={p.name}
            href={p.href}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "stretch",
              width: "100%",
              minHeight: "100vh",
              borderRadius: "16px",
              overflow: "hidden",
              marginBottom: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
              textDecoration: "none",
              color: "white",
              scrollSnapAlign: "start",
              transition: "transform 0.3s ease",
            }}
          >
            {/* Infotekst med lett mørk naturfarge */}
            <div style={{
              flex: 1,
              padding: "60px",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: "rgba(34, 50, 30, 0.4)", // mørk grønnlig tone med transparens
              borderRadius: "16px 0 0 16px",
              color: "white",
              textShadow: "1px 1px 4px rgba(0,0,0,0.7)"
            }}>
              <h2 style={{ fontSize: "3rem", fontWeight: "700", marginBottom: "1rem" }}>{p.name}</h2>
              <p style={{ fontSize: "1.2rem" }}>{p.tooltip}</p>
            </div>

            {/* Bilde */}
            <div style={{ flex: 1, position: "relative", minHeight: "100vh" }}>
              <Image src={p.image} alt={p.name} fill style={{ objectFit: "cover" }} />
            </div>

            {/* Hover overlay */}
            <div className="overlay" style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0)",
              transition: "background 0.3s, transform 0.3s",
            }} />

            <style jsx>{`
              a:hover .overlay {
                background: rgba(0,0,0,0.1);
                transform: scale(1.03);
              }
              a:hover {
                transform: scale(1.03);
              }
            `}</style>
          </Link>
        ))}
      </main>
    </div>
  );
}