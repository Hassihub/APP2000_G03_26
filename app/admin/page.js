// Skrevet av Sigurd

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN } from "../../lib/roles";
import styles from "../reserver/Reserver.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const meRes = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!meRes.ok) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json().catch(() => ({}));
        if (!meData?.user) {
          router.push("/login");
          return;
        }

        if (meData.user.role !== ROLE_ADMIN) {
          setError("Du har ikke tilgang til denne siden.");
          return;
        }
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Noe gikk galt");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1>Admin</h1>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Admin</h1>
      {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

      <p>Velg hva du vil administrere.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <Link
          href="/admin/brukere"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1rem",
            background: "var(--bg-panel)",
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Brukere</h2>
          <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>
            Endre roller og slett brukere.
          </p>
        </Link>

        <Link
          href="/admin/turer"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1rem",
            background: "var(--bg-panel)",
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Turer</h2>
          <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>
            Se ruter til verifisering i kart, og godkjenn både vanlige ruter og TiU-turer.
          </p>
        </Link>

        <Link
          href="/admin/hytter"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1rem",
            background: "var(--bg-panel)",
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Hytter</h2>
          <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>
            Se alle hytter, rediger detaljer og slett ved behov.
          </p>
        </Link>
      </div>
    </div>
  );
}
