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
    <div style={{ minHeight: "100vh", padding: "2rem", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Søk etter tur eller aktivitet</h1>

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
          borderRadius: "30px",
          border: "1px solid #ccc",
          boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
          outline: "none",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filteredItems.length === 0 && query && (
          <p style={{ color: "#555", fontStyle: "italic" }}>Ingen treff for "{query}"</p>
        )}

        {filteredItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1rem",
              borderRadius: "12px",
              background: "#f0f0f0",
              color: "#333",
              textDecoration: "none",
              fontWeight: 600,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 5px 15px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span>{icons[item.type]}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}