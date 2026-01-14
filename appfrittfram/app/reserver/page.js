"use client";
import { useState } from "react";
import Image from "next/image";

export default function Reserver({ valgtHytte }) {
  // valgtHytte kan komme som prop:
  // {
  //   id: "hytte1",
  //   navn: "Fjellbu",
  //   bilde: "/bilder/fjellbu.jpg",
  //   beskrivelse: "Koselig hytte på fjellet",
  //   kapasitet: 6,
  //   pris: 900
  // }

  const [navn, setNavn] = useState("");
  const [epost, setEpost] = useState("");
  const [fraDato, setFraDato] = useState("");
  const [tilDato, setTilDato] = useState("");
  const [antall, setAntall] = useState(1);

  const [bekreftelse, setBekreftelse] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Opprett et reservasjon-objekt
    const reservasjon = {
      hytteId: valgtHytte?.id,
      hytteNavn: valgtHytte?.navn,
      hytteBilde: valgtHytte?.bilde,
      navn,
      epost,
      fraDato,
      tilDato,
      antall,
    };

    setBekreftelse(reservasjon);

    // Nullstill skjema
    setNavn("");
    setEpost("");
    setFraDato("");
    setTilDato("");
    setAntall(1);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Reserver hytte</h1>
      <p>Fyll ut skjemaet under for å reservere.</p>

      {/* Vis valgt hytte */}
      {valgtHytte && (
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          {valgtHytte.bilde && (
            <Image src={valgtHytte.bilde} alt={valgtHytte.navn} width={800} height={600} style={{ maxWidth: "100%", height: "auto" }} />
          )}
          <p>{valgtHytte.beskrivelse}</p>
          <p>Kapasitet: {valgtHytte.kapasitet} personer</p>
          <p>Pris per natt: {valgtHytte.pris} kr</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", maxWidth: "400px" }}>
        <label>
          Navn:
          <input type="text" value={navn} onChange={(e) => setNavn(e.target.value)} required />
        </label>

        <label>
          E-post:
          <input type="email" value={epost} onChange={(e) => setEpost(e.target.value)} required />
        </label>

        <label>
          Fra dato:
          <input type="date" value={fraDato} onChange={(e) => setFraDato(e.target.value)} required />
        </label>

        <label>
          Til dato:
          <input type="date" value={tilDato} onChange={(e) => setTilDato(e.target.value)} required />
        </label>

        <label>
          Antall personer:
          <input type="number" value={antall} min="1" max={valgtHytte?.kapasitet || 10} onChange={(e) => setAntall(e.target.value)} required />
        </label>

        <button type="submit" style={{ padding: "0.5rem", backgroundColor: "#4CAF50", color: "white", border: "none", cursor: "pointer" }}>
          Reserver
        </button>
      </form>

      {/* Bekreftelse */}
      {bekreftelse && (
        <div style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc", backgroundColor: "#f0f0f0" }}>
          <h2>Bekreftelse</h2>
          {bekreftelse.hytteBilde && (
            <Image src={bekreftelse.hytteBilde} alt={bekreftelse.hytteNavn} width={800} height={600} style={{ maxWidth: "100%", height: "auto" }} />
          )}
          <p>Navn: {bekreftelse.navn}</p>
          <p>E-post: {bekreftelse.epost}</p>
          <p>Fra: {bekreftelse.fraDato}</p>
          <p>Til: {bekreftelse.tilDato}</p>
          <p>Antall personer: {bekreftelse.antall}</p>
        </div>
      )}
    </div>
  );
}