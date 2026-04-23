// Laget av Sigurd

"use client";

export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatTranslation, useTranslations } from "../components/LanguageProvider";
import CabinWeather from "./CabinWeather";
import TripImageCarousel from "../explore/[id]/TripImageCarousel";

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

  function formatRating(cabin) {
    const avg = Number(cabin?.average_rating);
    const count = Number(cabin?.review_count) || 0;
    if (!Number.isFinite(avg)) return "Ingen anmeldelser";
    return `${avg.toFixed(1)} / 5 (${count})`;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Inter','Poppins',sans-serif" }}>

      {/* Page header */}
      <div style={{ background: "var(--bg-panel)", padding: "3rem 2rem 2.5rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Hytter</p>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>Reserver hytte</h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {loading ? t.loadingCabins : errorMsg ? errorMsg : formatTranslation(t.availableCabins, { count: cabins.length })}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 2rem 6rem", display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* LEFT — list */}
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", position: "sticky", top: 80 }}>
          <div style={{ padding: "1rem 1rem 0.5rem", borderBottom: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)" }}>{t.selectCabin}</p>
          </div>

          <div>
            {!loading && !errorMsg && cabins.length === 0 ? (
              <div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.88rem", textAlign: "center" }}>{t.noCabins}</div>
            ) : null}

            {cabins.map((cabin) => {
              const isActive = cabin.id === selectedId;
              return (
                <button
                  key={cabin.id}
                  onClick={() => setSelectedId(cabin.id)}
                  type="button"
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "0.9rem 1rem", background: "transparent",
                    borderTop: "none", borderRight: "none", borderBottom: "1px solid var(--border)",
                    borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                    color: isActive ? "var(--text)" : "var(--text-muted)", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: isActive ? "var(--text)" : "var(--text-muted)" }}>{cabin.name}</span>
                    <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text)", whiteSpace: "nowrap" }}>{cabin.price_per_night} kr</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{cabin.location} &middot; {cabin.capacity} {t.people}</div>
                  <div style={{ fontSize: "0.72rem", color: "#9a6700", marginTop: "0.2rem", fontWeight: 700 }}>
                    ★ {formatRating(cabin)}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ padding: "0.85rem 1rem" }}>
            <Link
              href="/reserver/ny"
              style={{ display: "block", padding: "0.7rem", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, fontSize: "0.8rem", textAlign: "center", letterSpacing: "0.02em" }}
            >
              + {t.addCabin}
            </Link>
          </div>
        </div>

        {/* RIGHT — detail */}
        {selectedCabin ? (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>

            {/* Hero image / carousel */}
            {selectedCabin.image_urls?.length > 0 ? (
              <TripImageCarousel
                images={selectedCabin.image_urls}
                altBase={selectedCabin.name}
              />
            ) : (
              <div style={{ height: 260, position: "relative", background: "var(--bg)" }}>
                <Image
                  src="/images/hytte.jpg"
                  alt={selectedCabin.name}
                  fill
                  sizes="(max-width: 1200px) 100vw, 900px"
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, var(--bg-panel) 100%)" }} />
              </div>
            )}
            <div style={{ padding: "0.75rem 1.75rem 0.5rem" }}>
              <p style={{ margin: "0 0 0.2rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)" }}>{t.location}: {selectedCabin.location}</p>
              <h2 style={{ margin: 0, fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1.1 }}>{selectedCabin.name}</h2>
            </div>

            {/* Info rows */}
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              {[
                { label: "Kapasitet", value: `${selectedCabin.capacity} personer` },
                { label: "Pris", value: `${selectedCabin.price_per_night} kr / natt` },
                { label: "Sted", value: selectedCabin.location },
                { label: "Rating", value: formatRating(selectedCabin) },
                ...(selectedCabin.description ? [{ label: "Beskrivelse", value: selectedCabin.description }] : []),
                { label: "Utleier", value: selectedCabin.owner_name || selectedCabin.owner_id || "Ikke oppgitt" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "1rem", padding: "0.9rem 1.75rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", paddingTop: "0.1rem" }}>{label}</span>
                  <span style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6 }}>{value}</span>
                </div>
              ))}
              {/* Vær */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "1rem", padding: "0.9rem 1.75rem", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", paddingTop: "0.1rem" }}>Vær nå</span>
                <CabinWeather
                  location={selectedCabin.location}
                  lat={selectedCabin.latitude}
                  lon={selectedCabin.longitude}
                />
              </div>
            </div>

            {/* Amenities */}
            {selectedCabin.amenities?.length > 0 && (
              <div style={{ padding: "1.1rem 1.75rem", borderBottom: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Fasiliteter</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {selectedCabin.amenities.map((a) => (
                    <span key={a} style={{ padding: "0.25rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ padding: "1.25rem 1.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {bookingHref && (
                <Link
                  href={bookingHref}
                  style={{ flex: "1 1 160px", display: "block", padding: "0.9rem 1.5rem", background: "var(--accent)", color: "#fff", borderRadius: 4, textDecoration: "none", fontWeight: 800, fontSize: "0.88rem", textAlign: "center", letterSpacing: "0.02em" }}
                >
                  {t.reserveCabin} →
                </Link>
              )}
              <Link
                href="/reserver/ny"
                style={{ flex: "1 1 130px", display: "block", padding: "0.9rem 1.5rem", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem", textAlign: "center" }}
              >
                {t.addCabin}
              </Link>
            </div>

          </div>
        ) : (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, padding: "4rem 2rem", color: "var(--text-muted)", textAlign: "center", fontSize: "0.9rem" }}>
            {loading ? t.loading : errorMsg ? t.loadError : t.selectPrompt}
          </div>
        )}

      </div>
    </div>
  );
}
