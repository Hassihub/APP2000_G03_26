"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ResetBanner() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setIsAdmin(data?.user?.role === "ADMIN"))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  async function handleReset() {
    if (
      !confirm(
        "Er du sikker på at du vil tilbakestille alle testdata?\nAlle brukere, hytter og innlegg vil bli slettet og erstattet med forhåndsinnstilte data."
      )
    )
      return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/reset-test-data", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage("Testdata tilbakestilt!");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage(data.error || "Feil ved tilbakestilling");
      }
    } catch {
      setMessage("Nettverksfeil");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  return (
    <div className="school-project-banner">
      <span>Dette er et skoleprosjekt</span>

      {isAdmin && (
        <button
          onClick={handleReset}
          disabled={loading}
          className="reset-test-data-btn"
        >
          {loading ? "Tilbakestiller…" : "Tilbakestill testdata"}
        </button>
      )}

      {message && (
        <span className="reset-test-data-msg">{message}</span>
      )}
    </div>
  );
}
