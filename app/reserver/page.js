"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Reserver.module.css";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../lib/roles";

export default function ReserverPage() {
  const [cabins, setCabins] = useState([]);
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

  function hasManageAccess(cabin) {
    if (!cabin || !userRole) return false;
    if (userRole === ROLE_ADMIN) return true;
    if (userRole === ROLE_UTLEIER) return cabin.owner_id === userId;
    return false;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>🏡 Velg hytte</div>

            {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

            {(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN) && (
              <div style={{ marginBottom: 12 }}>
                <Link className={styles.button} href="/reserver/ny">
                  ➕ Legg til hytte
                </Link>
              </div>
            )}

            {loading ? (
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.empty}>Laster hytter...</div>
                </div>
              </div>
            ) : cabins.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.empty}>Ingen hytter enda.</div>
                </div>
              </div>
            ) : (
              <div className={styles.cabinGrid}>
                {cabins.map((cabin) => {
                  const previewImage = Array.isArray(cabin.image_urls) && cabin.image_urls.length > 0
                    ? cabin.image_urls[0]
                    : null;

                  return (
                    <article key={cabin.id} className={styles.cabinTile}>
                      <Link
                        href={`/reserver/booking?cabinId=${encodeURIComponent(cabin.id)}`}
                        className={styles.cabinLink}
                      >
                        <div className={styles.tileImageWrap}>
                          {previewImage ? (
                            <Image
                              src={previewImage}
                              alt={`Forsidebilde av ${cabin.name}`}
                              className={styles.tileImage}
                              width={640}
                              height={480}
                            />
                          ) : (
                            <div className={styles.tileImageFallback}>Ingen bilde</div>
                          )}
                        </div>

                        <div className={styles.tileBody}>
                          <h3 className={styles.tileTitle}>{cabin.name}</h3>
                          <div className={styles.tileMeta}>📍 {cabin.location}</div>
                          <div className={styles.tileStats}>
                            <span>💰 {Number(cabin.price_per_night)} kr / natt</span>
                            <span>👥 {Number(cabin.capacity)} personer</span>
                          </div>
                        </div>
                      </Link>

                      {hasManageAccess(cabin) && (
                        <div className={styles.actionsRow} style={{ padding: "0 12px 12px" }}>
                          <Link
                            className={styles.buttonSecondary}
                            href={`/reserver/edit?cabinId=${encodeURIComponent(cabin.id)}`}
                          >
                            ✏️ Rediger
                          </Link>

                          <button
                            className={styles.buttonSecondary}
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Slette "${cabin.name}"? Dette kan ikke angres.`)) return;

                              const res = await fetch(`/api/cabins/${cabin.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const json = await res.json().catch(() => ({}));

                              if (!res.ok) {
                                alert(json?.error || "Kunne ikke slette hytta.");
                                return;
                              }

                              setCabins((prev) => prev.filter((c) => c.id !== cabin.id));
                            }}
                          >
                            🗑️ Slett
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
