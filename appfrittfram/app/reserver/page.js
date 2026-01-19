"use client";
import { useState } from "react";
import Image from "next/image";

export default function Reserver() {

  // 🔹 Midlertidig testdata – later som dette kommer fra databasen
  const valgtHytte = {
    id: "hytte_01",
    navn: "Fjellro Lodge",
    bilde: "/bilder/fjellhytte.jpg", // legg et bilde i public/bilder/
    beskrivelse: "En moderne fjellhytte med panoramautsikt og peis.",
    kapasitet: 6,
    pris: 1200,
    lokasjon: "Hemsedal, Norge",
    fasiliteter: ["Peis", "Badstue", "WiFi", "Parkering"]
  };

  const [navn, setNavn] = useState("");
  const [epost, setEpost] = useState("");
  const [fraDato, setFraDato] = useState("");
  const [tilDato, setTilDato] = useState("");
  const [antall, setAntall] = useState(1);
  const [bekreftelse, setBekreftelse] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setBekreftelse({ navn, fraDato, tilDato, antall });
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>

      {/* Funnet-hytte melding */}
      <div style={{
        background: "#e8f6ee",
        border: "1px solid #b7e1c7",
        padding: "1rem",
        borderRadius: "8px",
        marginBottom: "1.5rem"
      }}>
        <strong>✔ Hytte funnet!</strong>
        <p>Vi har funnet en ledig hytte som passer ditt søk.</p>
      </div>

      {/* Hyttekort */}
      <div style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        marginBottom: "2rem"
      }}>
        <div style={{ position: "relative", width: "100%", height: "380px" }}>
          <Image
            src={valgtHytte.bilde}
            alt={valgtHytte.navn}
            fill
            style={{ objectFit: "cover" }}
          />
        </div>

        <div style={{ padding: "1.5rem" }}>
          <h2>{valgtHytte.navn}</h2>
          <p>{valgtHytte.beskrivelse}</p>

          <p>📍 {valgtHytte.lokasjon}</p>
          <p>👥 {valgtHytte.kapasitet} personer</p>
          <p>💰 {valgtHytte.pris} kr per natt</p>
          <p>🏡 {valgtHytte.fasiliteter.join(", ")}</p>
        </div>
      </div>

      {/* Her fyller du inn booking */}
      <h3>Fyll inn din bestilling</h3>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: "1rem", maxWidth: "400px" }}
      >
        <input
          placeholder="Navn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="E-post"
          value={epost}
          onChange={(e) => setEpost(e.target.value)}
          required
        />

        <label>
          Fra dato
          <input
            type="date"
            value={fraDato}
            onChange={(e) => setFraDato(e.target.value)}
            required
          />
        </label>

        <label>
          Til dato
          <input
            type="date"
            value={tilDato}
            onChange={(e) => setTilDato(e.target.value)}
            required
          />
        </label>

        <input
          type="number"
          min="1"
          max={valgtHytte.kapasitet}
          value={antall}
          onChange={(e) => setAntall(Number(e.target.value))}
          required
        />

        <button style={{
          padding: "0.7rem",
          background: "#2f7d4a",
          color: "white",
          border: "none",
          borderRadius: "6px"
        }}>
          Reserver nå
        </button>
      </form>

      {/* Bekreftelse når du trykker reserver */}
      {bekreftelse && (
        <div style={{
          marginTop: "2rem",
          background: "#f3f3f3",
          padding: "1rem",
          borderRadius: "8px"
        }}>
          <h2>Bestilling registrert 🎉</h2>
          <p>Takk {bekreftelse.navn}!</p>
          <p>{bekreftelse.fraDato} → {bekreftelse.tilDato}</p>
          <p>{bekreftelse.antall} personer</p>
        </div>
      )}
    </div>
  );
}