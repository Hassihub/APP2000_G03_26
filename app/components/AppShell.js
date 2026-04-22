"use client";

import Link from "next/link";
import TopBar from "./TopBar";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function normalizeTheme(theme) {
  if (theme === "dark" || theme === "Mørk") return "dark";
  if (theme === "auto" || theme === "Automatisk") return "auto";
  return "light";
}

function resolveTheme(theme) {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
}

export default function AppShell({ children }) {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const isMapPage = pathname === "/map";

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!cancelled) {
          setTheme(normalizeTheme(json?.theme));
        }
      } catch {
        if (!cancelled) {
          setTheme("light");
        }
      }
    }

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const applyCurrentTheme = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    };

    applyCurrentTheme();

    if (theme !== "auto") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyCurrentTheme();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (event) => {
      const nextTheme = normalizeTheme(event.detail?.theme);
      setTheme(nextTheme);
    };

    window.addEventListener("ff-theme-change", handleThemeChange);
    return () => window.removeEventListener("ff-theme-change", handleThemeChange);
  }, []);

  async function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", resolveTheme(nextTheme));

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      window.dispatchEvent(new CustomEvent("ff-theme-change", { detail: { theme: nextTheme } }));
    } catch {
      // Ignore preference sync failures and keep the active theme in memory.
    }
  }

  return (
    <>
      {!isMapPage && <TopBar />}
      <div style={{ paddingTop: isMapPage ? 0 : "104px" }}>{children}</div>
      <footer style={{ background: "var(--nav-bg)", color: "var(--nav-text)", fontFamily: "Poppins, sans-serif", marginTop: "auto" }}>
        {/* Main footer grid */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "4rem 2rem 3rem", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "3rem", flexWrap: "wrap" }}>

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <svg viewBox="0 0 48 32" width="56" height="40" fill="none">
                <path d="M2 30 L16 5 L24 17 L30 9 L46 30 Z" fill="#f59e0b" />
                <circle cx="36" cy="7" r="3.5" fill="#fff" />
              </svg>
              <span style={{ fontWeight: 800, fontSize: "1.5rem", color: "#000", letterSpacing: "-0.02em" }}>FrittFram</span>
            </div>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.9rem", lineHeight: 1.7, color: "#9ca3af", maxWidth: "280px" }}>
              Norges møteplass for friluftsliv. Planlegg turer, finn hytter og del opplevelser med andre entusiaster.
            </p>
          </div>

          {/* Tjenester */}
          <div>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280" }}>Tjenester</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                { label: "Utforsk turer", href: "/explore" },
                { label: "Reserver hytte", href: "/reserver" },
                { label: "Kart", href: "/map" },
                { label: "Værvarsling", href: "/weather" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem", transition: "color 0.15s" }}
                  onMouseEnter={(e) => e.target.style.color = "#000"}
                  onMouseLeave={(e) => e.target.style.color = "#9ca3af"}
                >{label}</Link>
              ))}
            </div>
          </div>

          {/* Selskap */}
          <div>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280" }}>Selskap</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                { label: "Om oss", href: "/om-oss" },
                { label: "Kontakt oss", href: "/kontakt" },
                { label: "Kundeservice", href: "/kundeservice" },
                { label: "Annonseportal", href: "/annonseportal" },
                { label: "Personvern", href: "/personvern" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}
                  onMouseEnter={(e) => e.target.style.color = "#000"}
                  onMouseLeave={(e) => e.target.style.color = "#9ca3af"}
                >{label}</Link>
              ))}
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280" }}>Kontakt</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.9rem", color: "#9ca3af" }}>
              <span>hei@frittfram.no</span>
              <span>+47 900 00 000</span>
              <span>Notodden, Norge</span>
            </div>
            <div style={{ marginTop: "1.5rem" }}>
              <p style={{ margin: "0 0 0.6rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280" }}>Annonser?</p>
              <Link href="/annonseportal" style={{ display: "inline-block", padding: "0.6rem 1.1rem", background: "var(--accent)", color: "#fff", borderRadius: "6px", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em" }}>
                Se pakker →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid #1f2937", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", maxWidth: "1100px", margin: "0 auto" }}>
          <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>
            © {new Date().getFullYear()} FrittFram AS · Alle rettigheter forbeholdt
          </span>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            {[
              { label: "Bruksvilkår", href: "/bruksvilkar" },
              { label: "Informasjonskapsler", href: "/cookies" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.82rem" }}
                onMouseEnter={(e) => e.target.style.color = "#9ca3af"}
                onMouseLeave={(e) => e.target.style.color = "#6b7280"}
              >{label}</Link>
            ))}
            <button
              onClick={toggleTheme}
              title={resolveTheme(theme) === "dark" ? "Bytt til lyst tema" : "Bytt til mørkt tema"}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid #2d3a4a", borderRadius: "999px", padding: "0.35rem 0.9rem", color: "#9ca3af", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "inherit" }}
            >
              {resolveTheme(theme) === "dark" ? "Lyst" : "Mørkt"}
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
