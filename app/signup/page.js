"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await fetch("/api/auth/me", { method: "GET", credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.user) router.replace("/");
        }
      } catch {}
    };
    checkLoggedIn();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Kunne ikke opprette konto"); setLoading(false); return; }
      router.push("/login");
    } catch { setError("Noe gikk galt"); setLoading(false); }
  };

  return (
    <main style={{
      minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center",
      backgroundImage: "url('/images/profilbakgrunn.jpg')", backgroundSize: "cover", backgroundPosition: "center",
      position: "relative", fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 0 }} />

      <div style={{
        position: "relative", zIndex: 1, backdropFilter: "blur(12px)",
        backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "0px",
        width: "400px", maxWidth: "90%", color: "#fff", padding: "2.5rem 2rem",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)",
        display: "flex", flexDirection: "column", gap: "1.5rem"
      }}>
        <h1 style={{ textAlign: "center", fontSize: "2rem", fontWeight: 700 }}>Registrer deg</h1>
        {error && <p style={{ color: "#ff6b6b", textAlign: "center" }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Brukernavn" style={{
            padding: "0.85rem 1rem", borderRadius: "0px", border: "none",
            fontSize: "16px", outline: "none", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff"
          }} />
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-post" style={{
            padding: "0.85rem 1rem", borderRadius: "0px", border: "none",
            fontSize: "16px", outline: "none", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff"
          }} />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Passord (minst 8 tegn)" style={{
            padding: "0.85rem 1rem", borderRadius: "0px", border: "none",
            fontSize: "16px", outline: "none", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff"
          }} />
          <button type="submit" disabled={loading} style={{
            padding: "0.85rem", borderRadius: "0px", border: "none", fontWeight: 600,
            cursor: "pointer", background: "linear-gradient(135deg, #4ade80, #16a34a)",
            color: "#fff", fontSize: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>{loading ? "Oppretter konto..." : "Opprett konto"}</button>
        </form>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)" }}>
          Har du allerede konto? <Link href="/login" style={{ color: "#4ade80", fontWeight: 600 }}>Logg inn</Link>
        </p>
      </div>
    </main>
  );
}