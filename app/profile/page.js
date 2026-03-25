"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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

          throw new Error(json?.error || "Kunne ikke hente profil.");
        }

        if (cancelled) {
          return;
        }

        syncProfileState(json.profile);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Kunne ikke hente profil.");
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
        alert("Opplasting feilet");
      }
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt");
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
      alert(err.message || "Kunne ikke lagre profil.");
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
        throw new Error("Kunne ikke logge ut");
      }

      window.location.assign("/login");
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt ved utlogging");
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
      alert(err.message || "Kunne ikke oppdatere varslinger.");
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
      alert(err.message || "Kunne ikke oppdatere tema.");
    }
  }

  // Tema farger
  const getThemeColors = () => {
    if (theme === "Mørk") {
      return {
        bg: "#1a1a1a",
        text: "#fff",
        cardBg: "#2d2d2d",
        cardText: "#e0e0e0",
        border: "#444",
        lightText: "#aaa",
        sidebarBg: "#252525",
        buttonBg: "#333"
      };
    }
    return {
      bg: "#f5f5f5",
      text: "#171717",
      cardBg: "#fff",
      cardText: "#333",
      border: "#ddd",
      lightText: "#666",
      sidebarBg: "#fafafa",
      buttonBg: "#f9f9f9"
    };
  };

  const themeColors = getThemeColors();

  const sidebarItemStyle = (category) => ({
    padding: "1rem",
    cursor: "pointer",
    borderRadius: "8px",
    fontWeight: activeCategory === category ? 600 : 500,
    marginBottom: "10px",
    transition: "all 0.2s",
    background: activeCategory === category ? (theme === "Mørk" ? "#3a3a3a" : "#e0e0e0") : themeColors.buttonBg,
    color: themeColors.text,
  });

  const cardStyle = {
    background: themeColors.cardBg,
    color: themeColors.cardText,
    padding: "1.5rem",
    borderRadius: "12px",
    marginBottom: "2rem",
    boxShadow: theme === "Mørk" ? "0 6px 15px rgba(0,0,0,0.3)" : "0 6px 15px rgba(0,0,0,0.05)",
  };

  return (
    <main style={{ display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: themeColors.bg, color: themeColors.text, transition: "background 0.3s ease, color 0.3s ease" }}>

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
        <div onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: "pointer", marginBottom: "2rem", fontSize: "22px", color: themeColors.text }}>
          ☰
        </div>

        {sidebarOpen && (
          <>
            <h2 style={{ marginBottom: "2rem", color: themeColors.text }}>Kategorier</h2>
            {["account", "transactions", "payment", "trips", "settings"].map(cat => (
              <div key={cat} style={sidebarItemStyle(cat)} onClick={() => setActiveCategory(cat)}>
                {cat === "account" ? "Min konto" : cat === "transactions" ? "Transaksjoner" : cat === "payment" ? "Betaling" : cat === "trips" ? "Turer" : "Innstillinger"}
              </div>
            ))}
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{ marginTop: "2rem", width: "100%", padding: "0.8rem", border: "none", borderRadius: "8px", background: "#171717", color: "#fff", cursor: "pointer" }}
            >
              Logg ut
            </button>
          </>
        )}
      </aside>

      {/* HOVED */}
      <section style={{ flex: 1, padding: "2rem", background: themeColors.bg, color: themeColors.text, transition: "background 0.3s ease, color 0.3s ease" }}>
        {loading ? <p>Laster profil fra API...</p> : null}
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

        {/* ACCOUNT */}
        {activeCategory === "account" && (
          <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "2rem" }}>

            {/* PROFILBILDE */}
            <div onClick={handleImageClick} style={{
              width: "250px",
              height: "250px",
              borderRadius: "50%",
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              border: `3px solid ${themeColors.border}`,
              background: themeColors.bg
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
                top: "5px",
                right: "5px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: theme === "Mørk" ? "#3a3a3a" : "#171717",
                color: "#fff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "20px",
                cursor: "pointer"
              }}>📷</div>
            </div>

            {/* DETALJER */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>{userData.name}</h2>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: `1px solid ${themeColors.text}`,
                      background: themeColors.cardBg,
                      color: themeColors.text,
                      cursor: "pointer",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                    }}
                  >
                    ✏️ Rediger profil
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{
                  background: themeColors.cardBg,
                  padding: "1rem",
                  borderRadius: "10px",
                  boxShadow: "0 6px 15px rgba(0,0,0,0.1)",
                  marginTop: "1rem"
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div><label>Navn:</label><input type="text" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                    <div><label>Fødselsdato:</label><input type="date" value={editFields.dob} onChange={e => setEditFields({ ...editFields, dob: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                    <div><label>Alder:</label><input type="number" value={editFields.age} onChange={e => setEditFields({ ...editFields, age: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                    <div><label>Telefon:</label><input type="text" value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label>Email:</label><input type="email" value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label>Bio:</label><textarea value={editFields.bio} onChange={e => setEditFields({ ...editFields, bio: e.target.value })} rows={3} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text }} /></div>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem" }}>
                    <button onClick={handleSaveEdit} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", background: theme === "Mørk" ? "#3a3a3a" : "#171717", color: "#fff", cursor: "pointer" }}>Lagre</button>
                    <button onClick={() => setIsEditing(false)} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.cardBg, color: themeColors.text, cursor: "pointer" }}>Avbryt</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={cardStyle}><strong>Bio</strong><p>{userData.bio}</p></div>
                    <div style={cardStyle}><strong>Detaljer</strong><p>Alder: {userData.age}</p><p>Telefon: {userData.phone}</p><p>Email: {userData.email}</p><p>Fødselsdato: {userData.dob}</p></div>
                  </div>

                  {/* SISTE TUR - VISUELL OVERSIKT */}
                  <div style={{
                    marginTop: "1rem",
                    background: "#fff",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 6px 15px rgba(0,0,0,0.05)"
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
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", opacity: "0.9" }}>📍 {userData.lastTrip.location}</p>
                      </div>
                    </div>

                    {/* Innholdssektion */}
                    <div style={{ padding: "1.5rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        {/* Venstre kolonne - Dato og beskrivelse */}
                        <div>
                          <p style={{ margin: "0 0 0.5rem 0", color: "#666", fontSize: "0.9rem" }}>📅 {userData.lastTrip.date}</p>
                          <p style={{ margin: "0", lineHeight: "1.5", color: "#333" }}>{userData.lastTrip.description}</p>
                        </div>

                        {/* Høyre kolonne - Statistikk */}
                        <div style={{
                          background: "#f9f9f9",
                          padding: "1rem",
                          borderRadius: "8px"
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                              <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>📏 Distanse</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.distance}</p>
                            </div>
                            <div>
                              <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⏱️ Varighet</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.duration}</p>
                            </div>
                            <div>
                              <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⬆️ Stigning</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{userData.lastTrip.elevation}</p>
                            </div>
                            <div>
                              <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⭐ Vurdering</p>
                              <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "700" }}>{"⭐".repeat(userData.lastTrip.rating)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button style={{
                        width: "100%",
                        padding: "0.8rem",
                        background: "#171717",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.95rem",
                        transition: "background 0.3s"
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#333"}
                      onMouseLeave={(e) => e.target.style.background = "#171717"}
                      >
                        📸 Se alle bildene fra turen
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
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Transaksjoner</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {userData.transactions.map((tx, i) => (
                <div key={i} style={{
                  background: "#fff",
                  padding: "1.5rem",
                  borderRadius: "12px",
                  boxShadow: "0 6px 15px rgba(0,0,0,0.05)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #171717",
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
                    <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.9rem" }}>📅 {tx.date}</p>
                    <p style={{ margin: "0", fontWeight: "600", fontSize: "1rem" }}>{tx.desc}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: "0", fontWeight: "700", fontSize: "1.1rem", color: "#171717" }}>{tx.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BETALING */}
        {activeCategory === "payment" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Betalingsinformasjon</h2>
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 6px 15px rgba(0,0,0,0.05)"
            }}>
              {/* Kredittkort */}
              <div style={{
                background: "linear-gradient(135deg, #171717 0%, #333 100%)",
                color: "#fff",
                padding: "2rem",
                borderRadius: "12px",
                marginBottom: "1.5rem",
                boxShadow: "0 8px 20px rgba(0,0,0,0.2)"
              }}>
                <p style={{ margin: "0 0 1rem 0", opacity: "0.8", fontSize: "0.9rem" }}>💳 Kredittkort</p>
                <p style={{ margin: "0", fontSize: "1.5rem", fontWeight: "700", letterSpacing: "2px" }}>{userData.payment.card}</p>
              </div>
              {/* Faktureringsinformasjon */}
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>Faktureringsinformasjon</h3>
                <div style={{
                  background: "#f9f9f9",
                  padding: "1.5rem",
                  borderRadius: "8px"
                }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.9rem", fontWeight: "600" }}>📅 Faktureringsdato</p>
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
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Mine turer</h2>
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 6px 15px rgba(0,0,0,0.05)"
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
                <p style={{ margin: "0 0 1rem 0", color: "#666" }}>📍 {userData.lastTrip.location}</p>
                <p style={{ margin: "0 0 1rem 0", lineHeight: "1.6", color: "#333" }}>{userData.lastTrip.description}</p>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  background: "#f9f9f9",
                  borderRadius: "8px"
                }}>
                  <div><p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>📏 Distanse</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.distance}</p></div>
                  <div><p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⏱️ Varighet</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.duration}</p></div>
                  <div><p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⬆️ Stigning</p><p style={{ margin: "0", fontWeight: "700" }}>{userData.lastTrip.elevation}</p></div>
                  <div><p style={{ margin: "0 0 0.3rem 0", color: "#666", fontSize: "0.85rem", fontWeight: "600" }}>⭐ Vurdering</p><p style={{ margin: "0", fontWeight: "700" }}>{"⭐".repeat(userData.lastTrip.rating)}</p></div>
                </div>
                <button style={{
                  width: "100%",
                  padding: "0.8rem",
                  background: "#171717",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background 0.3s"
                }}
                onMouseEnter={(e) => e.target.style.background = "#333"}
                onMouseLeave={(e) => e.target.style.background = "#171717"}>
                  🗺️ Se på kart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INNSTILLINGER */}
        {activeCategory === "settings" && (
          <div>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Innstillinger</h2>
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 6px 15px rgba(0,0,0,0.05)"
            }}>
              <div style={{
                padding: "1.5rem",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: "0 0 0.3rem 0", fontWeight: "600", fontSize: "1rem" }}>🔔 Varslinger</p>
                  <p style={{ margin: "0", color: "#666", fontSize: "0.9rem" }}>Motta varsler om nye meldinger og reservasjoner</p>
                </div>
                <div 
                  onClick={handleToggleNotifications}
                  style={{
                  width: "50px",
                  height: "28px",
                  borderRadius: "14px",
                  background: notifications ? "#4CAF50" : "#ccc",
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
                  <p style={{ margin: "0 0 0.3rem 0", fontWeight: "600", fontSize: "1rem" }}>🎨 Tema</p>
                  <p style={{ margin: "0", color: themeColors.lightText, fontSize: "0.9rem" }}>Velg farge- og designpreferanser</p>
                </div>
                <div 
                  onClick={() => setShowThemeModal(true)}
                  style={{
                  background: themeColors.cardBg,
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
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
          <div style={{ background: themeColors.cardBg, color: themeColors.text, padding: "2rem", borderRadius: "12px", maxWidth: "400px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1.5rem 0", color: themeColors.text }}>Velg tema</h3>
            <div style={{ display: "grid", gap: "0.8rem", marginBottom: "1.5rem" }}>
              {["Lys", "Mørk", "Automatisk"].map((t) => (
                <div
                  key={t}
                  onClick={() => handleSelectTheme(t)}
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    border: theme === t ? `2px solid ${themeColors.text}` : `1px solid ${themeColors.border}`,
                    background: theme === t ? (theme === "Mørk" ? "#3a3a3a" : "#f0f0f0") : themeColors.bg,
                    color: themeColors.text,
                    cursor: "pointer",
                    fontWeight: theme === t ? "600" : "500",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = themeColors.text;
                    e.currentTarget.style.background = theme === "Mørk" ? "#3a3a3a" : "#f9f9f9";
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== t) {
                      e.currentTarget.style.borderColor = themeColors.border;
                      e.currentTarget.style.background = themeColors.bg;
                    }
                  }}
                >
                  {t === "Lys" ? "☀️ Lyst tema" : t === "Mørk" ? "🌙 Mørkt tema" : "🔄 Automatisk"}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowThemeModal(false)}
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "8px",
                border: "none",
                background: theme === "Mørk" ? "#3a3a3a" : "#171717",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Ferdig
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {showLogoutModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ background: themeColors.cardBg, color: themeColors.text, padding: "2rem", borderRadius: "8px" }}>
          <h3>Er du sikker?</h3>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button onClick={() => setShowLogoutModal(false)} style={{ padding: "0.6rem 1.2rem", borderRadius: "6px", border: `1px solid ${themeColors.border}`, background: themeColors.bg, color: themeColors.text, cursor: "pointer" }}>Avbryt</button>
            <button onClick={handleLogout} style={{ padding: "0.6rem 1.2rem", borderRadius: "6px", border: "none", background: theme === "Mørk" ? "#3a3a3a" : "#171717", color: "#fff", cursor: "pointer" }}>Logg ut</button>
          </div>
        </div>
      </div>}

    </main>
  );
}