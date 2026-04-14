"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "../components/LanguageProvider";

export default function SignUp() {
  const router = useRouter();
  const t = useTranslations("signupPage");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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
            router.replace("/");
          }
        }
      } catch {
        // ignore, just show signup form
      }
    };

    checkLoggedIn();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError(t.passwordMismatch || "Passordene er ikke like");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t.signupError);
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      setError(t.genericError);
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "var(--bg)", fontFamily: "'Inter','Poppins',sans-serif" }}>
      <section style={{ width: "100%", maxWidth: "420px", padding: "2.5rem 2rem", borderRadius: 4, background: "var(--bg-panel)", border: "1px solid var(--border)" }}>
        <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#6675ff", fontWeight: 700 }}>
          FrittFram
        </p>
        <h1 style={{ margin: "0 0 0.4rem", color: "var(--text)", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em" }}>{t.title}</h1>
        <p style={{ marginTop: 0, marginBottom: "1.75rem", color: "var(--text-muted)", lineHeight: 1.5, fontSize: "0.9rem" }}>Lag en konto for å komme i gang.</p>

        {error && (
          <p style={{ color: "#f87171", fontWeight: 500, fontSize: "0.87rem", marginBottom: "0.75rem" }}>{error}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.username}</span>
            <input data-cy="signup-username" type="text" value={formData.username} onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))} required style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.email}</span>
            <input data-cy="signup-email" type="email" value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} required autoComplete="email" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.password}</span>
            <input data-cy="signup-password" type="password" value={formData.password} onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))} required autoComplete="new-password" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.confirmPassword}</span>
            <input data-cy="signup-confirm-password" type="password" value={formData.confirmPassword} onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))} required autoComplete="new-password" style={inputStyle} />
          </label>

          <button data-cy="signup-submit" type="submit" disabled={loading} style={{ padding: "0.9rem 1rem", borderRadius: 4, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: loading ? "wait" : "pointer", letterSpacing: "0.02em", marginTop: "0.25rem" }}>
            {loading ? t.submitting : t.submit}
          </button>
        </form>

        <p style={{ margin: "1.25rem 0 0", color: "var(--text-muted)", fontSize: "0.87rem" }}>
          Har du allerede konto? <a href="/login" style={{ color: "#6675ff", fontWeight: 700, textDecoration: "none" }}>Logg inn</a>
        </p>
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.75rem 0.9rem",
  borderRadius: 4,
  border: "1px solid var(--border)",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  background: "var(--bg-input)",
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};
