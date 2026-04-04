"use client";

import { useState } from "react";

export default function Kontakt() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // UI-only — no backend wired
    setSent(true);
  }

  const inputStyle = {
    width: "100%",
    padding: "0.85rem 1rem",
    background: "#111827",
    border: "1px solid #1e2539",
    borderRadius: 4,
    color: "#f9fafb",
    fontSize: "0.9rem",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <main style={{ background: "#0f1117", minHeight: "100vh", color: "#f9fafb", fontFamily: "'Inter', 'Poppins', sans-serif" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(160deg,#0f1117 0%,#1a2035 100%)", padding: "5rem 2rem 4rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6b7280" }}>Kontakt</p>
          <h1 style={{ margin: "0 0 1.25rem", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Ta kontakt med oss
          </h1>
          <p style={{ margin: 0, fontSize: "1.1rem", color: "#9ca3af", lineHeight: 1.75, maxWidth: 540 }}>
            Har du spørsmål, forslag eller tilbakemeldinger? Vi svarer deg innen 1–2 virkedager.
          </p>
        </div>
      </section>

      <section style={{ padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 380px", gap: "2.5rem", alignItems: "start" }}>

          {/* Kontaktskjema */}
          <div>
            <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Send oss en melding</h2>

            {sent ? (
              <div style={{ background: "#111827", border: "1px solid #4f6ef7", borderRadius: 4, padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✓</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem" }}>Meldingen er sendt!</div>
                <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Vi vil kontakte deg på {form.email} snart.</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.4rem" }}>Navn</label>
                    <input required name="name" value={form.name} onChange={handleChange} placeholder="Ola Nordmann" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.4rem" }}>E-post</label>
                    <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="ola@eksempel.no" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.4rem" }}>Emne</label>
                  <input required name="subject" value={form.subject} onChange={handleChange} placeholder="Hva gjelder henvendelsen?" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.4rem" }}>Melding</label>
                  <textarea required name="message" value={form.message} onChange={handleChange} placeholder="Skriv meldingen din her..." rows={6} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <button type="submit" style={{ padding: "0.9rem 2rem", background: "#fff", color: "#111827", border: "none", borderRadius: 4, fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", letterSpacing: "0.02em", alignSelf: "start" }}>
                  Send melding →
                </button>
              </form>
            )}
          </div>

          {/* Kontaktinfo */}
          <div style={{ display: "grid", gap: "1rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Kontaktinformasjon</h2>
            {[
              { icon: "✉", label: "E-post", value: "hei@frittfram.no" },
              { icon: "📞", label: "Telefon", value: "+47 22 00 00 00" },
              { icon: "📍", label: "Adresse", value: "Notodden, Telemark, Norge" },
              { icon: "⏱", label: "Svartid", value: "1–2 virkedager" },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ background: "#111827", border: "1px solid #1e2539", borderRadius: 4, padding: "1.1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.2rem", flexShrink: 0, marginTop: 2 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.2rem" }}>{label}</div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#f9fafb" }}>{value}</div>
                </div>
              </div>
            ))}

            {/* Sosialemedier */}
            <div style={{ background: "#111827", border: "1px solid #1e2539", borderRadius: 4, padding: "1.1rem 1.25rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "0.75rem" }}>Sosiale medier</div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                {["Instagram", "Facebook", "Twitter"].map((s) => (
                  <span key={s} style={{ padding: "0.35rem 0.85rem", background: "#1a2035", border: "1px solid #252d40", borderRadius: 4, fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
