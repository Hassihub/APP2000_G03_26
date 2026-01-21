"use client";
import { useState } from "react";
import Image from "next/image";
import styles from "./Reserver.module.css";

export default function Reserver() {

  const valgtHytte = {
    id: "hytte_01",
    navn: "Fjellro Lodge",
    bilde: "/bilder/fjellhytte.jpg",
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
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.notice}>
          ✔ Hytte funnet! Vi har funnet en ledig hytte som passer ditt søk.
        </div>

        <div className={styles.card}>
          <div className={styles.cardContent}>

            <div className={styles.imageWrap}>
              <Image
                src={valgtHytte.bilde}
                alt={valgtHytte.navn}
                fill
                style={{ objectFit: "cover" }}
              />
            </div>

            <div className={styles.info}>
              <h2>{valgtHytte.navn}</h2>
              <p>{valgtHytte.beskrivelse}</p>

              <div className={styles.meta}>
                📍 {valgtHytte.lokasjon}<br />
                👥 {valgtHytte.kapasitet} personer<br />
                💰 {valgtHytte.pris} kr per natt<br />
                🏡 {valgtHytte.fasiliteter.join(", ")}
              </div>
            </div>

          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Fyll inn din bestilling</h3>

          <form onSubmit={handleSubmit} className={styles.form}>

            <input
              className={styles.input}
              placeholder="Navn"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="email"
              placeholder="E-post"
              value={epost}
              onChange={(e) => setEpost(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="date"
              value={fraDato}
              onChange={(e) => setFraDato(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="date"
              value={tilDato}
              onChange={(e) => setTilDato(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="number"
              min="1"
              max={valgtHytte.kapasitet}
              value={antall}
              onChange={(e) => setAntall(Number(e.target.value))}
              required
            />

            <button className={styles.button}>
              Reserver nå
            </button>
          </form>
        </div>

        {bekreftelse && (
          <div className={styles.confirm}>
            <h2>Bestilling registrert 🎉</h2>
            <p>Takk {bekreftelse.navn}!</p>
            <p>{bekreftelse.fraDato} → {bekreftelse.tilDato}</p>
            <p>{bekreftelse.antall} personer</p>
          </div>
        )}

      </div>
    </div>
  );
}