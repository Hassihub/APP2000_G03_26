"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMap, FiSun, FiDroplet, FiHome } from "react-icons/fi";

export default function Search() {
  const [query, setQuery] = useState("");

  const items = [
    { name: "Fjelltur til Galdhøpiggen", href: "/turer/galdhopiggen", type: "Fjelltur" },
    { name: "Skitur i Hemsedal", href: "/turer/hemsedal", type: "Skitur" },
    { name: "Padletur på Sjoa", href: "/turer/sjoa", type: "Padletur" },
    { name: "Hytteweekend", href: "/reserver", type: "Hytte" },
    { name: "Foss i Jotunheimen", href: "/turer/foss", type: "Fjelltur" },
    { name: "Skitur i Trysil", href: "/turer/trysil", type: "Skitur" },
  ];

  const icons = {
    Fjelltur: <FiMap size={28} />,
    Skitur: <FiSun size={28} />,
    Padletur: <FiDroplet size={28} />,
    Hytte: <FiHome size={28} />,
  };

  const filteredItems = items.filter(
    (item) => item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "'Inter', sans-serif",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1.5rem", fontWeight: 700, color: "#111" }}>
        Søk etter tur eller aktivitet
      </h1>

      <input
        type="text"
        placeholder="Skriv for å søke..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "1rem 1.5rem",
          fontSize: "1.1rem",
          borderRadius: "4px",
          border: "2px solid #ccc",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "2rem",
          outline: "none",
          backgroundColor: "#fff",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filteredItems.length === 0 && query && (
          <p style={{ color: "#555", fontStyle: "italic" }}>Ingen treff for &quot;{query}&quot;</p>
        )}

        {filteredItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1rem 1.5rem",
              borderRadius: "4px",
              background: "#fff",
              color: "#111",
              textDecoration: "none",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
              e.currentTarget.style.borderColor = "#b0b0b0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
              e.currentTarget.style.borderColor = "#e0e0e0";
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{icons[item.type]}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}