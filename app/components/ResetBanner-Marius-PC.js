/**
 * app/components/ResetBanner.js
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 *
 * Dette er en React-komponent som viser et banner øverst på alle sider.
 * Banneret gjør to ting:
 *   1. Informerer besøkende om at dette er et skoleprosjekt.
 *   2. Viser en "Tilbakestill testdata"-knapp KUN for admin-brukere.
 *
 * Knappen kaller /api/admin/reset-test-data (POST) som sletter all data
 * i databasen og fyller den med forhåndsinnstilte testbrukere, hytter og turer.
 * Dette er nyttig under utvikling og demonstrasjon.
 *
 * Tilgangskontroll: Knappen vises ikke i HTML-en i det hele tatt hvis
 * brukeren ikke er admin – den er altså skjult, ikke bare deaktivert.
 */
"use client"; // Nødvendig fordi vi bruker hooks og nettleser-APIer

// useState  → lagrer og oppdaterer tilstand (verdier som endres over tid)
// useEffect → kjør kode som bivirkning etter render (f.eks. hente data)
import { useState, useEffect } from "react";

// usePathname() fra Next.js gir oss den nåværende URL-stien.
// Vi bruker den som trigger for å sjekke innloggingsstatus ved navigasjon.
import { usePathname } from "next/navigation";

/**
 * ResetBanner
 *
 * Komponent uten props – den leser innloggingsstatus selv fra /api/auth/me.
 */
export default function ResetBanner() {
  // --------------------------------------------------------------------------
  // STATE-VARIABLER
  // --------------------------------------------------------------------------

  // loading: true mens vi venter på svar fra reset-APIet.
  // Brukes til å deaktivere knappen og endre teksten til "Tilbakestiller…"
  const [loading, setLoading] = useState(false);

  // message: statusmelding som vises etter reset (suksess eller feil).
  // null betyr at ingen melding vises.
  const [message, setMessage] = useState(null);

  // isAdmin: true hvis innlogget bruker har rollen "ADMIN".
  // Knappen rendres bare i JSX hvis dette er true.
  const [isAdmin, setIsAdmin] = useState(false);

  // pathname: den nåværende URL-stien, f.eks. "/", "/login", "/profil".
  // Endres automatisk av Next.js ved navigasjon (uten full side-reload).
  const pathname = usePathname();

  // --------------------------------------------------------------------------
  // EFFECT: Sjekk om innlogget bruker er admin
  // --------------------------------------------------------------------------
  // Denne effekten kjøres hver gang pathname endres (altså ved hver navigasjon).
  // På den måten oppdateres admin-statusen raskt etter innlogging/utlogging,
  // selv om brukeren ikke laster siden på nytt.
  //
  // [pathname] som dependency array betyr: "kjør på nytt når pathname endres"
  useEffect(() => {
    // Kall /api/auth/me for å finne ut hvem som er innlogget.
    // credentials: "include" sørger for at sesjons-cookien sendes med.
    // cache: "no-store" betyr: aldri bruk en cachet versjon – spør alltid serveren.
    // Dette er viktig her fordi innloggingsstatusen kan ha endret seg nylig.
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : null) // null hvis ikke innlogget (401/403)
      .then((data) => {
        // data?.user?.role bruker optional chaining:
        // Trygt selv om data er null, eller data.user er undefined.
        // Setter isAdmin til true bare hvis rollen eksakt er "ADMIN".
        setIsAdmin(data?.user?.role === "ADMIN");
      })
      .catch(() => setIsAdmin(false)); // Nettverksfeil → ikke admin
  }, [pathname]); // Kjør på nytt ved navigasjon

  // --------------------------------------------------------------------------
  // RESET-FUNKSJON
  // --------------------------------------------------------------------------
  /**
   * handleReset
   *
   * Kalles når admin klikker på "Tilbakestill testdata"-knappen.
   * Viser en bekreftelsesdialog, sender POST til reset-APIet,
   * og oppdaterer meldingen basert på resultatet.
   */
  async function handleReset() {
    // confirm() viser en innebygd nettleser-dialog og venter på brukerens svar.
    // Returnerer true (OK) eller false (Avbryt).
    // Hvis brukeren klikker Avbryt, avslutter vi funksjonen med en gang.
    if (
      !confirm(
        "Er du sikker på at du vil tilbakestille alle testdata?\nAlle brukere, hytter og innlegg vil bli slettet og erstattet med forhåndsinnstilte data."
      )
    )
      return;

    // Sett loading-tilstand: deaktiverer knappen og endrer knappeteksten
    setLoading(true);
    setMessage(null); // Fjern eventuell gammel melding

    try {
      // Send POST-forespørsel til reset-APIet.
      // method: "POST" er nødvendig fordi browseren sender GET som standard.
      const res = await fetch("/api/admin/reset-test-data", { method: "POST" });

      // Parse JSON-svaret fra serveren
      const data = await res.json();

      if (res.ok) {
        // HTTP 200 → reset lyktes
        setMessage("Testdata tilbakestilt!");

        // Last siden på nytt etter 1 sekund slik at ny data vises.
        // setTimeout(fn, ms) venter ms millisekunder før den kaller fn.
        // window.location.reload() tvinger en full side-reload.
        setTimeout(() => window.location.reload(), 1000);
      } else {
        // HTTP 4xx/5xx → noe gikk galt på serveren
        // data.error inneholder feilmeldingen fra APIet (eller en generisk tekst)
        setMessage(data.error || "Feil ved tilbakestilling");
      }
    } catch {
      // Nettverksfeil: nettleseren fikk ikke kontakt med serveren
      setMessage("Nettverksfeil");
    } finally {
      // finally kjøres ALLTID, uansett om try eller catch ble brukt.
      // Vi fjerner loading-tilstanden her slik at knappen blir aktiv igjen.
      setLoading(false);

      // Fjern statusmeldingen etter 4 sekunder (4000 ms) automatisk.
      // Dette gir brukeren tid til å lese meldingen uten at den henger igjen.
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // --------------------------------------------------------------------------
  // RENDER / JSX
  // --------------------------------------------------------------------------
  return (
    // Ytre wrapper med CSS-klasse definert i globals.css
    <div className="school-project-banner">

      {/* Fast tekst som vises for alle besøkende */}
      <span>Dette er et skoleprosjekt</span>

      {/*
        Betinget rendering: knappen vises BARE hvis isAdmin er true.
        && er kortslutningsevaluering i JavaScript:
          true  && <element>  →  rendrer elementet
          false && <element>  →  rendrer ingenting (null)
        Dette betyr at ikke-admin-brukere aldri ser knappen i DOM-en.
      */}
      {isAdmin && (
        <button
          onClick={handleReset}   // Kall handleReset ved klikk
          disabled={loading}      // Deaktiver knappen mens reset pågår
          className="reset-test-data-btn"
        >
          {/* Ternær operator: vis én tekst mens laster, annen tekst ellers */}
          {loading ? "Tilbakestiller…" : "Tilbakestill testdata"}
        </button>
      )}

      {/*
        Statusmelding vises bare når message ikke er null.
        Settes til null igjen etter 4 sekunder (se handleReset ovenfor).
      */}
      {message && (
        <span className="reset-test-data-msg">{message}</span>
      )}
    </div>
  );
}
