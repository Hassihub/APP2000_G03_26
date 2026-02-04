"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Reserver.module.css";

export default function EditCabinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cabinId = searchParams.get("cabinId");

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    price_per_night: "",
    capacity: "",
    amenities: "",
  });

  const [status, setStatus] = useState({ type: "idle", message: "" });

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!cabinId) return;

      setStatus({ type: "loading", message: "Laster hytte..." });

      const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (!alive) return;
        setStatus({ type: "error", message: json?.error || "Kunne ikke hente hytta." });
        return;
      }

      const c = json.cabin;

      if (!alive) return;
      setForm({
        name: c?.name ?? "",
        description: c?.description ?? "",
        location: c?.location ?? "",
        price_per_night: String(c?.price_per_night ?? ""),
        capacity: String(c?.capacity ?? ""),
        amenities: Array.isArray(c?.amenities) ? c.amenities.join(", ") : "",
      });

      setStatus({ type: "idle", message: "" });
    }

    load();
    return () => {
      alive = false;
    };
  }, [cabinId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cabinId) return;

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
        : null,
    };

    const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus({ type: "error", message: json?.error || "Kunne ikke lagre endringer." });
      return;
    }

    setStatus({ type: "success", message: "✅ Endringer lagret!" });
    setTimeout(() => router.push("/reserver"), 600);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>✏️ Rediger hytte</div>

            {!cabinId ? (
              <div className={styles.errorBox}>❌ Mangler cabinId i URL.</div>
            ) : (
              <div className={styles.layout}>
                <div className={styles.listCard}>
                  <h3 className={styles.listTitle}>Navigasjon</h3>
                  <Link className={styles.buttonSecondary} href="/reserver">
                    ← Tilbake
                  </Link>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardContent}>
                    {status.type === "error" ? (
                      <div className={styles.errorBox}>❌ {status.message}</div>
                    ) : null}

                    {status.type === "success" ? (
                      <div className={styles.successBox}>{status.message}</div>
                    ) : null}

                    <form onSubmit={handleSubmit} className={styles.form}>
                      <div className={styles.field}>
                        <label className={styles.label}>Navn</label>
                        <input
                          className={styles.input}
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Beskrivelse</label>
                        <textarea
                          className={styles.textarea}
                          name="description"
                          value={form.description}
                          onChange={handleChange}
                          rows={3}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Lokasjon</label>
                        <input
                          className={styles.input}
                          name="location"
                          value={form.location}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className={styles.row2}>
                        <div className={styles.field}>
                          <label className={styles.label}>Pris per natt</label>
                          <input
                            className={styles.input}
                            name="price_per_night"
                            type="number"
                            value={form.price_per_night}
                            onChange={handleChange}
                            required
                            min="0"
                          />
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>Kapasitet</label>
                          <input
                            className={styles.input}
                            name="capacity"
                            type="number"
                            value={form.capacity}
                            onChange={handleChange}
                            required
                            min="1"
                          />
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Fasiliteter</label>
                        <input
                          className={styles.input}
                          name="amenities"
                          value={form.amenities}
                          onChange={handleChange}
                          placeholder="WiFi, Badstue, Peis"
                        />
                        <div className={styles.helper}>
                          Skriv kommaseparert. Tomt felt → lagres som NULL.
                        </div>
                      </div>

                      <button className={styles.button} type="submit" disabled={status.type === "loading"}>
                        {status.type === "loading" ? "Lagrer..." : "Lagre endringer"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
