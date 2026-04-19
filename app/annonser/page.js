"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const CATEGORIES = ["Alle", "Utstyr", "Overnatting", "Guiding", "Kurs", "Annet"];

function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/i.test(url || "");
}

const emptyAd = {
  title: "",
  description: "",
  price: "",
  category: "Utstyr",
  location: "",
  contact: "",
  image_url: "",
};

export default function Annonser() {
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newAd, setNewAd] = useState({ ...emptyAd });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAds();
  }, []);

  async function fetchAds() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ads", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke hente annonser");
      setAds(Array.isArray(data.ads) ? data.ads : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Opplasting feilet");
      setNewAd((prev) => ({ ...prev, image_url: data.filePath }));
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setImageUploading(false);
    }
  }

  async function handlePublish() {
    if (!newAd.title.trim()) {
      setSubmitError("Tittel er påkrevd");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAd),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke publisere annonse");
      setAds((prev) => [data.ad, ...prev]);
      setNewAd({ ...emptyAd });
      setShowNew(false);
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered =
    activeCategory === "Alle"
      ? ads
      : ads.filter((a) => a.category === activeCategory);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        fontFamily: "Poppins, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 0.3rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#667085",
              }}
            >
              Friluftsliv
            </p>
            <h1
              style={{
                margin: "0 0 0.5rem",
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "var(--text)",
                letterSpacing: "-0.03em",
              }}
            >
              Marked
            </h1>
            <p style={{ margin: 0, color: "#667085", fontSize: "1rem" }}>
              Kjøp, selg og lei friluftsutstyr og tjenester
            </p>
          </div>
          <button
            onClick={() => { setShowNew(!showNew); setSubmitError(""); }}
            style={{
              padding: "0.9rem 1.6rem",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            + Legg inn annonse
          </button>
        </div>

        {/* New ad form */}
        {showNew && (
          <div
            style={{
              background: "var(--bg-panel)",
              borderRadius: "12px",
              padding: "2rem",
              marginBottom: "2rem",
              boxShadow: "var(--shadow)",
              border: "1px solid var(--border)",
            }}
          >
            <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>
              Ny annonse
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                { label: "Tittel *", key: "title", type: "text" },
                { label: "Pris (f.eks. 1 500 kr)", key: "price", type: "text" },
                { label: "Sted", key: "location", type: "text" },
                { label: "Kontakt (e-post)", key: "contact", type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type}
                    value={newAd[key]}
                    onChange={(e) => setNewAd({ ...newAd, [key]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Kategori</label>
                <select
                  value={newAd.category}
                  onChange={(e) => setNewAd({ ...newAd, category: e.target.value })}
                  style={inputStyle}
                >
                  {CATEGORIES.filter((c) => c !== "Alle").map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Vedlegg (valgfritt)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    style={{
                      padding: "0.65rem 1.2rem",
                      background: imageUploading ? "#9ca3af" : "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: imageUploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {imageUploading ? "Laster opp..." : "Velg fil"}
                  </button>
                  {newAd.image_url && (
                    <div style={{ position: "relative" }}>
                      {isImageUrl(newAd.image_url) ? (
                        <Image
                          src={newAd.image_url}
                          alt="Forhåndsvisning"
                          width={96}
                          height={64}
                          unoptimized
                          style={{ height: "64px", width: "96px", objectFit: "cover", borderRadius: "6px", border: "1px solid #d1d5db" }}
                        />
                      ) : (
                        <div style={{ height: "64px", width: "96px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-input)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                          <span style={{ fontSize: "1.4rem" }}>📄</span>
                          <span style={{ fontSize: "0.55rem", color: "#6b7280", textAlign: "center", overflow: "hidden", width: "88px", whiteSpace: "nowrap", textOverflow: "ellipsis", padding: "0 4px" }}>
                            {newAd.image_url.split("/").pop()}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setNewAd((prev) => ({ ...prev, image_url: "" }))}
                        style={{
                          position: "absolute",
                          top: "-6px",
                          right: "-6px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                        background: "var(--text)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          lineHeight: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleImageUpload}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Beskrivelse</label>
                <textarea
                  value={newAd.description}
                  onChange={(e) => setNewAd({ ...newAd, description: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
            {submitError && (
              <p style={{ color: "#b42318", margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
                {submitError}
              </p>
            )}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handlePublish}
                disabled={submitting}
                style={{
                  padding: "0.8rem 1.5rem",
                  background: submitting ? "var(--text-muted)" : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {submitting ? "Publiserer..." : "Publiser"}
              </button>
              <button
                onClick={() => { setShowNew(false); setSubmitError(""); }}
                style={{
                  padding: "0.8rem 1.5rem",
                  background: "var(--bg-panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "0.5rem 1.1rem",
                borderRadius: "999px",
                border: `1px solid ${activeCategory === cat ? "var(--accent)" : "var(--border)"}`,
                background: activeCategory === cat ? "var(--accent)" : "var(--bg-panel)",
                color: activeCategory === cat ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && <p style={{ color: "#667085", textAlign: "center", padding: "3rem" }}>Laster annonser...</p>}
        {error && <p style={{ color: "#b42318", textAlign: "center", padding: "3rem" }}>{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ color: "#667085", textAlign: "center", padding: "3rem" }}>
            Ingen annonser ennå. Vær den første til å legge inn en!
          </p>
        )}

        {/* Ads grid */}
        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Sponsored ad — always first */}
            <div
              style={{
                background: "var(--bg-panel)",
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: "var(--shadow)",
                border: "1px solid rgba(79,110,247,0.35)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ margin: "-1.5rem -1.5rem 0", borderRadius: "12px 12px 0 0", overflow: "hidden", height: 160 }}>
                <Image src="/images/hytte.jpg" alt="Norlandia Hytter" width={1200} height={640} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ padding: "0.25rem 0.7rem", borderRadius: 999, background: "rgba(102,117,255,0.15)", color: "#a5b4fc", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", border: "1px solid rgba(102,117,255,0.3)" }}>
                  Betalt plassering
                </span>
                <span style={{ fontWeight: 800, color: "var(--text)" }}>Fra 1 290 kr/natt</span>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                Norlandia Hytter — Gaustablikk
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.55, flexGrow: 1 }}>
                Eksklusive fjellhytter med panoramautsikt. Nyt natur og ro — 15 % rabatt ved bestilling denne uken.
              </p>
              <div style={{ paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                <span style={{ color: "var(--text-muted)" }}>📍 Gaustablikk, Telemark</span>
                <a href="/reserver" style={{ padding: "0.5rem 1rem", background: "var(--accent)", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.78rem" }}>Se pakker →</a>
              </div>
            </div>

            {filtered.map((ad) => (
              <div
                key={ad.id}
                style={{
                  background: "var(--bg-panel)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  boxShadow: "var(--shadow)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {ad.image_url && isImageUrl(ad.image_url) && (
                  <div style={{ margin: "-1.5rem -1.5rem 0", borderRadius: "12px 12px 0 0", overflow: "hidden", height: "160px" }}>
                    <Image
                      src={ad.image_url}
                      alt={ad.title}
                      width={1200}
                      height={640}
                      unoptimized
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                {ad.image_url && !isImageUrl(ad.image_url) && (
                  <a
                    href={ad.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.8rem", color: "#2563eb", display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none" }}
                  >
                    📎 {ad.image_url.split("/").pop()}
                  </a>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{
                    padding: "0.25rem 0.7rem",
                    borderRadius: "999px",
                    background: "#f3f4f6",
                    color: "#374151",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}>
                    {ad.category}
                  </span>
                  {ad.price && (
                    <span style={{ fontWeight: 800, fontSize: "1rem", color: "#111827" }}>
                      {ad.price}
                    </span>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                  {ad.title}
                </h3>
                {ad.description && (
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#6b7280", lineHeight: 1.55, flexGrow: 1 }}>
                    {ad.description}
                  </p>
                )}
                <div style={{
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #f3f4f6",
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}>
                  {ad.location && <span>📍 {ad.location}</span>}
                  {ad.contact && <span style={{ wordBreak: "break-all" }}>{ad.contact}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "0.4rem",
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#667085",
};

const inputStyle = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};
