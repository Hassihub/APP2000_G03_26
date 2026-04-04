"use client";

import { useEffect, useState } from "react";
import {
  FiBell, FiSun, FiMap, FiLock, FiMapPin, FiEye, FiMoon, FiMonitor,
} from "react-icons/fi";

// ── helpers ──────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      role="switch"
      aria-checked={on}
      style={{
        width: "50px",
        height: "28px",
        borderRadius: "999px",
        background: on ? "#111827" : "#d1d5db",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.25s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "#fff",
          top: "3px",
          left: on ? "25px" : "3px",
          transition: "left 0.25s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}

function SettingRow({ icon, title, description, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid #f3f4f6",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", flex: 1 }}>
        <span style={{ color: "#6b7280", marginTop: "2px", flexShrink: 0 }}>{icon}</span>
        <div>
          <p style={{ margin: "0 0 0.2rem", fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>{title}</p>
          {description && (
            <p style={{ margin: 0, fontSize: "0.83rem", color: "#6b7280", lineHeight: 1.5 }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <p style={{ margin: "0 0 0.6rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>
        {title}
      </p>
      <div style={{ background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        {children}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────
export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ---- settings state ----
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [theme, setTheme] = useState("Lys");
  const [radius,  setRadius]  = useState(50);
  const [locationSharing, setLocationSharing] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);

  // ---- load from API on mount ----
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const p = data.profile;
          if (p) {
            setNotifications(Boolean(p.settings?.notifications ?? true));
            setTheme(p.settings?.theme || "Lys");
            setRadius(typeof p.radius_km === "number" ? p.radius_km : 50);
            setLocationSharing(Boolean(p.settings?.locationSharing));
            setPublicProfile(Boolean(p.settings?.publicProfile ?? true));
            setEmailNotifications(Boolean(p.settings?.emailNotifications));
          }
        }
      } catch { /* ignore – use defaults */ }
      setLoading(false);
    }
    load();
  }, []);

  // ---- save helper ----
  async function save(patch) {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch { /* silently ignore */ }
    setSaving(false);
  }

  // ---- individual handlers ----
  function buildSettings(overrides) {
    return {
      notifications,
      emailNotifications,
      theme,
      locationSharing,
      publicProfile,
      ...overrides,
    };
  }

  async function toggleNotifications() {
    const next = !notifications;
    setNotifications(next);
    await save({ settings: buildSettings({ notifications: next }) });
  }

  async function toggleEmailNotifications() {
    const next = !emailNotifications;
    setEmailNotifications(next);
    await save({ settings: buildSettings({ emailNotifications: next }) });
  }

  async function selectTheme(t) {
    setTheme(t);
    await Promise.all([
      save({ settings: buildSettings({ theme: t }) }),
      fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: t }),
      }),
    ]);
  }

  async function handleRadiusSave(val) {
    setRadius(val);
    await save({ radius_km: val });
  }

  async function toggleLocationSharing() {
    const next = !locationSharing;
    setLocationSharing(next);
    await save({ settings: buildSettings({ locationSharing: next }) });
  }

  async function togglePublicProfile() {
    const next = !publicProfile;
    setPublicProfile(next);
    await save({ settings: buildSettings({ publicProfile: next }) });
  }

  // ---- theme button ----
  const THEMES = [
    { key: "Lys",        icon: <FiSun size={15} />,     label: "Lyst" },
    { key: "Mørk",       icon: <FiMoon size={15} />,    label: "Mørkt" },
    { key: "Automatisk", icon: <FiMonitor size={15} />, label: "Automatisk" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        fontFamily: "Poppins, sans-serif",
        padding: "2.5rem 2rem",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>
            Konto
          </p>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "2rem", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Innstillinger
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>
            Tilpass FrittFram etter dine preferanser
          </p>
        </div>

        {/* Saved toast */}
        {saved && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.7rem 1.2rem", marginBottom: "1.5rem", fontSize: "0.88rem", color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            ✅ Lagret
          </div>
        )}

        {loading ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: "3rem" }}>Laster innstillinger...</p>
        ) : (
          <>
            {/* ── Varslinger ── */}
            <Section title="Varslinger">
              <SettingRow
                icon={<FiBell size={18} />}
                title="Push-varslinger"
                description="Motta varsler om nye meldinger og reservasjoner"
              >
                <Toggle on={notifications} onToggle={toggleNotifications} disabled={saving} />
              </SettingRow>
              <SettingRow
                icon={<FiBell size={18} />}
                title="E-postvarsler"
                description="Ukentlig oppsummering og konto-varsler på e-post"
              >
                <Toggle on={emailNotifications} onToggle={toggleEmailNotifications} disabled={saving} />
              </SettingRow>
            </Section>

            {/* ── Utseende ── */}
            <Section title="Utseende">
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#6b7280", marginTop: "2px" }}><FiSun size={18} /></span>
                  <div>
                    <p style={{ margin: "0 0 0.2rem", fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>Tema</p>
                    <p style={{ margin: 0, fontSize: "0.83rem", color: "#6b7280" }}>Velg farge- og designpreferanse</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                  {THEMES.map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => selectTheme(key)}
                      style={{
                        padding: "0.75rem 0.5rem",
                        borderRadius: "8px",
                        border: theme === key ? "2px solid #111827" : "1px solid #e5e7eb",
                        background: theme === key ? "#111827" : "#f9fafb",
                        color: theme === key ? "#fff" : "#374151",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: theme === key ? 700 : 500,
                        fontSize: "0.85rem",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.4rem",
                        transition: "all 0.15s",
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Søk & kart ── */}
            <Section title="Søk og kart">
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#6b7280", marginTop: "2px" }}><FiMap size={18} /></span>
                  <div>
                    <p style={{ margin: "0 0 0.2rem", fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>Søkeradius</p>
                    <p style={{ margin: 0, fontSize: "0.83rem", color: "#6b7280" }}>
                      Vis turer innenfor <strong>{radius} km</strong> fra hjemsted
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", paddingLeft: "2.1rem" }}>
                  <input
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    onMouseUp={(e) => handleRadiusSave(Number(e.target.value))}
                    onTouchEnd={(e) => handleRadiusSave(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "#111827" }}
                  />
                  <span style={{ minWidth: "60px", fontWeight: 700, fontSize: "1rem", color: "#111827", textAlign: "right" }}>
                    {radius} km
                  </span>
                </div>
              </div>
              <SettingRow
                icon={<FiMapPin size={18} />}
                title="Del posisjon"
                description="La andre brukere se omtrentlig posisjon på kart"
              >
                <Toggle on={locationSharing} onToggle={toggleLocationSharing} disabled={saving} />
              </SettingRow>
            </Section>

            {/* ── Personvern ── */}
            <Section title="Personvern">
              <SettingRow
                icon={<FiEye size={18} />}
                title="Offentlig profil"
                description="Andre brukere kan se profilen din og dine turer"
              >
                <Toggle on={publicProfile} onToggle={togglePublicProfile} disabled={saving} />
              </SettingRow>
              <SettingRow
                icon={<FiLock size={18} />}
                title="To-faktor autentisering"
                description="Konto er ikke satt opp med 2FA"
              >
                <span style={{ fontSize: "0.78rem", color: "#9ca3af", fontWeight: 600 }}>Kommer snart</span>
              </SettingRow>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

