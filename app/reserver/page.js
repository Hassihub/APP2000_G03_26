"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./Reserver.module.css";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../lib/roles";

export default function ReserverPage() {
  const [cabins, setCabins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCabins() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/cabins");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data?.error || "Kunne ikke hente hytter");

        const list = data.cabins || [];
        setCabins(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      } catch (err) {
        setError(err?.message || "Ukjent feil");
      } finally {
        setLoading(false);
      }
    }

    fetchCabins();
  }, []);

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
          setUserRole(null);
          setUserId(null);
          return;
        }

        const data = await res.json().catch(() => ({}));
        setUserRole(data?.user?.role ?? null);
        setUserId(data?.user?.id ?? null);
      } catch {
        if (alive) {
          setUserRole(null);
          setUserId(null);
        }
      }
    }

    loadUser();
    return () => {
      alive = false;
    };
  }, []);

  const selectedCabin = useMemo(
    () => cabins.find((c) => c.id === selectedId) || null,
    [cabins, selectedId]
  );

  const hasManageAccess = useMemo(() => {
    if (!selectedCabin || !userRole) return false;
    if (userRole === ROLE_ADMIN) return true;
    if (userRole === ROLE_UTLEIER) return selectedCabin.owner_id === userId;
    return false;
  }, [selectedCabin, userRole, userId]);

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>🏡 Hytter</div>

            {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

            <div className={styles.layout}>
              {/* VENSTRE: LISTE */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>Alle hytter</h3>

                {loading ? (
                  <div className={styles.empty}>Laster...</div>
                ) : cabins.length === 0 ? (
                  <div className={styles.empty}>Ingen hytter enda.</div>
                ) : (
                  <ul className={styles.list}>
                    {cabins.map((cabin) => (
                      <li
                        key={cabin.id}
                        className={`${styles.listItem} ${
                          cabin.id === selectedId ? styles.active : ""
                        }`}
                        onClick={() => setSelectedId(cabin.id)}
                      >
                        <div className={styles.listItemTop}>
                          <span className={styles.cabinName}>{cabin.name}</span>
                          <span className={styles.price}>
                            {Number(cabin.price_per_night)} kr
                          </span>
                        </div>
                        <div className={styles.listItemMeta}>{cabin.location}</div>
                      </li>
                    ))}
                  </ul>
                )}

                {(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN) && (
                  <div style={{ marginTop: 12 }}>
                    <Link className={styles.button} href="/reserver/ny">
                      ➕ Legg til hytte
                    </Link>
                  </div>
                )}
              </div>

              {/* HØYRE: DETALJER */}
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  {!selectedCabin ? (
                    <div className={styles.empty}>Velg en hytte fra listen.</div>
                  ) : (
                    <div className={styles.info}>
                      <h2>{selectedCabin.name}</h2>

                      <div className={styles.meta}>
                        <div>📍 {selectedCabin.location}</div>
                        <div>👥 {Number(selectedCabin.capacity)} personer</div>
                        <div>💰 {Number(selectedCabin.price_per_night)} kr / natt</div>
                      </div>

                      {selectedCabin.description ? (
                        <p style={{ marginTop: 10 }}>{selectedCabin.description}</p>
                      ) : null}

                      {Array.isArray(selectedCabin.amenities) &&
                      selectedCabin.amenities.length > 0 ? (
                        <p style={{ marginTop: 10 }}>
                          <strong>Fasiliteter:</strong> {selectedCabin.amenities.join(", ")}
                        </p>
                      ) : null}

                      <div className={styles.actions}>
                        <div className={styles.actionsRow}>
                          <Link
                            className={styles.button}
                            href={`/reserver/booking?cabinId=${encodeURIComponent(
                              selectedCabin.id
                            )}`}
                          >
                            🗓️ Reserver
                          </Link>
                        </div>

                        {hasManageAccess && (
                          <div className={styles.actionsRow}>
                            <Link
                              className={styles.buttonSecondary}
                              href={`/reserver/edit?cabinId=${encodeURIComponent(
                                selectedCabin.id
                              )}`}
                            >
                              ✏️ Rediger
                            </Link>

                            <button
                              className={styles.buttonSecondary}
                              type="button"
                              onClick={async () => {
                                const id = selectedCabin.id;

                                if (!confirm(`Slette "${selectedCabin.name}"? Dette kan ikke angres.`))
                                  return;

                                const res = await fetch(`/api/cabins/${id}`, { method: "DELETE", credentials: "include" });
                                const json = await res.json().catch(() => ({}));

                                if (!res.ok) {
                                  alert(json?.error || "Kunne ikke slette hytta.");
                                  return;
                                }

                                // Fjern + oppdater selectedId basert på NY liste (unngår stale state)
                                setCabins((prev) => {
                                  const next = prev.filter((c) => c.id !== id);

                                  setSelectedId((curr) => {
                                    if (curr !== id) return curr;
                                    return next[0]?.id ?? null;
                                  });

                                  return next;
                                });
                              }}
                            >
                              🗑️ Slett
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
