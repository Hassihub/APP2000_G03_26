"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "../components/LanguageProvider";

const emptyProfile = {
  name: "",
  dob: "",
  age: "",
  phone: "",
  email: "",
  bio: "",
  profileImage: "/images/profil.jpg",
  lastTrip: {
    title: "Ingen tur registrert",
    date: "",
    description: "Ingen turdata tilgjengelig.",
    image: "/images/fjell.jpg",
    difficulty: "Ukjent",
    distance: "Ukjent",
    duration: "Ukjent",
    elevation: "Ukjent",
    rating: 0,
    location: "",
  },
  transactions: [],
  payment: { card: "Ikke registrert", billing: "Ingen fakturaperiode" },
  settings: { notifications: true, theme: "Lys" },
};

export default function Profile() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const t = useTranslations("profilePage");

  const [activeCategory, setActiveCategory] = useState("account");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState({ ...emptyProfile });
  const [editFields, setEditFields] = useState({ ...emptyProfile });
  const [profileImage, setProfileImage] = useState(emptyProfile.profileImage);
  const [notifications, setNotifications] = useState(
    emptyProfile.settings.notifications
  );
  const [theme, setTheme] = useState(emptyProfile.settings.theme);
  const [showThemeModal, setShowThemeModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/profile", {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }

          throw new Error(json?.error || "Could not load profile.");
        }

        if (cancelled) {
          return;
        }

        syncProfileState(json.profile);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Escape lukker redigeringsmodus og modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsEditing(false);
        setShowThemeModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleImageClick() {
    fileInputRef.current.click();
  }

  function syncProfileState(profile) {
    const nextProfile = profile || emptyProfile;
    setUserData(nextProfile);
    setEditFields(nextProfile);
    setProfileImage(nextProfile.profileImage || emptyProfile.profileImage);
    setNotifications(Boolean(nextProfile.settings?.notifications));
    setTheme(nextProfile.settings?.theme || "Lys");
  }

  async function updateProfile(patch) {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.error || "Kunne ikke oppdatere profil.");
    }

    syncProfileState(json.profile);
    return json.profile;
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.filePath) {
        await updateProfile({ profileImage: data.filePath });
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  }

  async function handleSaveEdit() {
    try {
      await updateProfile({
        name: editFields.name,
        dob: editFields.dob,
        age: editFields.age,
        phone: editFields.phone,
        email: editFields.email,
        bio: editFields.bio,
      });
      setIsEditing(false);
    } catch (err) {
      alert(err.message || "Could not save profile.");
    }
  }

  // ✅ FUNGERENDE LOGOUT
  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Could not sign out");
      }

      window.location.assign("/login");
    } catch (err) {
      console.error(err);
      alert("Something went wrong while signing out");
    }
  }

  // Håndter varslinger toggle
  async function handleToggleNotifications() {
    const newValue = !notifications;

    try {
      await updateProfile({
        settings: {
          ...userData.settings,
          notifications: newValue,
          theme,
        },
      });
    } catch (err) {
      alert(err.message || "Could not update notifications.");
    }
  }

  // Håndter tema-valg
  async function handleSelectTheme(selectedTheme) {
    try {
      await Promise.all([
        updateProfile({
          settings: {
            ...userData.settings,
            notifications,
            theme: selectedTheme,
          },
        }),
        fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: selectedTheme }),
        }),
      ]);
      setShowThemeModal(false);
    } catch (err) {
      alert(err.message || "Could not update theme.");
    }
  }

  // Tema farger
  const getThemeColors = () => {
    if (theme === "Mørk") {
      return {
        bg: "#0d0f12",
        text: "#f3f4f6",
        cardBg: "#15181d",
        cardText: "#e5e7eb",
        border: "#2b313a",
        lightText: "#98a2b3",
        sidebarBg: "#111418",
        buttonBg: "#171b21",
        accent: "#f3f4f6",
        accentMuted: "#232933",
        panelBg: "#101318",
        shadow: "0 18px 40px rgba(0,0,0,0.34)",
        inputBg: "#0f1318"
      };
    }
    return {
      bg: "#eef1f4",
      text: "#111827",
      cardBg: "#ffffff",
      cardText: "#1f2937",
      border: "#d0d5dd",
      lightText: "#667085",
      sidebarBg: "#f8fafc",
      buttonBg: "#f2f4f7",
      accent: "#111827",
      accentMuted: "#e4e7ec",
      panelBg: "#f5f7fa",
      shadow: "0 16px 30px rgba(16,24,40,0.08)",
      inputBg: "#ffffff"
    };
  };

  const themeColors = getThemeColors();

  const sidebarItemStyle = (category) => ({
    padding: "0.95rem 1rem",
    cursor: "pointer",
    borderRadius: "4px",
    fontWeight: activeCategory === category ? 700 : 500,
    marginBottom: "10px",
    transition: "all 0.2s",
    background: activeCategory === category ? themeColors.accent : themeColors.buttonBg,
    border: `1px solid ${activeCategory === category ? themeColors.accent : themeColors.border}`,
    color: activeCategory === category
      ? (theme === "Mørk" ? "#0d0f12" : "#ffffff")
      : themeColors.text,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "0.78rem",
  });

  const actionHoverBg = theme === "Mørk" ? "#d0d5dd" : "#344054";

  const cardStyle = {
    background: themeColors.cardBg,
    color: themeColors.cardText,
    padding: "1.5rem",
    borderRadius: "4px",
    marginBottom: "2rem",
    boxShadow: themeColors.shadow,
    border: `1px solid ${themeColors.border}`,
  };

  const actionButtonStyle = {
    padding: "0.85rem 1.1rem",
    borderRadius: "4px",
    border: `1px solid ${themeColors.accent}`,
    background: themeColors.accent,
    color: theme === "Mørk" ? "#0d0f12" : "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: "0.78rem",
  };

  const secondaryButtonStyle = {
    padding: "0.85rem 1.1rem",
    borderRadius: "4px",
    border: `1px solid ${themeColors.border}`,
    background: themeColors.cardBg,
    color: themeColors.text,
    cursor: "pointer",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: "0.78rem",
  };

  const statLabelStyle = {
    margin: "0 0 0.3rem 0",
    color: themeColors.lightText,
    fontSize: "0.78rem",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const ratingLabel = `${userData.lastTrip.rating || 0}/5`;

  return (
    <main style={{ display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: `linear-gradient(180deg, ${themeColors.bg} 0%, ${themeColors.panelBg} 100%)`, color: themeColors.text, transition: "background 0.3s ease, color 0.3s ease" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarOpen ? "250px" : "60px",
        transition: "width 0.3s",
        padding: "2rem 1rem",
        borderRight: `1px solid ${themeColors.border}`,
        background: themeColors.sidebarBg,
        color: themeColors.text,
        position: "relative"
      }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: "pointer", marginBottom: "2rem", fontSize: "0.72rem", color: themeColors.text, border: `1px solid ${themeColors.border}`, background: themeColors.buttonBg, padding: "0.7rem 0.85rem", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {t.categories}
        </button>

        {sidebarOpen && (
          <>
            <h2 style={{ marginBottom: "2rem", color: themeColors.text, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>{t.categories}</h2>
            {["account", "transactions", "payment", "trips", "settings"].map(cat => (
              <div key={cat} style={sidebarItemStyle(cat)} onClick={() => setActiveCategory(cat)}>
                {cat === "account" ? t.account : cat === "transactions" ? t.transactions : cat === "payment" ? t.payment : cat === "trips" ? t.trips : t.settings}
              </div>
            ))}
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{ ...actionButtonStyle, marginTop: "2rem", width: "100%" }}
            >
              {t.logout}
            </button>
          </>
        )}
      </aside>

      {/* HOVED */}
      <section style={{ flex: 1, padding: "2rem", background: themeColors.bg, color: themeColors.text, transition: "background 0.3s ease, color 0.3s ease" }}>
        {loading ? <p>{t.loading}</p> : null}
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

        {/* ACCOUNT */}
        {activeCategory === "account" && (
          <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "2rem" }}>

            {/* PROFILBILDE */}
            <div onClick={handleImageClick} style={{
              width: "250px",
              height: "250px",
              borderRadius: "12px",
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              border: `1px solid ${themeColors.border}`,
              background: themeColors.bg,
              boxShadow: themeColors.shadow
            }}>
              <Image
                src={profileImage}
                alt="Profilbilde"
                fill
                unoptimized
                style={{ objectFit: "cover" }}
              />
              <div style={{
                position: "absolute",
                right: "12px",
                bottom: "12px",
                padding: "0.55rem 0.75rem",
                borderRadius: "4px",
                background: themeColors.accent,
                color: theme === "Mørk" ? "#0d0f12" : "#fff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer"
              }}>{t.changeImage}</div>
            </div>

            {/* DETALJER */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "2rem", letterSpacing: "-0.03em" }}>{userData.name}</h2>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={secondaryButtonStyle}
                  >
                    {t.editProfile}
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{
                  background: themeColors.cardBg,
                  padding: "1rem",
                  borderRadius: "4px",
                  boxShadow: themeColors.shadow,
                  border: `1px solid ${themeColors.border}`,
                  marginTop: "1rem"
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div><label style={statLabelStyle}>{t.name}</label><input type="text" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div><label style={statLabelStyle}>{t.birthDate}</label><input type="date" value={editFields.dob} onChange={e => setEditFields({ ...editFields, dob: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div><label style={statLabelStyle}>{t.age}</label><input type="number" value={editFields.age} onChange={e => setEditFields({ ...editFields, age: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div><label style={statLabelStyle}>{t.phone}</label><input type="text" value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label style={statLabelStyle}>{t.email}</label><input type="email" value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label style={statLabelStyle}>{t.bio}</label><textarea value={editFields.bio} onChange={e => setEditFields({ ...editFields, bio: e.target.value })} rows={3} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem" }}>
                    <button onClick={handleSaveEdit} style={actionButtonStyle}>{t.save}</button>
                    <button onClick={() => setIsEditing(false)} style={secondaryButtonStyle}>{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={cardStyle}><strong>{t.bio}</strong><p>{userData.bio}</p></div>
                    <div style={cardStyle}><strong>{t.details}</strong><p>{t.age}: {userData.age}</p><p>{t.phone}: {userData.phone}</p><p>{t.email}: {userData.email}</p><p>{t.birthDate}: {userData.dob}</p></div>
                  </div>

                  {/* SISTE TUR - VISUELL OVERSIKT */}
                  <div style={{
                    marginTop: "1rem",
                    background: themeColors.cardBg,
                    borderRadius: "4px",
                    overflow: "hidden",
                    boxShadow: themeColors.shadow,
                    border: `1px solid ${themeColors.border}`
                  }}>
                    {/* Header med bilde */}
                    <div style={{
                      position: "relative",
                      height: "250px",
                      background: "#f0f0f0"
                    }}>
                      <Image
                        src={userData.lastTrip.image}
                        alt="Siste tur"
                        fill
                        unoptimized
                        style={{
                          objectFit: "cover"
                        }}
                      />
                      {/* Overlay gradient */}
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)"
                      }} />
                      {/* Badge: Vanskelighetsgrad */}
                      <div style={{
                        position: "absolute",
                        top: "1rem",
                        right: "1rem",
                        background: userData.lastTrip.difficulty === "Lett" ? "#4CAF50" : userData.lastTrip.difficulty === "Middels" ? "#FF9800" : "#f44336",
                        color: "#fff",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "20px",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}>
                        {userData.lastTrip.difficulty}
                      </div>
                      {/* Tittel på bildet */}
                      <div style={{
                        position: "absolute",
                        bottom: "1rem",
                        left: "1rem",
                        color: "#fff"
                      }}>
                        <h3 style={{ margin: "0", fontSize: "1.5rem", fontWeight: "700" }}>{userData.lastTrip.title}</h3>
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.82rem", opacity: "0.9", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.place}: {userData.lastTrip.location}</p>
                      </div>
                    </div>

                    {/* Innholdssektion */}
                    <div style={{ padding: "1.5rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        {/* Venstre kolonne - Dato og beskrivelse */}
                        <div>
                          <p style={statLabelStyle}>{t.date}</p>
                          <p style={{ margin: "0 0 0.75rem 0", color: themeColors.text, fontSize: "0.95rem" }}>{userData.lastTrip.date || "-"}</p>
                          <p style={{ margin: "0", lineHeight: "1.6", color: themeColors.cardText }}>{userData.lastTrip.description}</p>
                        </div>

                        {/* Høyre kolonne - Statistikk */}
                        <div style={{
                          background: themeColors.panelBg,
                          padding: "1rem",
                          borderRadius: "4px",
                          border: `1px solid ${themeColors.border}`
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                              <p style={statLabelStyle}>{t.distance}</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.distance}</p>
                            </div>
                            <div>
                              <p style={statLabelStyle}>{t.duration}</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.duration}</p>
                            </div>
                            <div>
                              <p style={statLabelStyle}>{t.elevation}</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.elevation}</p>
                            </div>
                            <div>
                              <p style={statLabelStyle}>{t.rating}</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{ratingLabel}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button style={{
                        ...actionButtonStyle,
                        width: "100%"
                      }}
                      onMouseEnter={(e) => e.target.style.background = actionHoverBg}
                      onMouseLeave={(e) => e.target.style.background = themeColors.accent}
                      >
                        {t.viewPhotos}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TRANSAKSJONER */}
        {activeCategory === "transactions" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>{t.transactions}</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {userData.transactions.map((tx, i) => (
                <div key={i} style={{
                  background: themeColors.cardBg,
                  padding: "1.5rem",
                  borderRadius: "4px",
                  boxShadow: themeColors.shadow,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: `1px solid ${themeColors.border}`,
                  borderLeft: `4px solid ${themeColors.accent}`,
                  transition: "transform 0.2s, boxShadow 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.05)";
                }}>
                  <div>
                    <p style={statLabelStyle}>{tx.date}</p>
                    <p style={{ margin: "0", fontWeight: "600", fontSize: "1rem" }}>{tx.desc}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: "0", fontWeight: "700", fontSize: "1.1rem", color: themeColors.text }}>{tx.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BETALING */}
        {activeCategory === "payment" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>{t.paymentInfo}</h2>
            <div style={{
              background: themeColors.cardBg,
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: themeColors.shadow,
              border: `1px solid ${themeColors.border}`
            }}>
              {/* Kredittkort */}
              <div style={{
                background: theme === "Mørk" ? "linear-gradient(135deg, #0f1217 0%, #202733 100%)" : "linear-gradient(135deg, #111827 0%, #344054 100%)",
                color: "#fff",
                padding: "2rem",
                borderRadius: "0",
                marginBottom: "1.5rem",
                boxShadow: "0 8px 20px rgba(0,0,0,0.2)"
              }}>
                <p style={{ margin: "0 0 1rem 0", opacity: "0.8", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.payment}</p>
                <p style={{ margin: "0", fontSize: "1.5rem", fontWeight: "700", letterSpacing: "2px" }}>{userData.payment.card}</p>
              </div>
              {/* Faktureringsinformasjon */}
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>{t.billingInfo}</h3>
                <div style={{
                  background: themeColors.panelBg,
                  padding: "1.5rem",
                  borderRadius: "4px",
                  border: `1px solid ${themeColors.border}`
                }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={statLabelStyle}>{t.billingDate}</p>
                    <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "600" }}>{userData.payment.billing}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TURER */}
        {activeCategory === "trips" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>{t.myTrips}</h2>
            <div style={{
              background: themeColors.cardBg,
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: themeColors.shadow,
              border: `1px solid ${themeColors.border}`
            }}>
              <div style={{
                background: "#f0f0f0",
                height: "200px",
                overflow: "hidden"
              }}>
                <Image
                  src={userData.lastTrip.image}
                  alt="Siste tur"
                  width={1200}
                  height={400}
                  unoptimized
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.3rem" }}>{userData.lastTrip.title}</h3>
                <p style={{ margin: "0 0 1rem 0", color: themeColors.lightText, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.78rem" }}>{t.place}: {userData.lastTrip.location}</p>
                <p style={{ margin: "0 0 1rem 0", lineHeight: "1.6", color: themeColors.cardText }}>{userData.lastTrip.description}</p>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  background: themeColors.panelBg,
                  borderRadius: "4px",
                  border: `1px solid ${themeColors.border}`
                }}>
                  <div><p style={statLabelStyle}>{t.distance}</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.distance}</p></div>
                  <div><p style={statLabelStyle}>{t.duration}</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.duration}</p></div>
                  <div><p style={statLabelStyle}>{t.elevation}</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.elevation}</p></div>
                  <div><p style={statLabelStyle}>{t.rating}</p><p style={{ margin: "0", fontWeight: "700" }}>{ratingLabel}</p></div>
                </div>
                <button style={{
                  ...actionButtonStyle,
                  width: "100%"
                }}
                onMouseEnter={(e) => e.target.style.background = actionHoverBg}
                onMouseLeave={(e) => e.target.style.background = themeColors.accent}>
                  {t.viewMap}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INNSTILLINGER */}
        {activeCategory === "settings" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>{t.settings}</h2>
            <div style={{
              background: themeColors.cardBg,
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: themeColors.shadow,
              border: `1px solid ${themeColors.border}`
            }}>
              <div style={{
                padding: "1.5rem",
                borderBottom: `1px solid ${themeColors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: "0 0 0.3rem 0", fontWeight: "600", fontSize: "1rem" }}>{t.notifications}</p>
                  <p style={{ margin: "0", color: themeColors.lightText, fontSize: "0.9rem" }}>{t.notificationsHelp}</p>
                </div>
                <div 
                  onClick={handleToggleNotifications}
                  style={{
                  width: "50px",
                  height: "28px",
                  borderRadius: "999px",
                  background: notifications ? themeColors.accent : themeColors.accentMuted,
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.3s"
                }}>
                  <div style={{
                    position: "absolute",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#fff",
                    top: "2px",
                    left: notifications ? "24px" : "2px",
                    transition: "left 0.3s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }} />
                </div>
              </div>
              <div style={{
                padding: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: "0 0 0.3rem 0", fontWeight: "600", fontSize: "1rem" }}>{t.theme}</p>
                  <p style={{ margin: "0", color: themeColors.lightText, fontSize: "0.9rem" }}>{t.themeHelp}</p>
                </div>
                <div 
                  onClick={() => setShowThemeModal(true)}
                  style={{
                  background: themeColors.cardBg,
                  padding: "0.6rem 1.2rem",
                  borderRadius: "4px",
                  fontWeight: "600",
                  color: themeColors.text,
                  cursor: "pointer",
                  border: `1px solid ${themeColors.border}`,
                  transition: "all 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === "Mørk" ? "#3a3a3a" : "#e0e0e0";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = themeColors.cardBg;
                  e.currentTarget.style.boxShadow = "none";
                }}>
                  {theme}
                </div>
              </div>
            </div>
          </div>
        )}

      </section>

      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

      {/* TEMA MODAL */}
      {showThemeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: themeColors.cardBg, color: themeColors.text, padding: "2rem", borderRadius: "4px", maxWidth: "400px", width: "90%", border: `1px solid ${themeColors.border}`, boxShadow: themeColors.shadow }}>
            <h3 style={{ margin: "0 0 1.5rem 0", color: themeColors.text }}>{t.chooseTheme}</h3>
            <div style={{ display: "grid", gap: "0.8rem", marginBottom: "1.5rem" }}>
              {["Lys", "Mørk", "Automatisk"].map((themeOption) => (
                <div
                  key={themeOption}
                  onClick={() => handleSelectTheme(themeOption)}
                  style={{
                    padding: "1rem",
                    borderRadius: "4px",
                    border: theme === themeOption ? `2px solid ${themeColors.text}` : `1px solid ${themeColors.border}`,
                    background: theme === themeOption ? (theme === "Mørk" ? "#3a3a3a" : "#f0f0f0") : themeColors.bg,
                    color: themeColors.text,
                    cursor: "pointer",
                    fontWeight: theme === themeOption ? "600" : "500",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = themeColors.text;
                    e.currentTarget.style.background = theme === "Mørk" ? "#3a3a3a" : "#f9f9f9";
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== themeOption) {
                      e.currentTarget.style.borderColor = themeColors.border;
                      e.currentTarget.style.background = themeColors.bg;
                    }
                  }}
                >
                  {themeOption === "Lys" ? t.lightTheme : themeOption === "Mørk" ? t.darkTheme : t.autoTheme}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowThemeModal(false)}
              style={{
                ...actionButtonStyle,
                width: "100%"
              }}
            >
              {t.done}
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {showLogoutModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ background: themeColors.cardBg, color: themeColors.text, padding: "2rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, boxShadow: themeColors.shadow }}>
          <h3>{t.confirmLogout}</h3>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button onClick={() => setShowLogoutModal(false)} style={secondaryButtonStyle}>{t.cancel}</button>
            <button onClick={handleLogout} style={actionButtonStyle}>{t.logout}</button>
          </div>
        </div>
      </div>}

    </main>
  );
}