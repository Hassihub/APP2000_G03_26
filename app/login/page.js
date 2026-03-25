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
        background:
          "linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(32,78,59,1) 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "2rem",
          borderRadius: "20px",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#4b6356",
          }}
        >
          {t.eyebrow}
        </p>
        <h1 style={{ margin: "0.5rem 0 0.75rem", color: "#10261b" }}>
          {t.title}
        </h1>
        <p style={{ marginTop: 0, color: "#587062", lineHeight: 1.5 }}>
          {t.subtitle}
        </p>

        {checkingAuth ? (
          <p style={{ color: "#3b5246" }}>{t.checking}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ color: "#163324", fontWeight: 600 }}>{t.email}</span>
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
              <span style={{ color: "#163324", fontWeight: 600 }}>{t.password}</span>
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
              <p style={{ margin: 0, color: "#b42318", fontWeight: 500 }}>
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.95rem 1rem",
                borderRadius: "12px",
                border: "none",
                background: "#163324",
                color: "#fff",
                fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        )}

        <p style={{ margin: "1rem 0 0", color: "#587062" }}>
          {t.noAccount} <Link href="/signup">{t.signUp}</Link>
        </p>
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.85rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #c7d7cd",
  fontSize: "1rem",
  boxSizing: "border-box",
};