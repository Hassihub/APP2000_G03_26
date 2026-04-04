"use client";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <div style={{ background: "#0d1117", minHeight: "100vh", color: "#f9fafb", fontFamily: "'Inter','Poppins',sans-serif" }}>

      {/* Page header */}
      <div style={{ background: "linear-gradient(160deg,#0f1117 0%,#1a2035 100%)", padding: "3rem 2rem 2.5rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#4b5563" }}>Hytter</p>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>Reserver hytte</h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
            {loading ? t.loadingCabins : errorMsg ? errorMsg : formatTranslation(t.availableCabins, { count: cabins.length })}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 2rem 6rem", display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* LEFT — list */}
        <div style={{ background: "#111827", border: "1px solid #1e2539", borderRadius: 4, overflow: "hidden", position: "sticky", top: 80 }}>
          <div style={{ padding: "1rem 1rem 0.5rem", borderBottom: "1px solid #1e2539" }}>
            <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#4b5563" }}>{t.selectCabin}</p>
          </div>

          <div>
            {!loading && !errorMsg && cabins.length === 0 ? (
              <div style={{ padding: "2rem", color: "#4b5563", fontSize: "0.88rem", textAlign: "center" }}>{t.noCabins}</div>
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
                    borderTop: "none", borderRight: "none", borderBottom: "1px solid #1e2539",
                    borderLeft: isActive ? "3px solid #4f6ef7" : "3px solid transparent",
                    color: isActive ? "#f9fafb" : "#9ca3af", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: isActive ? "#f9fafb" : "#d1d5db" }}>{cabin.name}</span>
                    <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "#f9fafb", whiteSpace: "nowrap" }}>{cabin.price_per_night} kr</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>{cabin.location} &middot; {cabin.capacity} {t.people}</div>
                </button>
              );
            })}
          </div>

          <div style={{ padding: "0.85rem 1rem" }}>
            <Link
              href="/reserver/ny"
              style={{ display: "block", padding: "0.7rem", background: "#0d1117", border: "1px solid #1e2539", borderRadius: 4, color: "#9ca3af", textDecoration: "none", fontWeight: 700, fontSize: "0.8rem", textAlign: "center", letterSpacing: "0.02em" }}
            >
              + {t.addCabin}
            </Link>
          </div>
        </div>

        {/* RIGHT — detail */}
        {selectedCabin ? (
          <div style={{ background: "#111827", border: "1px solid #1e2539", borderRadius: 4, overflow: "hidden" }}>

            {/* Hero image */}
            <div style={{ height: 260, position: "relative", background: "#0d1117" }}>
              <img
                src="/images/hytte.jpg"
                alt={selectedCabin.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #111827 100%)" }} />
              <div style={{ position: "absolute", bottom: "1.5rem", left: "1.75rem", right: "1.75rem" }}>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#6b7280" }}>{t.location}: {selectedCabin.location}</p>
                <h2 style={{ margin: 0, fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.04em", lineHeight: 1.1 }}>{selectedCabin.name}</h2>
              </div>
            </div>

            {/* Info rows */}
            <div style={{ borderBottom: "1px solid #1e2539" }}>
              {[
                { label: "Kapasitet", value: `${selectedCabin.capacity} personer` },
                { label: "Pris", value: `${selectedCabin.price_per_night} kr / natt` },
                { label: "Sted", value: selectedCabin.location },
                ...(selectedCabin.description ? [{ label: "Beskrivelse", value: selectedCabin.description }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "1rem", padding: "0.9rem 1.75rem", borderBottom: "1px solid #1e2539" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4b5563", paddingTop: "0.1rem" }}>{label}</span>
                  <span style={{ fontSize: "0.9rem", color: "#d1d5db", lineHeight: 1.6 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Amenities */}
            {selectedCabin.amenities?.length > 0 && (
              <div style={{ padding: "1.1rem 1.75rem", borderBottom: "1px solid #1e2539" }}>
                <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#4b5563" }}>Fasiliteter</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {selectedCabin.amenities.map((a) => (
                    <span key={a} style={{ padding: "0.25rem 0.75rem", background: "#0d1117", border: "1px solid #1e2539", borderRadius: 4, fontSize: "0.78rem", color: "#9ca3af", fontWeight: 600 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ padding: "1.25rem 1.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {bookingHref && (
                <Link
                  href={bookingHref}
                  style={{ flex: "1 1 160px", display: "block", padding: "0.9rem 1.5rem", background: "#fff", color: "#111827", borderRadius: 4, textDecoration: "none", fontWeight: 800, fontSize: "0.88rem", textAlign: "center", letterSpacing: "0.02em" }}
                >
                  {t.reserveCabin} →
                </Link>
              )}
              <Link
                href="/reserver/ny"
                style={{ flex: "1 1 130px", display: "block", padding: "0.9rem 1.5rem", background: "transparent", color: "#6b7280", border: "1px solid #1e2539", borderRadius: 4, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem", textAlign: "center" }}
              >
                {t.addCabin}
              </Link>
            </div>

          </div>
        ) : (
          <div style={{ background: "#111827", border: "1px solid #1e2539", borderRadius: 4, padding: "4rem 2rem", color: "#4b5563", textAlign: "center", fontSize: "0.9rem" }}>
            {loading ? t.loading : errorMsg ? t.loadError : t.selectPrompt}
          </div>
        )}

      </div>
    </div>
  );
}
