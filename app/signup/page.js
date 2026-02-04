"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke opprette konto");
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
      <h1>Registrer deg</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Brukernavn
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

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
          Passord (minst 8 tegn)
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
          {loading ? "Oppretter konto..." : "Opprett konto"}
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Har du allerede konto? {" "}
        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "blue",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Logg inn
        </button>
      </p>
    </div>
  );
}
