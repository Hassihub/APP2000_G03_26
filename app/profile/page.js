"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Profile() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Hent innlogget bruker ved første innlasting
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        console.error("Kunne ikke hente bruker", err);
      }
    };
    fetchUser();
  }, []);

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Innlogging feilet");
        setLoading(false);
        return;
      }

      setUser(data.user);
      setLoading(false);
    } catch (err) {
      console.error("Login error", err);
      setError("Noe gikk galt, prøv igjen");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setFormData({ username: "", password: "" });
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setLoading(false);
    }
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
        <h1 style={{ marginBottom: "1rem" }}>
          {user ? `Hei, ${user.username}` : "Logg inn"}
        </h1>

        {error && (
          <p style={{ color: "#ffb3b3", marginBottom: "1rem" }}>
            {error}
          </p>
        )}

        {!user && (
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

          <button type="submit" disabled={loading} style={{
            padding: "0.75rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#ffffffcc",
            color: "#171717",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s ease"
          }}>
            {loading ? "Logger inn..." : "Logg inn"}
          </button>
        </form>
        )}

        {user ? (
          <>
            <p style={{ marginTop: "1.5rem" }}>
              Du er logget inn.
            </p>
            <button
              onClick={handleLogout}
              disabled={loading}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#ffffffcc",
                color: "#171717",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Logg ut
            </button>
          </>
        ) : (
          <p style={{ marginTop: "1.5rem" }}>
            Har du ikke konto?{" "}
            <Link
              href="/signup"
              style={{ color: "#ffffffcc", fontWeight: "600", textDecoration: "underline" }}
            >
              Registrer deg
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
