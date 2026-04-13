"use client";

import { useState } from "react";

const FAQ = [
  {
    q: "Hvordan oppretter jeg en konto?",
    a: "Klikk på «Registrer deg» øverst i menyen. Fyll inn navn, e-post og passord — du er klar på under ett minutt.",
  },
  {
    q: "Jeg har glemt passordet mitt. Hva gjør jeg?",
    a: "Gå til innloggingssiden og klikk «Glemt passord». Du mottar en e-post med instruksjoner for å tilbakestille passordet.",
  },
  {
    q: "Kan jeg reservere en hytte uten å være logget inn?",
    a: "Nei, du må ha en konto og være logget inn for å reservere hytter. Dette sikrer at vi kan bekrefte og håndtere bestillingen din.",
  },
  {
    q: "Hvordan kansellerer jeg en reservasjon?",
    a: "Gå til Profil → Mine reservasjoner og klikk «Kanseller» ved siden av den aktuelle bookingen. Avbestillingsregler varierer per hytte.",
  },
  {
    q: "Støtter dere mobilbetaling og Vipps?",
    a: "Vi jobber med å integrere Vipps og kortbetaling. For øyeblikket behandles betalinger direkte med hytteeieren.",
  },
  {
    q: "Hvordan melder jeg en feil eller et upassende innlegg?",
    a: "Bruk «Del»-knappen på innlegget og velg «Rapporter». Vi behandler alle rapporter innen 24 timer.",
  },
  {
    q: "Er FrittFram gratis å bruke?",
    a: "Ja, grunnlaget er helt gratis. Vi tilbyr premium-funksjoner for utleiere med ekstra synlighet og statistikk.",
  },
  {
    q: "Kan jeg legge til min egen hytte for utleie?",
    a: "Ja! Gå til Reserver → Legg til hytte og fyll ut skjemaet. Hytter godkjennes innen 1 virkedag.",
  },
];

export default function Kundeservice() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Inter', 'Poppins', sans-serif" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(160deg,var(--bg) 0%,#1a2035 100%)", padding: "5rem 2rem 4rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Hjelp</p>
          <h1 style={{ margin: "0 0 1.25rem", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Kundeservice
          </h1>
          <p style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-muted)", lineHeight: 1.75, maxWidth: 540 }}>
            Finn svar på de vanligste spørsmålene, eller ta kontakt med oss direkte — vi er her for å hjelpe.
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section style={{ padding: "3rem 2rem 0", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Populære temaer</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem", padding: "1.25rem 0 2.5rem" }}>
            {[
              { icon: "🔑", label: "Konto & Innlogging" },
              { icon: "🏠", label: "Hytte & Reservasjon" },
              { icon: "💳", label: "Betaling" },
              { icon: "🗺️", label: "Kart & Turer" },
              { icon: "👥", label: "Forum & Sosial" },
              { icon: "⚙️", label: "Innstillinger" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", cursor: "default" }}>
                <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 320px", gap: "3rem", alignItems: "start" }}>
          <div>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>FAQ</p>
            <h2 style={{ margin: "0 0 1.75rem", fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 900, letterSpacing: "-0.03em" }}>Ofte stilte spørsmål</h2>

            <div style={{ display: "grid", gap: "0.65rem" }}>
              {FAQ.map((item, i) => (
                <div
                  key={i}
                  style={{ background: "var(--bg-panel)", border: `1px solid ${openIndex === i ? "#6675ff" : "var(--border)"}`, borderRadius: 4, overflow: "hidden", transition: "border-color 0.15s" }}
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    style={{ width: "100%", padding: "1.1rem 1.3rem", background: "transparent", border: "none", color: "var(--text)", textAlign: "left", cursor: "pointer", fontWeight: 700, fontSize: "0.92rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", fontFamily: "inherit" }}
                  >
                    <span>{item.q}</span>
                    <span style={{ fontSize: "1.1rem", color: "var(--text-muted)", flexShrink: 0, transform: openIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}>+</span>
                  </button>
                  {openIndex === i && (
                    <div style={{ padding: "0 1.3rem 1.1rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sidekolonne */}
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>Fant du ikke svaret?</h3>
              <p style={{ margin: "0 0 1.25rem", fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                Send oss en melding direkte og vi svarer deg innen 1–2 virkedager.
              </p>
              <a href="/kontakt" style={{ display: "block", padding: "0.85rem", background: "#fff", color: "var(--bg-panel)", borderRadius: 4, textDecoration: "none", fontWeight: 800, fontSize: "0.88rem", textAlign: "center", letterSpacing: "0.02em" }}>
                Kontakt oss →
              </a>
            </div>

            <div style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>Åpningstider</h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {[
                  { day: "Mandag – Fredag", hours: "08:00 – 16:00" },
                  { day: "Lørdag", hours: "10:00 – 14:00" },
                  { day: "Søndag", hours: "Stengt" },
                ].map(({ day, hours }) => (
                  <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>{day}</span>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{hours}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>Nødtelefon</h3>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>Tekniske problemer med aktiv booking?</p>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--text)", letterSpacing: "0.02em" }}>+47 22 00 00 00</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
