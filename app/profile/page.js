"use client";
import { useState } from "react";
import Link from "next/link";

export default function Profile() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Login er ikke koblet til backend ennå");
  };

  return (
    <main style={{
      position: "relative",
      minHeight: "100vh",
      backgroundImage: "url('/images/profilbakgrunn.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      color: "white",
      fontFamily: "Poppins, Arial, sans-serif"
    }}>
      {/* Overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.3)",
        zIndex: 0
      }}></div>

      {/* Innhold */}
      <div style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        background: "rgba(0,0,0,0.6)",
        padding: "3rem 2rem",
        borderRadius: "12px",
        width: "350px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
      }}>
        <h1 style={{ marginBottom: "2rem" }}>Logg inn</h1>

        <form onSubmit={handleSubmit} style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem"
        }}>
          <input
            type="text"
            name="username"
            placeholder="Brukernavn"
            value={formData.username}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />

          <input
            type="password"
            name="password"
            placeholder="Passord"
            value={formData.password}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />

          <button type="submit" style={{
            padding: "0.75rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#ffffffcc",
            color: "#171717",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s ease"
          }}>
            Logg inn
          </button>
        </form>

        <p style={{ marginTop: "1.5rem" }}>
          Har du ikke konto?{" "}
          <Link
            href="/signup"
            style={{ color: "#ffffffcc", fontWeight: "600", textDecoration: "underline" }}
          >
            Registrer deg
          </Link>
        </p>
      </div>
    </main>
  );
}
