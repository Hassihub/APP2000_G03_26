"use client";

import { useState } from "react";

const PACKAGES = [
  {
    name: "Starter",
    price: "990",
    period: "kr / mnd",
    spots: 1,
    positions: ["1 sidebar-plassering (høyre)"],
    duration: "30 dager",
    highlight: false,
  },
  {
    name: "Synlighet",
    price: "1 990",
    period: "kr / mnd",
    spots: 3,
    positions: ["2 sidebar-plasseringer (høyre + venstre)", "1 toppbanner"],
    duration: "30 dager",
    highlight: true,
  },
  {
    name: "Merkevare",
    price: "3 490",
    period: "kr / mnd",
    spots: 6,
    positions: ["4 sidebar-plasseringer", "1 toppbanner", "1 midtside-banner"],
    duration: "30 dager",
    highlight: false,
  },
  {
    name: "Partner",
    price: "5 990",
    period: "kr / mnd",
    spots: 10,
    positions: ["Ubegrenset antall plasseringer", "Prioritert posisjon", "Fremhevet merkevareprofil", "Dedikert kontaktperson"],
    duration: "30 dager",
    highlight: false,
  },
];

const PLACEMENTS = [
  { label: "Høyre sidebar", icon: "â–¶", desc: "Vises på alle sider, synlig for alle besøkende" },
  { label: "Venstre sidebar", icon: "â—€", desc: "Fremtredende posisjon, høy klikk-rate" },
  { label: "Toppbanner", icon: "â–²", desc: "Første ting brukeren ser â€“ maks synlighet" },
  { label: "Midtside-banner", icon: "â—†", desc: "Vises mellom innhold, naturlig integrert" },
];

