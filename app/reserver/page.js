"use client";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./Reserver.module.css";
import { formatTranslation, useTranslations } from "../components/LanguageProvider";

export default function CabinsPage() {
  const searchParams = useSearchParams();
  const t = useTranslations("reservePage");
  const cabinIdFromUrl = searchParams.get("cabinId");
  const [cabins, setCabins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadCabins() {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("/api/cabins", { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || t.cabinsLoadError);
        }

        if (!alive) return;

        const list = Array.isArray(json.cabins) ? json.cabins : [];
        setCabins(list);

        setSelectedId((prev) => {
          if (cabinIdFromUrl) {
            const match = list.find((item) => String(item.id) === cabinIdFromUrl);
            if (match) {
              return match.id;
            }
          }

          return prev ?? (list[0]?.id ?? null);
        });
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || t.unknownCabinError);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadCabins();

    return () => {
      alive = false;
    };
  }, [cabinIdFromUrl, t.cabinsLoadError, t.unknownCabinError]);

  useEffect(() => {
    if (!cabinIdFromUrl || cabins.length === 0) {
      return;
    }

    const match = cabins.find((item) => String(item.id) === cabinIdFromUrl);
    if (match) {
      setSelectedId(match.id);
    }
  }, [cabins, cabinIdFromUrl]);

  const selectedCabin = useMemo(() => {
    if (!selectedId) return null;
    return cabins.find((c) => c.id === selectedId) ?? null;
  }, [cabins, selectedId]);

  // NY: link til booking-side uten [cabinId]-mappe (bruker query param)
  const bookingHref = useMemo(() => {
    if (!selectedCabin?.id) return null;
    return `/reserver/booking?cabinId=${encodeURIComponent(selectedCabin.id)}`;
  }, [selectedCabin]);

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Main */}
      <main style={{ padding: 0, paddingBottom: 120 }}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              {loading
                ? t.loadingCabins
                : errorMsg
                ? errorMsg
                : formatTranslation(t.availableCabins, { count: cabins.length })}
            </div>

            <div className={styles.layout}>
              {/* Venstre: liste */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>{t.selectCabin}</h3>

                <div className={styles.list}>
                  {!loading && !errorMsg && cabins.length === 0 ? (
                    <div className={styles.empty}>{t.noCabins}</div>
                  ) : null}

                  {cabins.map((cabin) => {
                    const isActive = cabin.id === selectedId;
                    return (
                      <button
                        key={cabin.id}
                        className={`${styles.listItem} ${isActive ? styles.active : ""}`}
                        onClick={() => setSelectedId(cabin.id)}
                        type="button"
                      >
                        <div className={styles.listItemTop}>
                          <span className={styles.cabinName}>{cabin.name}</span>
                          <span className={styles.price}>{cabin.price_per_night} kr/natt</span>
                        </div>

                        <div className={styles.listItemMeta}>
                          {t.location}: {cabin.location} • {t.capacity}: {cabin.capacity} {t.people}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link className={styles.button} href="/reserver/ny">
                    {t.addCabin}
                  </Link>
                </div>
              </div>

              {/* Høyre: detalj */}
              <div className={styles.card}>
                {selectedCabin ? (
                  <div className={styles.cardContent}>
                    <div className={styles.info}>
                      <h2>{selectedCabin.name}</h2>
                      <p>{selectedCabin.description ?? t.noAmenities}</p>

                      <div className={styles.meta}>
                        {t.location}: {selectedCabin.location}
                        <br />
                        {t.capacity}: {selectedCabin.capacity} {t.people}
                        <br />
                        {selectedCabin.price_per_night} kr {t.pricePerNight}
                        <br />
                        {selectedCabin.amenities?.length
                          ? selectedCabin.amenities.join(", ")
                          : t.noAmenities}
                      </div>

                      <div className={styles.actions}>
                        {bookingHref ? (
                          <Link className={styles.button} href={bookingHref}>
                            {t.reserveCabin}
                          </Link>
                        ) : null}

                        <Link className={styles.button} href="/reserver/ny">
                          {t.addCabin}
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.empty}>
                    {loading
                      ? t.loading
                      : errorMsg
                      ? t.loadError
                      : t.selectPrompt}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
