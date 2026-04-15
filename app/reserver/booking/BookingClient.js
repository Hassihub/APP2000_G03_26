"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Reserver.module.css";
import CabinWeather from "../CabinWeather";

export default function BookingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cabinId = searchParams.get("cabinId");
  const loginHref = cabinId
    ? `/login?redirect=${encodeURIComponent(`/reserver/booking?cabinId=${cabinId}`)}`
    : "/login?redirect=%2Freserver";

  const [cabin, setCabin] = useState(null);
  const [loadingCabin, setLoadingCabin] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [start_date, setStart] = useState("");
  const [end_date, setEnd] = useState("");
  const [guests_count, setGuests] = useState(1);

  const [guest_name, setName] = useState("");
  const [guest_email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [showWeather, setShowWeather] = useState(false);
  const [weather, setWeather] = useState(null);

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
          setIsAuthenticated(false);
          setAuthChecked(true);
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (data?.user) {
          setIsAuthenticated(true);
          setName(data.user.username || "");
          setEmail(data.user.email || "");
        } else {
          setIsAuthenticated(false);
          setAuthChecked(true);
          return;
        }
        setAuthChecked(true);
      } catch {
        // Hvis auth-kallet feiler, lar vi siden vises og holder bare innsendingen låst.
        if (alive) {
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      }
    }

    loadUser();

    async function loadCabin() {
      try {
        setLoadingCabin(true);
        setError("");

        const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`);
        const json = await res.json().catch(() => ({}));

        if (!res.ok)
          throw new Error(json?.error || "Kunne ikke hente hytteinfo.");
        const found = json?.cabin ?? null;

        if (!alive) return;
        setCabin(found);

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
  }, [cabinId, loginHref, router]);
  useEffect(() => {
    if (!cabin?.location) return;
    async function fetchWeather() {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(cabin.location)}`,
      );
      const data = await res.json();
      const locations = Array.isArray(data) ? data : data.locations || [];
      if (locations.length > 0) {
        const loc = locations[0];
        const weatherRes = await fetch(
          `/api/vaer?lat=${loc.lat}&lon=${loc.lon}`,
        );
        setWeather(await weatherRes.json());
      }
    }
    fetchWeather();
  }, [cabin?.location]);
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

  const nightlyPrice = useMemo(() => {
    const p = Number(cabin?.price_per_night);
    return Number.isFinite(p) && p > 0 ? p : null;
  }, [cabin]);

  function formatNok(value) {
    if (!Number.isFinite(value)) return "—";
    return `${value.toLocaleString("nb-NO")} kr`;
  }

  const dateError = useMemo(() => {
    if (!start_date || !end_date) return "";
    return nights <= 0 ? "Til-dato må være etter fra-dato." : "";
  }, [start_date, end_date, nights]);

  const guestsError = useMemo(() => {
    const gc = Number(guests_count);
    if (!Number.isFinite(gc) || gc <= 0)
      return "Antall personer må være et tall > 0.";
    if (cabin?.capacity && gc > cabin.capacity) {
      return `Antall personer kan ikke være mer enn ${cabin.capacity}.`;
    }
    return "";
  }, [guests_count, cabin]);

  const canSubmit = useMemo(() => {
    if (!cabinId) return false;
    if (!authChecked) return false;
    if (!start_date || !end_date) return false;
    if (dateError) return false;
    if (guestsError) return false;
    if (!String(guest_name).trim()) return false;
    if (!String(guest_email).trim()) return false;
    return !submitting;
  }, [
    cabinId,
    start_date,
    end_date,
    dateError,
    guestsError,
    guest_name,
    guest_email,
    submitting,
    authChecked,
    isAuthenticated,
  ]);

  async function submit(e) {
    e.preventDefault();

    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

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
      if (!res.ok)
        throw new Error(json?.error || "Kunne ikke opprette reservasjon.");

      setOk("✅ Reservasjon opprettet!");
      setTimeout(() => router.push("/reserver"), 900);
    } catch (e) {
      setError(e?.message || "Ukjent feil ved opprettelse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main className={styles.page} style={{ paddingBottom: 120 }}>
        <div className={styles.container}>
          {!authChecked ? null : !isAuthenticated ? (
            <div className={styles.notice} style={{ marginBottom: 16 }}>
              Du kan se hytta og fylle ut reservasjonen her, men må logge inn for å bekrefte bestillingen.
            </div>
          ) : null}

          <div className={styles.notice}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
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
                  <p>
                    Du kom hit uten cabinId. Gå tilbake og velg en hytte først.
                  </p>
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
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <form
                    className={`${styles.form} ${styles.bookingFormPanel}`}
                    onSubmit={submit}
                  >
                    <h2 className={styles.sectionTitle}>
                      Bestillingsinformasjon
                    </h2>

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

                    {dateError ? (
                      <div className={styles.errorBox}>❌ {dateError}</div>
                    ) : null}

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
                      <div className={styles.helper}>
                        Maks: {cabin?.capacity ?? "ukjent"}
                      </div>
                    </div>

                    {guestsError ? (
                      <div className={styles.errorBox}>❌ {guestsError}</div>
                    ) : null}

                    <h2
                      className={styles.sectionTitle}
                      style={{ marginTop: 6 }}
                    >
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

                    {error ? (
                      <div className={styles.errorBox}>❌ {error}</div>
                    ) : null}
                    {ok ? <div className={styles.successBox}>{ok}</div> : null}

                    <div className={styles.actionsRow}>
                      {isAuthenticated ? (
                        <button
                          className={styles.button}
                          type="submit"
                          disabled={!canSubmit}
                        >
                          {submitting
                            ? "⏳ Oppretter..."
                            : "✅ Bekreft reservasjon"}
                        </button>
                      ) : (
                        <Link className={styles.button} href={loginHref}>
                          Logg inn for å reservere
                        </Link>
                      )}
                      <Link className={styles.buttonSecondary} href="/reserver">
                        Avbryt
                      </Link>
                    </div>

                    <div className={styles.helper}>
                      Hvis hytta allerede er reservert i perioden får du beskjed
                      og kan velge nye datoer.
                    </div>
                  </form>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.summaryPanel}>
                    <div className={styles.summaryHeader}>
                      <h2 className={styles.summaryTitle}>Oppsummering</h2>
                      <p className={styles.summarySubtitle}>
                        Her får du en rask oversikt før du bekrefter.
                      </p>
                    </div>

                    {loadingCabin ? (
                      <p>⏳ Laster hytteinfo...</p>
                    ) : !cabin ? (
                      <div className={styles.errorBox}>
                        ❌ Fant ikke hytta (sjekk cabinId).
                      </div>
                    ) : (
                      <>
                        {Array.isArray(cabin.image_urls) &&
                        cabin.image_urls.length > 0 ? (
                          <div className={styles.summaryImageGallery}>
                            <div className={styles.summaryImageHero}>
                              <Image
                                src={cabin.image_urls[0]}
                                alt={`Hovedbilde av ${cabin.name}`}
                                className={styles.summaryImageHeroImg}
                                width={1280}
                                height={820}
                              />
                            </div>

                            {cabin.image_urls.length > 1 ? (
                              <div className={styles.summaryThumbGrid}>
                                {cabin.image_urls.slice(1).map((url) => (
                                  <div className={styles.summaryThumbCard} key={url}>
                                    <Image
                                      src={url}
                                      alt={`Bilde av ${cabin.name}`}
                                      className={styles.summaryThumbImage}
                                      width={420}
                                      height={300}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div
                            className={styles.helper}
                            style={{ marginBottom: 10 }}
                          >
                            Ingen bilder registrert for denne hytta ennå.
                          </div>
                        )}

                        <div className={styles.summaryTopRow}>
                          <div>
                            <h3 className={styles.summaryCabinName}>{cabin.name}</h3>
                            <p className={styles.summaryLocation}>📍 {cabin.location}</p>
                          </div>
                          <span className={styles.summaryCabinType}>
                            {cabin.is_staffed ? "Betjent" : "Ubetjent"}
                          </span>
                        </div>

                        <div className={styles.summaryWeatherRow}>
                          <span className={styles.summaryWeatherNow}>
                            <CabinWeather
                              location={cabin.location}
                              lat={cabin.latitude}
                              lon={cabin.longitude}
                            />
                          </span>
                          <div
                            className={styles.summaryWeatherPopoverWrap}
                          >
                            <button
                              className={styles.summaryWeatherButton}
                              onClick={() => setShowWeather((prev) => !prev)}
                              type="button"
                            >
                              🌤️ {showWeather ? "Skjul" : "Vis værmelding"}
                            </button>
                            {showWeather && weather?.daily && (
                              <div className={styles.summaryWeatherPopover}>
                                <strong className={styles.summaryWeatherTitle}>
                                  📅 7-dagers prognose
                                </strong>
                                <div className={styles.summaryWeatherList}>
                                  {weather.daily.map((day) => (
                                    <div key={day.date} className={styles.summaryWeatherItem}>
                                      <span className={styles.summaryWeatherDate}>
                                        {new Date(day.date).toLocaleDateString(
                                          "nb-NO",
                                          {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "short",
                                          },
                                        )}
                                      </span>
                                      <span>
                                        🌡️ {day.tempMin}° / {day.tempMax}°
                                      </span>
                                      <span>🌧️ {day.totalPrecipitation}mm</span>
                                      <span>💨 {day.avgWindSpeed}m/s</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {cabin.description ? (
                          <p className={styles.summaryDescription}>{cabin.description}</p>
                        ) : null}

                        <div className={styles.summaryAmenitiesSection}>
                          <h4 className={styles.summaryAmenitiesTitle}>Fasiliteter</h4>
                          {Array.isArray(cabin.amenities) && cabin.amenities.length > 0 ? (
                            <div className={styles.summaryAmenitiesList}>
                              {cabin.amenities.map((amenity) => (
                                <span key={amenity} className={styles.summaryAmenityChip}>
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className={styles.summaryNoAmenities}>
                              Ingen registrerte fasiliteter.
                            </p>
                          )}
                        </div>

                        <div className={styles.summaryStatsGrid}>
                          <div className={styles.summaryStatCard}>
                            <span className={styles.summaryStatLabel}>Netter</span>
                            <span className={styles.summaryStatValue}>{nights}</span>
                          </div>
                          <div className={styles.summaryStatCard}>
                            <span className={styles.summaryStatLabel}>Personer</span>
                            <span className={styles.summaryStatValue}>{Number(guests_count) || 0}</span>
                          </div>
                          <div className={styles.summaryStatCard}>
                            <span className={styles.summaryStatLabel}>Kapasitet</span>
                            <span className={styles.summaryStatValue}>{cabin.capacity} pers</span>
                          </div>
                          <div className={styles.summaryStatCard}>
                            <span className={styles.summaryStatLabel}>Pris per natt</span>
                            <span className={styles.summaryStatValue}>{formatNok(nightlyPrice)}</span>
                          </div>
                          <div className={`${styles.summaryStatCard} ${styles.summaryTotalCard}`}>
                            <span className={styles.summaryStatLabel}>Estimert total</span>
                            <span className={styles.summaryTotalValue}>{formatNok(estimatedPrice)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