export default function Annonseportal() {
  const [form, setForm] = useState({ company: "", contact: "", email: "", phone: "", package: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.company || !form.email) return;
    setSending(true);
    // Opens email client with pre-filled inquiry
    const subject = encodeURIComponent(`Annonseforespørsel â€“ ${form.company} (${form.package || "Ikke valgt"})`);
    const body = encodeURIComponent(
      `Bedrift: ${form.company}\nKontaktperson: ${form.contact}\nE-post: ${form.email}\nTelefon: ${form.phone}\nPakke: ${form.package}\n\nMelding:\n${form.message}`
    );
    window.location.href = `mailto:annonser@frittfram.no?subject=${subject}&body=${body}`;
    setSending(false);
    setSent(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", fontFamily: "Poppins, sans-serif" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)", color: "#fff", padding: "5rem 2rem 4rem" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>
            For bedrifter
          </p>
          <h1 style={{ margin: "0 0 1.25rem", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Nå turentusiastene<br />der de faktisk er
          </h1>
          <p style={{ margin: "0 auto", fontSize: "1.15rem", color: "var(--text)", maxWidth: "580px", lineHeight: 1.65 }}>
            FrittFram er Norges møteplass for friluftsliv. Knytt merkevaren din til turliv, hytter og naturopplevelser
            â€“ og vær synlig der kundene dine allerede er.
          </p>
        </div>
      </div>

      {/* Placements visual */}
      <div style={{ background: "#fff", padding: "4rem 2rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.6rem", fontWeight: 800, color: "var(--bg-panel)", textAlign: "center" }}>
            Tilgjengelige plasseringer
          </h2>
          <p style={{ margin: "0 0 2.5rem", color: "#667085", textAlign: "center", fontSize: "0.95rem" }}>
            Velg posisjon basert på synlighetsmål og budsjett
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.25rem" }}>
            {PLACEMENTS.map((p) => (
              <div key={p.label} style={{ background: "var(--text)", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--bg-panel)", marginBottom: "0.4rem" }}>{p.label}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Packages */}
      <div style={{ padding: "4rem 2rem" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.6rem", fontWeight: 800, color: "var(--bg-panel)", textAlign: "center" }}>
            Velg pakke
          </h2>
          <p style={{ margin: "0 0 2.5rem", color: "#667085", textAlign: "center", fontSize: "0.95rem" }}>
            Alle pakker inkluderer 30 dagers visning. Faktureres månedlig.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "1.25rem" }}>
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.name}
                style={{
                  background: pkg.highlight ? "var(--bg-panel)" : "#fff",
                  color: pkg.highlight ? "#fff" : "var(--bg-panel)",
                  border: pkg.highlight ? "none" : "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "2rem 1.5rem",
                  boxShadow: pkg.highlight ? "0 8px 32px rgba(17,24,39,0.18)" : "0 2px 12px rgba(0,0,0,0.06)",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {pkg.highlight && (
                  <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "var(--bg-panel)", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.25rem 0.9rem", borderRadius: "999px", whiteSpace: "nowrap" }}>
                    Mest populær
                  </div>
                )}
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: pkg.highlight ? "var(--text-muted)" : "#667085", marginBottom: "0.3rem" }}>
                    {pkg.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
                    <span style={{ fontSize: "2rem", fontWeight: 900 }}>{pkg.price}</span>
                    <span style={{ fontSize: "0.8rem", color: pkg.highlight ? "var(--text-muted)" : "var(--text-muted)" }}>{pkg.period}</span>
                  </div>
                </div>
                <div style={{ fontSize: "0.82rem", color: pkg.highlight ? "var(--text)" : "var(--text-muted)" }}>
                  {pkg.spots} {pkg.spots === 1 ? "plassering" : "plasseringer"} Â· {pkg.duration}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {pkg.positions.map((pos) => (
                    <li key={pos} style={{ fontSize: "0.83rem", display: "flex", alignItems: "flex-start", gap: "0.4rem", color: pkg.highlight ? "#e5e7eb" : "#374151" }}>
                      <span style={{ color: "#22c55e", flexShrink: 0 }}>âœ“</span> {pos}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inquiry form */}
      <div style={{ background: "#fff", padding: "4rem 2rem", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.6rem", fontWeight: 800, color: "var(--bg-panel)" }}>
            Send en forespørsel
          </h2>
          <p style={{ margin: "0 0 2rem", color: "#667085", fontSize: "0.95rem" }}>
            Fyll ut skjemaet, så tar vi kontakt med deg innen 1â€“2 virkedager.
          </p>
          {sent ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>âœ…</div>
              <p style={{ margin: 0, fontWeight: 700, color: "#166534", fontSize: "1.05rem" }}>Forespørselen er sendt!</p>
              <p style={{ margin: "0.5rem 0 0", color: "#15803d", fontSize: "0.9rem" }}>Vi svarer på e-post innen 1â€“2 virkedager.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Bedriftsnavn *</label>
                  <input name="company" required value={form.company} onChange={handleChange} style={inputStyle} placeholder="XXL Sport og Villmark" />
                </div>
                <div>
                  <label style={labelStyle}>Kontaktperson</label>
                  <input name="contact" value={form.contact} onChange={handleChange} style={inputStyle} placeholder="Ola Nordmann" />
                </div>
                <div>
                  <label style={labelStyle}>E-post *</label>
                  <input name="email" type="email" required value={form.email} onChange={handleChange} style={inputStyle} placeholder="ola@bedrift.no" />
                </div>
                <div>
                  <label style={labelStyle}>Telefon</label>
                  <input name="phone" value={form.phone} onChange={handleChange} style={inputStyle} placeholder="+47 900 00 000" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ã˜nsket pakke</label>
                <select name="package" value={form.package} onChange={handleChange} style={inputStyle}>
                  <option value="">â€“ Velg pakke â€“</option>
                  {PACKAGES.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} â€“ {p.price} kr/mnd</option>
                  ))}
                  <option value="Tilpasset">Tilpasset / spesialtilbud</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Melding</label>
                <textarea name="message" value={form.message} onChange={handleChange} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Beskriv ønsker, tidsrom, målgruppe osv." />
              </div>
              <button
                type="submit"
                disabled={sending}
                style={{ padding: "0.9rem", background: "var(--bg-panel)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.95rem", cursor: sending ? "not-allowed" : "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                {sending ? "Sender..." : "Send forespørsel"}
              </button>
            </form>
          )}
        </div>
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
