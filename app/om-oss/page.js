"use client";

export default function OmOss() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Inter', 'Poppins', sans-serif" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(160deg,var(--bg) 0%,#1a2035 100%)", padding: "5rem 2rem 4rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Om oss</p>
          <h1 style={{ margin: "0 0 1.25rem", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Utopias møteplass<br />for friluftsliv
          </h1>
          <p style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-muted)", lineHeight: 1.75, maxWidth: 600 }}>
            FrittFram ble grunnlagt med én tanke: å gjøre det enklere for folk å komme seg ut i utopisk natur — og å finne fellesskap der ute.
          </p>
        </div>
      </section>

      {/* Misjon */}
      <section style={{ padding: "4rem 2rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.5rem" }}>
          {[
            { title: "Vår misjon", body: "Vi vil senke terskelen for friluftsliv. Uansett om du er nybegynner eller erfaren turist — FrittFram gir deg verktøyene, kartene og fellesskapet du trenger." },
            { title: "Vår visjon", body: "Et Utopia der alle har tilgang til natur og opplevelser, uavhengig av bakgrunn og erfaring. Vi tror på åpne veier, delte turer og gode minner." },
            { title: "Våre verdier", body: "Åpenhet, inkludering og bærekraft er kjernen i alt vi gjør. Vi respekterer naturen og hverandre — på stien og på nett." },
          ].map(({ title, body }) => (
            <div key={title} style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem 1.75rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>{title}</h3>
              <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--text-muted)", lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: "4rem 2rem", borderBottom: "1px solid #1e2539" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Teamet</p>
          <h2 style={{ margin: "0 0 2rem", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, letterSpacing: "-0.03em" }}>Menneskene bak FrittFram</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1.25rem" }}>
            {[
              { name: "Gruppe 3", role: "Grunnlegger & CTO" },
              { name: "APP2000", role: "Produkt & Design" },
              { name: "USN", role: "Backend & Infrastruktur" },
              { name: "G03-26", role: "Vekst & Partnerskap" },
            ].map(({ name, role }) => (
              <div key={name} style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--bg-panel)", border: "2px solid #252d40", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 800, color: "#6675ff" }}>
                  {name[0]}
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", marginBottom: "0.25rem" }}>{name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>Tall</p>
          <h2 style={{ margin: "0 0 2rem", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, letterSpacing: "-0.03em" }}>FrittFram i tall</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1.25rem" }}>
            {[
              { value: "10 000+", label: "Registrerte brukere" },
              { value: "420+", label: "Turruter i databasen" },
              { value: "85+", label: "Tilgjengelige hytter" },
              { value: "5", label: "Støttede språk" },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: "var(--bg-panel)", border: "1px solid #1e2539", borderRadius: 4, padding: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.04em", marginBottom: "0.35rem" }}>{value}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
