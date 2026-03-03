"use client";

import { useState, useEffect } from "react";
import { FiMoon, FiSun, FiBell, FiInfo, FiUser } from "react-icons/fi";
import Link from "next/link";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [notifications, setNotifications] = useState(true);

  // Hent lagrede preferanser
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const savedNotif = localStorage.getItem("notifications");
    if (savedTheme) setTheme(savedTheme);
    if (savedNotif) setNotifications(savedNotif === "true");
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = theme === "dark" ? "#121212" : "#f4f4f4";
    document.body.style.color = theme === "dark" ? "#fff" : "#111";
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("notifications", notifications);
  }, [notifications]);

  const cardStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.5rem",
    marginBottom: "1rem",
    borderRadius: "12px",
    background: theme === "dark" ? "#222" : "#fff",
    boxShadow: theme === "dark" ? "0 3px 10px rgba(0,0,0,0.5)" : "0 3px 10px rgba(0,0,0,0.1)",
    transition: "all 0.3s",
  };

  const toggleButtonStyle = (active) => ({
    width: "50px",
    height: "24px",
    borderRadius: "12px",
    background: active ? "#0070f3" : "#ccc",
    position: "relative",
    cursor: "pointer",
    transition: "background 0.3s",
  });

  const toggleCircleStyle = (active) => ({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    top: "2px",
    left: active ? "26px" : "2px",
    transition: "left 0.3s",
  });

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "2rem" }}>Innstillinger</h1>

      {/* Dark mode */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {theme === "dark" ? <FiMoon /> : <FiSun />}
          <span style={{ fontSize: "1.2rem" }}>Mørk modus</span>
        </div>
        <div
          style={toggleButtonStyle(theme === "dark")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <div style={toggleCircleStyle(theme === "dark")} />
        </div>
      </div>

      {/* Varslinger */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FiBell />
          <span style={{ fontSize: "1.2rem" }}>Varslinger</span>
        </div>
        <div
          style={toggleButtonStyle(notifications)}
          onClick={() => setNotifications(!notifications)}
        >
          <div style={toggleCircleStyle(notifications)} />
        </div>
      </div>

      {/* Konto info */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FiUser />
          <span style={{ fontSize: "1.2rem" }}>Konto</span>
        </div>
        <Link href="/login" style={{ color: "#0070f3", fontWeight: 600 }}>Logg inn</Link>
      </div>

      {/* Om appen */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FiInfo />
          <span style={{ fontSize: "1.2rem" }}>Om appen</span>
        </div>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}