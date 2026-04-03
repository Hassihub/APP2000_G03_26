"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Reserver.module.css";

export default function BookingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cabinId = searchParams.get("cabinId");

  const [cabin, setCabin] = useState(null);
  const [loadingCabin, setLoadingCabin] = useState(true);

  const [start_date, setStart] = useState("");
  const [end_date, setEnd] = useState("");
  const [guests_count, setGuests] = useState(1);

  const [guest_name, setName] = useState("");
  const [guest_email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // Hent hytta basert på cabinId
  useEffect(() => {
    let alive = true;

    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (data?.user) {
          setName(data.user.username || "");
          setEmail(data.user.email || "");
        }
      } catch {
        // Ikke blokkér reservasjonsskjema hvis auth-endepunkt feiler.
      }
    }

    loadUser();

    async function loadCabin() {
      try {
        setLoadingCabin(true);
        setError("");

        const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.error || "Kunne ikke hente hytteinfo.");
        const found = json?.cabin ?? null;

        if (!alive) return;
        setCabin(found);

        // clamp gjester til capacity hvis vi har det
        if (found?.capacity) {
          setGuests((g) => {
            const n = Number(g) || 1;
            return Math.min(Math.max(n, 1), found.capacity);
          });
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Kunne ikke hente hytteinfo.");
      } finally {
        if (!alive) return;
        setLoadingCabin(false);
      }
    }

    if (cabinId) loadCabin();
    else {
      setLoadingCabin(false);
      setCabin(null);
    }

    return () => {
      alive = false;
    };
  }, [cabinId]);

  const nights = useMemo(() => {
    if (!start_date || !end_date) return 0;
    const s = new Date(start_date);
    const e = new Date(end_date);
    if (isNaN(s) || isNaN(e)) return 0;
    const diff = (e - s) / (1000 * 60 * 60 * 24);
    return diff > 0 ? Math.floor(diff) : 0;
  }, [start_date, end_date]);

  const estimatedPrice = useMemo(() => {
    const p = Number(cabin?.price_per_night);
    if (!Number.isFinite(p) || p <= 0) return null;
    if (!nights) return null;
    return p * nights;
  }, [cabin, nights]);

  const dateError = useMemo(() => {
    if (!start_date || !end_date) return "";
    return nights <= 0 ? "Til-dato må være etter fra-dato." : "";
  }, [start_date, end_date, nights]);

  const guestsError = useMemo(() => {
    const gc = Number(guests_count);
    if (!Number.isFinite(gc) || gc <= 0) return "Antall personer må være et tall > 0.";
    if (cabin?.capacity && gc > cabin.capacity) return `Antall personer kan ikke være mer enn ${cabin.capacity}.`;
    return "";
  }, [guests_count, cabin]);

  const canSubmit = useMemo(() => {
    if (!cabinId) return false;
    if (!start_date || !end_date) return false;
    if (dateError) return false;
    if (guestsError) return false;
    if (!String(guest_name).trim()) return false;
    if (!String(guest_email).trim()) return false;
    return !submitting;
  }, [cabinId, start_date, end_date, dateError, guestsError, guest_name, guest_email, submitting]);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setOk("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabin_id: cabinId,
          start_date,
          end_date,
          guests_count: Number(guests_count),
          guest_name: String(guest_name).trim(),
          guest_email: String(guest_email).trim(),
          notes: notes ? String(notes).trim() : null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke opprette reservasjon.");

      setOk("✅ Reservasjon opprettet!");
      setTimeout(() => router.push("/reserver"), 900);
    } catch (e) {
      setError(e?.message || "Ukjent feil ved opprettelse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.reservePageShell}>
      <section className={styles.reserveHero}>
        <Image
          src="/images/hytte.jpg"
          alt="Hytte reservasjon"
          fill
          priority
          className={styles.reserveHeroImage}
        />
        <div className={styles.reserveHeroOverlay} />

        <div className={styles.reserveHeroContent}>
          <p className={styles.reserveHeroKicker}>Fritt Fram</p>
          <h1 className={styles.reserveHeroTitle}>Bestill hytte</h1>
          <p className={styles.reserveHeroText}>Velg datoer og fullfor reservasjonen i samme stil som resten av appen.</p>
        </div>
      </section>

      <section className={styles.reserveContentSection}>
        <div className={styles.page} style={{ paddingBottom: 120 }}>
          <div className={styles.container}>
            <div className={styles.notice}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 900 }}>🗓️ Reserver hytte</span>
                <Link className={styles.button} href="/reserver">
                  ← Tilbake
                </Link>
              </div>
            </div>

          {!cabinId ? (
            <div className={styles.card}>
              <div className={styles.cardContent}>
                <div className={styles.info}>
                  <h2>Mangler hytte</h2>
                  <p>Du kom hit uten cabinId. Gå tilbake og velg en hytte først.</p>
                  <div className={styles.actions}>
                    <Link className={styles.button} href="/reserver">
                      Til hytter
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.layout}>
              {/* Venstre: skjema */}
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <form className={styles.form} onSubmit={submit}>
                    <h2 className={styles.sectionTitle}>Bestillingsinformasjon</h2>

                    <div className={styles.row2}>
                      <div className={styles.field}>
                        <div className={styles.label}>Fra dato</div>
                        <input
                          className={styles.input}
                          type="date"
                          value={start_date}
                          onChange={(e) => setStart(e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.field}>
                        <div className={styles.label}>Til dato</div>
                        <input
                          className={styles.input}
                          type="date"
                          value={end_date}
                          onChange={(e) => setEnd(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {dateError ? <div className={styles.errorBox}>❌ {dateError}</div> : null}

                    <div className={styles.field}>
                      <div className={styles.label}>Antall personer</div>
                      <input
                        className={styles.input}
                        type="number"
                        min="1"
                        max={cabin?.capacity ?? 50}
                        value={guests_count}
                        onChange={(e) => setGuests(e.target.value)}
                        required
                      />
                      <div className={styles.helper}>Maks: {cabin?.capacity ?? "ukjent"}</div>
                    </div>

                    {guestsError ? <div className={styles.errorBox}>❌ {guestsError}</div> : null}

                    <h2 className={styles.sectionTitle} style={{ marginTop: 6 }}>
                      Kontaktinformasjon
                    </h2>

                    <div className={styles.row2}>
                      <div className={styles.field}>
                        <div className={styles.label}>Navn</div>
                        <input
                          className={styles.input}
                          value={guest_name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="Ola Nordmann"
                        />
                      </div>

                      <div className={styles.field}>
                        <div className={styles.label}>E-post</div>
                        <input
                          className={styles.input}
                          value={guest_email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="ola@eksempel.no"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.label}>Kommentar (valgfritt)</div>
                      <textarea
                        className={styles.textarea}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="F.eks. ankommer sent fredag."
                      />
                    </div>

                    {error ? <div className={styles.errorBox}>❌ {error}</div> : null}
                    {ok ? <div className={styles.successBox}>{ok}</div> : null}

                    <div className={styles.actionsRow}>
                      <button className={styles.button} type="submit" disabled={!canSubmit}>
                        {submitting ? "⏳ Oppretter..." : "✅ Bekreft reservasjon"}
                      </button>
                      <Link className={styles.buttonSecondary} href="/reserver">
                        Avbryt
                      </Link>
                    </div>

                    <div className={styles.helper}>
                      Hvis hytta allerede er reservert i perioden får du beskjed og kan velge nye datoer.
                    </div>
                  </form>
                </div>
              </div>

              {/* Høyre: oppsummering */}
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.info}>
                    <h2>Oppsummering</h2>

                    {loadingCabin ? (
                      <p>⏳ Laster hytteinfo...</p>
                    ) : !cabin ? (
                      <div className={styles.errorBox}>
                        ❌ Fant ikke hytta (sjekk cabinId).
                      </div>
                    ) : (
                      <>
                        {Array.isArray(cabin.image_urls) && cabin.image_urls.length > 0 ? (
                          <div className={styles.imageGrid}>
                            {cabin.image_urls.map((url) => (
                              <div className={styles.imageCard} key={url}>
                                <Image
                                  src={url}
                                  alt={`Bilde av ${cabin.name}`}
                                  className={styles.cabinImage}
                                  width={640}
                                  height={480}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.helper} style={{ marginBottom: 10 }}>
                            Ingen bilder registrert for denne hytta ennå.
                          </div>
                        )}

                        <div className={styles.meta}>
                          <b>{cabin.name}</b>
                          <br />
                          📍 {cabin.location}
                          <br />
                          👥 {cabin.capacity} pers
                          <br />
                          💰 {cabin.price_per_night} kr/natt
                        </div>

                        {cabin.description ? (
                          <p style={{ marginTop: 10 }}>{cabin.description}</p>
                        ) : null}

                        <div className={styles.meta} style={{ marginTop: 10 }}>
                          🗓️ Netter: <b>{nights}</b>
                          <br />
                          👥 Personer: <b>{Number(guests_count) || 0}</b>
                          <br />
                          💰 Estimert pris:{" "}
                          <b>{estimatedPrice != null ? `${estimatedPrice} kr` : "—"}</b>
                        </div>

                        <div className={styles.meta} style={{ marginTop: 10, fontSize: 13 }}>
                          🏡{" "}
                          {cabin.amenities?.length
                            ? cabin.amenities.join(", ")
                            : "Ingen registrerte fasiliteter"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </section>
    </main>
  );
}
