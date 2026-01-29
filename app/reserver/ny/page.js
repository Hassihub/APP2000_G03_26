"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../Reserver.module.css";

export default function NewCabinPage() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    price_per_night: "",
    capacity: "",
    amenities: "",
  });

  const [status, setStatus] = useState({
    type: "idle", // idle | loading | success | error
    message: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "loading", message: "Lagrer..." });

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      location: form.location.trim(),
      price_per_night: Number(form.price_per_night),
      capacity: Number(form.capacity),
      amenities: form.amenities
        ? form.amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
    };

    try {
      const res = await fetch("/api/cabins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          type: "error",
          message: json?.error || "Kunne ikke lagre hytta.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: `Hytta ble lagret: ${json?.cabin?.name || payload.name}`,
      });

      // Reset skjema (valgfritt)
      setForm({
        name: "",
        description: "",
        location: "",
        price_per_night: "",
        capacity: "",
        amenities: "",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Nettverksfeil / serverfeil.",
      });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Samme main-oppsett som Home */}
      <main style={{ padding: 0 }}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              ➕ Legg til ny hytte (lagres i databasen)
            </div>

            <div className={styles.layout}>
              {/* Venstre: info/kort */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>Tips</h3>
                <div className={styles.meta} style={{ marginTop: 10 }}>
                  <div>• <b>Fasiliteter</b>: skriv kommaseparert (f.eks: WiFi, Badstue)</div>
                  <div>• <b>Pris</b> og <b>kapasitet</b> må være tall</div>
                  <div>• <b>Lokasjon</b> er f.eks: “Hemsedal, Norge”</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link className={styles.button} href="/reserver">
                    ← Tilbake til oversikt
                  </Link>
                </div>
              </div>

              {/* Høyre: skjema */}
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.info}>
                    <h2 style={{ marginTop: 0 }}>Ny hytte</h2>

                    {status.type !== "idle" && status.message ? (
                      <div
                        style={{
                          marginBottom: 12,
                          fontWeight: 700,
                        }}
                      >
                        {status.type === "loading"
                          ? "⏳ "
                          : status.type === "success"
                          ? "✅ "
                          : "❌ "}
                        {status.message}
                      </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className={styles.list}>
                      <input
                        name="name"
                        placeholder="Navn (påkrevd)"
                        value={form.name}
                        onChange={handleChange}
                        required
                      />

                      <textarea
                        name="description"
                        placeholder="Beskrivelse (valgfri)"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                      />

                      <input
                        name="location"
                        placeholder="Lokasjon (påkrevd)"
                        value={form.location}
                        onChange={handleChange}
                        required
                      />

                      <input
                        name="price_per_night"
                        type="number"
                        placeholder="Pris per natt (kr)"
                        value={form.price_per_night}
                        onChange={handleChange}
                        required
                        min="0"
                      />

                      <input
                        name="capacity"
                        type="number"
                        placeholder="Kapasitet (antall personer)"
                        value={form.capacity}
                        onChange={handleChange}
                        required
                        min="1"
                      />

                      <input
                        name="amenities"
                        placeholder="Fasiliteter (kommaseparert)"
                        value={form.amenities}
                        onChange={handleChange}
                      />

                      <button
                        className={styles.button}
                        type="submit"
                        disabled={status.type === "loading"}
                      >
                        {status.type === "loading" ? "Lagrer..." : "Lagre hytte"}
                      </button>
                    </form>

                    <div style={{ marginTop: 12 }}>
                      <Link href="/reserver" className="topbar-item">
                        Til oversikt
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              {/* slutt høyre */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
