"use client";

import { useEffect, useState } from "react";

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").find((c) => c.trim().startsWith(name + "="));
  return match ? match.trim().split("=")[1] : null;
}

function setCookie(name, value, days) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  document.cookie = `${name}=${value}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookie("cookie_consent")) {
      setVisible(true);
    }
  }, []);

  function accept() {
    setCookie("cookie_consent", "accepted", 365);
    setVisible(false);
  }

  function decline() {
    setCookie("cookie_consent", "declined", 30);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie-samtykke"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "var(--nav-bg)",
        color: "var(--nav-text)",
        padding: "1.25rem 2rem",
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        flexWrap: "wrap",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
        fontFamily: "Poppins, sans-serif",
      }}
    >
        <p style={{ margin: 0, fontSize: "0.88rem", flex: 1, lineHeight: 1.6, color: "var(--nav-text)", minWidth: "240px" }}>
        🍪 Vi bruker informasjonskapsler (cookies) for å gi deg en bedre opplevelse på FrittFram.
        Ved å klikke <strong style={{ color: "#fff" }}>Aksepter</strong> godtar du bruk av cookies i henhold til vår personvernpolicy.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
        <button
          onClick={accept}
          style={{
            padding: "0.6rem 1.5rem",
            background: "#fff",
            color: "#111827",
            border: "none",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Aksepter
        </button>
        <button
          onClick={decline}
          style={{
            padding: "0.6rem 1.5rem",
            background: "transparent",
            color: "#9ca3af",
            border: "1px solid #374151",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Avvis
        </button>
      </div>
    </div>
  );
}
