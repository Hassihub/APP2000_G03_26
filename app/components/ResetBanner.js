// "use client" forteller Next.js at denne komponenten skal kjøre i nettleseren
// (klient-siden), ikke på serveren. Dette er nødvendig fordi vi bruker
// useState og onClick – begge deler krever at JavaScript kjører i nettleseren.
// Uten denne linjen ville Next.js prøve å rendre komponenten på serveren,
// og da finnes ikke klikk-hendelser eller tilstand.
"use client";

// useState er en React-hook som lar oss lagre verdier som kan forandre seg.
// Når en useState-verdi endres, tegner React komponenten på nytt automatisk.
import { useState } from "react";

// Vi eksporterer denne funksjonen som "default" slik at andre filer
// kan importere den med: import ResetBanner from "./components/ResetBanner"
export default function ResetBanner() {

  // loading: true mens vi venter på svar fra serveren, false ellers.
  // Vi bruker denne til å vise "Tilbakestiller…" på knappen og
  // hindre at brukeren trykker flere ganger mens det allerede kjører.
  // useState(false) betyr at startverdien er false.
  const [loading, setLoading] = useState(false);

  // message: teksten vi viser etter at reset er ferdig (eller feilet).
  // null betyr at vi ikke viser noen melding.
  const [message, setMessage] = useState(null);

  // handleReset er funksjonen som kjøres når brukeren trykker på knappen.
  // "async" betyr at funksjonen kan bruke "await" for å vente på svar
  // fra serveren uten å fryse nettleseren.
  async function handleReset() {

    // confirm() viser en innebygd nettleser-dialog med OK/Avbryt.
    // Hvis brukeren trykker Avbryt returnerer confirm() false,
    // og vi avbryter funksjonen tidlig med "return".
    // "!" snur verdien: !false = true, altså: hvis brukeren avbrøt → hopp ut.
    if (
      !confirm(
        "Er du sikker på at du vil tilbakestille alle testdata?\nAlle brukere, hytter og innlegg vil bli slettet og erstattet med forhåndsinnstilte data."
      )
    )
      return;

    // Sett loading til true – knappen viser nå "Tilbakestiller…"
    // og er deaktivert så brukeren ikke kan trykke igjen.
    setLoading(true);

    // Tøm eventuell gammel melding fra forrige kjøring.
    setMessage(null);

    // try/catch/finally er feilhåndtering:
    // - try: kjør dette, og fang eventuelle feil
    // - catch: kjør dette HVIS noe gikk galt
    // - finally: kjør dette UANSETT (om det gikk bra eller dårlig)
    try {

      // fetch() sender en HTTP-forespørsel til serveren.
      // "/api/admin/reset-test-data" er URL-en til API-ruten vår.
      // { method: "POST" } betyr at vi sender en POST-forespørsel
      // (ikke GET). POST brukes når vi vil at serveren skal gjøre en handling.
      // "await" betyr: vent til serveren svarer før vi går videre.
      const res = await fetch("/api/admin/reset-test-data", { method: "POST" });

      // res.json() leser svaret fra serveren og gjør det om fra tekst til
      // et JavaScript-objekt. f.eks. { success: true, message: "..." }
      const data = await res.json();

      // res.ok er true hvis HTTP-statuskoden er 200–299 (suksess).
      // Hvis serveren svarte med f.eks. 500 (feil), er res.ok false.
      if (res.ok) {
        setMessage("Testdata tilbakestilt!");
      } else {
        // data.error er feilmeldingen serveren sendte tilbake.
        // "|| " betyr: bruk data.error hvis den finnes, ellers bruk fallback-teksten.
        setMessage(data.error || "Feil ved tilbakestilling");
      }

    } catch {
      // Denne blokken kjøres hvis fetch() selv kastet en feil –
      // f.eks. hvis brukeren ikke har internett-tilkobling.
      setMessage("Nettverksfeil");

    } finally {
      // finally kjøres alltid, uansett om det gikk bra eller ikke.

      // Sett loading tilbake til false så knappen blir aktiv igjen.
      setLoading(false);

      // setTimeout venter 4000 millisekunder (4 sekunder), deretter
      // kjøres funksjonen inni – som setter message til null (skjuler meldingen).
      // Dette gir brukeren tid til å lese tilbakemeldingen.
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // Det som returneres herfra er det som vises på skjermen (JSX).
  // JSX ser ut som HTML, men er egentlig JavaScript.
  return (
    // Dette er den røde banneren øverst på siden.
    // CSS-klassen "school-project-banner" er definert i globals.css.
    <div className="school-project-banner">

      {/* Teksten som allerede var i banneret */}
      <span>Dette er et skoleprosjekt</span>

      {/* Knappen som utløser reset.
          onClick={handleReset} – kall handleReset når knappen trykkes.
          disabled={loading}   – deaktiver knappen mens loading er true,
                                 så brukeren ikke kan sende flere forespørsler.
          className            – CSS-klassen for styling av knappen. */}
      <button
        onClick={handleReset}
        disabled={loading}
        className="reset-test-data-btn"
      >
        {/* Ternær operator: hvis loading er true, vis første tekst, ellers andre.
            Syntaks: betingelse ? "verdi hvis sant" : "verdi hvis usant" */}
        {loading ? "Tilbakestiller…" : "Tilbakestill testdata"}
      </button>

      {/* Vis meldingen KUN hvis message ikke er null.
          "&&" er kortslutning: hvis venstre side er falsy (null, false, ""),
          evalueres ikke høyre side og ingenting vises.
          Hvis message har en verdi, vises <span>-en med teksten. */}
      {message && (
        <span className="reset-test-data-msg">{message}</span>
      )}
    </div>
  );
}
