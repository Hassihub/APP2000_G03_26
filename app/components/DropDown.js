"use client";

import { useState } from "react";
import Link from "next/link";

export default function DropDown() {
  const [open, setOpen] = useState(false);

  const pages = [
    { name: "Utforsk", href: "/explore" },
    { name: "Reserver", href: "/reserver" },
    { name: "Kart", href: "/map" },
    { name: "Vær", href: "/weather" },
    { name: "Sosial", href: "/sosial" },
    { name: "Hjem", href: "/" },
  ];

  return (
    <div 
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Inter', sans-serif",
        background: "#eef2ff",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>Meny</h1>

      {/* Dropdown-knapp */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            borderRadius: "12px",
            border: "2px solid var(--border)",
            background: "var(--bg-panel)",
            cursor: "pointer",
            transition: "background 0.3s, transform 0.2s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-bg)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-panel)"}
        >
          {open ? "Lukk meny" : "Åpne meny"}
        </button>

        {/* Dropdown-liste */}
        {open && (
          <div 
            style={{
              position: "absolute",
              top: "110%",
              left: 0,
              width: "100%",
              background: "var(--bg-panel)",
              border: "2px solid var(--border)",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {pages.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                style={{
                  padding: "1rem 2rem",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontWeight: "600",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-bg)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-panel)"}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}