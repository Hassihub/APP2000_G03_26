"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) router.replace("/");
        }
      } catch {
        // ignore
      }
    };
    checkLoggedIn();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunne ikke logge inn");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Noe gikk galt");
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundImage: "url('/profilbakgrunn.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 0,
        }}
      ></div>

      {/* Form */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: "2.5rem 2rem",
          borderRadius: "12px",
          width: "400px",
          color: "white",
          boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ marginBottom: "1.5rem" }}>Logg inn</h1>

        {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-post"
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passord"
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontWeight: "600",
              cursor: "pointer",
              backgroundColor: "#ffffffcc",
              color: "#171717",
              transition: "background 0.2s ease",
            }}
          >
            {loading ? "Logger inn..." : "Logg inn"}
          </button>
        </form>
      </div>
    </main>
  );
}
