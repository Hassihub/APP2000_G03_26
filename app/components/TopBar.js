"use client";

import Link from "next/link";
import { useState } from "react";
import { FiSearch, FiSettings, FiLogIn, FiHome, FiMenu } from "react-icons/fi";

export default function TopBar() {
  const [open, setOpen] = useState(false);

  const pages = [
    { name: "Utforsk", href: "/explore" },
    { name: "Reserver", href: "/reserver" },
    { name: "Kart", href: "/map" },
    { name: "Vær", href: "/vaer" },
    { name: "Sosial", href: "/sosial" },
  ];

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
      {/* Venstre: Hjem-knapp + slagord */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Link href="/">
          <FiHome size={24} title="Hjem" />
        </Link>
        <span style={{ fontWeight: 600, fontSize: "1rem", color: "#333" }}>
          Ut på tur aldri sur
        </span>
      </div>

      {/* Høyre: Hamburger + dropdown + ikoner */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
        {/* Hamburger-meny */}
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          style={{ position: "relative" }}
        >
          <FiMenu size={24} title="Meny" style={{ cursor: "pointer" }} />

          {open && (
            <div
              style={{
                position: "absolute",
                top: "110%",
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                minWidth: "200px",
                overflow: "hidden",
                zIndex: 1000,
              }}
            >
              {pages.map((p) => (
                <Link
                  key={p.name}
                  href={p.href}
                  style={{
                    padding: "0.8rem 1.5rem",
                    textDecoration: "none",
                    color: "#333",
                    fontWeight: 600,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Ikoner: Søk, Innstillinger, Logg inn */}
        <Link href="/search">
          <FiSearch size={24} title="Søk" />
        </Link>
        <Link href="/settings">
          <FiSettings size={24} title="Innstillinger" />
        </Link>
        <Link href="/login">
          <FiLogIn size={24} title="Logg inn" />
        </Link>
      </div>
    </header>
  );
}