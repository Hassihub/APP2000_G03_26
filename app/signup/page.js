"use client";
import { useState } from "react";
import Link from "next/link";

export default function Signup() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registrering feilet");
        setLoading(false);
        return;
      }

      setSuccess("Bruker opprettet og logget inn!");
      setLoading(false);
    } catch (err) {
      console.error("Signup error", err);
      setError("Noe gikk galt, prøv igjen");
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        backgroundImage: "url('/images/profilbakgrunn.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        fontFamily: "Poppins, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 0,
        }}
      ></div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          background: "rgba(0,0,0,0.6)",
          padding: "3rem 2rem",
          borderRadius: "12px",
          width: "350px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ marginBottom: "1rem" }}>Registrer deg</h1>

        {error && (
          <p style={{ color: "#ffb3b3", marginBottom: "1rem" }}>{error}</p>
        )}
        {success && (
          <p style={{ color: "#b3ffb3", marginBottom: "1rem" }}>{success}</p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
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
            type="email"
            name="email"
            placeholder="E-post"
            value={formData.email}
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

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#ffffffcc",
              color: "#171717",
              fontWeight: "600",
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
          >
            {loading ? "Registrerer..." : "Opprett konto"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem" }}>
          Har du allerede konto?{" "}
          <Link
            href="/profile"
            style={{
              color: "#ffffffcc",
              fontWeight: "600",
              textDecoration: "underline",
            }}
          >
            Logg inn
          </Link>
        </p>
      </div>
    </main>
  );
}
