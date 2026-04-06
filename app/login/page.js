"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "../components/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("loginPage");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!cancelled && res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.user) {
            router.replace("/profile");
            return;
          }
        }
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || t.loginError);
      }

      window.location.assign("/profile");
    } catch (err) {
      setError(err.message || t.loginError);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "var(--bg)",
        fontFamily: "'Inter','Poppins',sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2.5rem 2rem",
          borderRadius: 4,
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            margin: "0 0 0.4rem",
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "#6675ff",
            fontWeight: 700,
          }}
        >
          {t.eyebrow}
        </p>
        <h1 style={{ margin: "0 0 0.4rem", color: "var(--text)", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em" }}>
          {t.title}
        </h1>
        <p style={{ marginTop: 0, marginBottom: "1.75rem", color: "#6b7280", lineHeight: 1.5, fontSize: "0.9rem" }}>
          {t.subtitle}
        </p>

        {checkingAuth ? (
          <p style={{ color: "var(--text-muted)" }}>{t.checking}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.email}</span>
              <input
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                }
                required
                autoComplete="email"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>{t.password}</span>
              <input
                type="password"
                value={formData.password}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>

            {error ? (
              <p style={{ margin: 0, color: "#f87171", fontWeight: 500, fontSize: "0.87rem" }}>
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.9rem 1rem",
                borderRadius: 4,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.95rem",
                cursor: loading ? "wait" : "pointer",
                letterSpacing: "0.02em",
                marginTop: "0.25rem",
              }}
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        )}

        <p style={{ margin: "1.25rem 0 0", color: "var(--text-muted)", fontSize: "0.87rem" }}>
          {t.noAccount} <Link href="/signup" style={{ color: "#6675ff", fontWeight: 700, textDecoration: "none" }}>{t.signUp}</Link>
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