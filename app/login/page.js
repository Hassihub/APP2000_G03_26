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
          if (data.user) {
            router.replace("/profile");
          }
        }
      } catch {
        // ignore, just show login form
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

      router.push("/profile");
    } catch (err) {
      setError("Noe gikk galt");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Logg inn</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          E-post
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Passord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          {loading ? "Logger inn..." : "Logg inn"}
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Har du ikke konto? {" "}
        <button
          type="button"
          onClick={() => router.push("/signup")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "blue",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Registrer deg
        </button>
      </p>
    </div>
  );
}
