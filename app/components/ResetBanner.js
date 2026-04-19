"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ResetBanner() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Hent innlogget brukers rolle når komponenten lastes.
  // Knappen vises bare hvis rollen er ADMIN.
  const [isAdmin, setIsAdmin] = useState(false);

  // usePathname() gir oss den nåværende URL-stien, f.eks. "/", "/login", "/profil".
  // Hver gang brukeren navigerer til en ny side endrer denne seg.
  // Vi bruker den som trigger for å re-sjekke hvem som er innlogget,
  // slik at knappen dukker opp rett etter innlogging og forsvinner etter utlogging.
  const pathname = usePathname();

  useEffect(() => {
    // Spør serveren hvem som er innlogget.
    // cache: "no-store" sørger for at vi aldri får et gammelt cachet svar –
    // vi vil alltid vite den faktiske innloggingsstatusen akkurat nå.
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        // data?.user?.role henter rollen trygt (optional chaining).
        // Hvis brukeren ikke er logget inn er data null → setIsAdmin(false).
        setIsAdmin(data?.user?.role === "ADMIN");
      })
      .catch(() => setIsAdmin(false));
  }, [pathname]); // kjører på nytt hver gang URL-stien endrer seg

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

      {/* Knappen vises bare hvis brukeren er admin.
          && betyr: vis bare høyre side hvis venstre side er true. */}
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
