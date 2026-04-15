"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_ADMIN } from "../../lib/roles";
import { useTranslations } from "../components/LanguageProvider";
import { FiUser, FiDollarSign, FiCreditCard, FiMapPin, FiMenu, FiUsers, FiCalendar } from "react-icons/fi";

const emptyProfile = {
  id: "",
  role: "",
  name: "",
  dob: "",
  age: "",
  phone: "",
  email: "",
  bio: "",
  profileImage: "/images/fjell.jpg",
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
  interests: [],
  radius_km: 50,
};

export default function Profile() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
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
  const [bannerImage, setBannerImage] = useState("/images/profilbakgrunn.jpg");
  const [theme, setTheme] = useState(emptyProfile.settings.theme || "Lys");
  const [interests, setInterests] = useState([]);
  const [radius, setRadius] = useState(50);
  const [myPosts,      setMyPosts]      = useState([]);
  const [followStats,  setFollowStats]  = useState({ following: 0, followers: 0 });
  const [socialLoaded, setSocialLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationCabins, setReservationCabins] = useState({});
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const pad2 = (num) => String(num).padStart(2, "0");

  const toLocalYmd = (date) => {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    return `${y}-${m}-${d}`;
  };

  const normalizeDobForInput = (value) => {
    if (!value) return "";

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return toLocalYmd(parsed);
      }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return toLocalYmd(value);
    }

    return "";
  };

  const formatDobForDisplay = (value) => {
    const normalized = normalizeDobForInput(value);
    if (!normalized) return "-";

    const [year, month, day] = normalized.split("-");
    return `${day}.${month}.${year}`;
  };

  const getDobParts = (value) => {
    const normalized = normalizeDobForInput(value);
    if (!normalized) {
      return { year: "", month: "", day: "" };
    }

    const [year, month, day] = normalized.split("-");
    return { year, month, day };
  };

  const buildDobFromParts = ({ year, month, day }) => {
    if (!year || !month || !day) {
      return "";
    }
    return `${year}-${month}-${day}`;
  };

  const setDobFromParts = (nextParts) => {
    const currentParts = getDobParts(editFields.dob);
    const merged = { ...currentParts, ...nextParts };
    const yearNum = Number(merged.year);
    const monthNum = Number(merged.month);
    const dayNum = Number(merged.day);

    if (yearNum && monthNum && dayNum) {
      const maxDay = new Date(yearNum, monthNum, 0).getDate();
      if (dayNum > maxDay) {
        merged.day = pad2(maxDay);
      }
    }

    setEditFields({ ...editFields, dob: buildDobFromParts(merged) });
  };

  const maxBirthDate = toLocalYmd(new Date());
  const maxBirthYear = Number(maxBirthDate.slice(0, 4));
  const dobParts = getDobParts(editFields.dob);
  const selectedYearNum = Number(dobParts.year);
  const selectedMonthNum = Number(dobParts.month);
  const maxDayInMonth = selectedYearNum && selectedMonthNum
    ? new Date(selectedYearNum, selectedMonthNum, 0).getDate()
    : 31;
  const monthOptions = [
    { value: "01", label: "Januar" },
    { value: "02", label: "Februar" },
    { value: "03", label: "Mars" },
    { value: "04", label: "April" },
    { value: "05", label: "Mai" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Session keepalive: ping every 4 minutes so the 30-min session doesnt expire
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
        .then((r) => { if (r.status === 401) router.push("/login"); })
        .catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  function handleImageClick() {
    fileInputRef.current.click();
  }

  function handleBannerClick() {
    bannerInputRef.current.click();
  }

  async function handleBannerChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.filePath) {
        setBannerImage(data.filePath);
        await updateProfile({ bannerImage: data.filePath });
      } else {
        alert(data?.error || "Kunne ikke laste opp bakgrunnsbilde.");
      }
    } catch (err) {
      // updateProfile redirects to /login on 401 — dont double-alert in that case
      if (err?.message && !err.message.includes("utløpt")) {
        alert(err.message);
      }
    }
  }

  function syncProfileState(profile) {
    const nextProfile = profile || emptyProfile;
    const normalizedDob = normalizeDobForInput(nextProfile.dob);
    const normalizedProfile = {
      ...nextProfile,
      dob: normalizedDob,
    };

    setUserData(nextProfile);
    setEditFields(normalizedProfile);
    setProfileImage(nextProfile.profileImage || emptyProfile.profileImage);
    setBannerImage(nextProfile.bannerImage || "/images/profilbakgrunn.jpg");
    setTheme(nextProfile.settings?.theme || "Lys");
    setInterests(Array.isArray(nextProfile.interests) ? nextProfile.interests : []);
    setRadius(typeof nextProfile.radius_km === "number" ? nextProfile.radius_km : 50);
  }

  async function updateProfile(patch) {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      router.push("/login");
      throw new Error("Sesjonen er utføpt. Logg inn igjen.");
    }

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
  setPasswordError("");
  setPasswordSuccess("");

  try {
    const nextDob = typeof editFields.dob === "string" ? editFields.dob.trim() : "";
    const nextAge = typeof editFields.age === "string" ? editFields.age.trim() : editFields.age;

    // Lagre profil-endringer først
    await updateProfile({
      name: editFields.name,
      dob: nextDob === "" ? null : nextDob,
      age: nextAge === "" ? null : nextAge,
      phone: editFields.phone,
      email: editFields.email,
      bio: editFields.bio,
    });

    // Sjekk om bruker vil endre passord
    const wantsPasswordChange =
      currentPassword || newPassword || confirmPassword;

    if (wantsPasswordChange) {
      // Validering
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError("Fyll inn alle passordfeltene.");
        return;
      }

      if (newPassword.length < 8) {
        setPasswordError("Nytt passord må være minst 8 tegn.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError("Nytt passord og bekreft passord må være like.");
        return;
      }

      setPasswordLoading(true);

      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setPasswordError(data?.error || "Kunne ikke endre passord.");
          setPasswordLoading(false);
          return;
        }

        setPasswordSuccess("Passord oppdatert! ✓");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        setPasswordError("Nettverksfeil: " + (err.message || "Prøv igjen."));
      } finally {
        setPasswordLoading(false);
      }
    }

    // Lukk redigeringsmodus kun hvis alt gikk bra
    setIsEditing(false);
  } catch (err) {
    setPasswordError(err.message || "Kunne ikke lagre endringer.");
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

  async function handleToggleInterest(tag) {
    const updated = interests.includes(tag)
      ? interests.filter((t) => t !== tag)
      : [...interests, tag];
    setInterests(updated);
    try {
      await updateProfile({ interests: updated });
    } catch (err) {
      if (err?.message && !err.message.includes("utløpt")) {
        console.warn("Interesser ble ikke lagret:", err.message);
      }
    }
  }

  async function handleSaveRadius(val) {
    setRadius(val);
    try {
      await updateProfile({ radius_km: val });
    } catch {
      // silently ignore if column doesn't exist in DB
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

  const formatReservationDate = (value) => {
    if (!value) return "-";
    const text = String(value).slice(0, 10);
    const parts = text.split("-");
    if (parts.length !== 3) return text;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  };

  const formatReservationStatus = (value) => {
    const status = String(value || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") return t.statusCancelled;
    if (status === "confirmed") return t.statusConfirmed;
    if (status === "pending") return t.statusPending;
    if (!status) return t.statusActive;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadReservations() {
      const guestUserId = String(userData?.id ?? "").trim();
      const guestEmail = String(userData?.email ?? "").trim();

      if (!guestUserId && !guestEmail) {
        setReservations([]);
        setReservationCabins({});
        return;
      }

      setReservationsLoading(true);
      setReservationsError("");

      try {
        const params = new URLSearchParams();
        if (guestUserId) params.set("guest_user_id", guestUserId);
        if (guestEmail) params.set("guest_email", guestEmail);

        const res = await fetch(`/api/reservations?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "Kunne ikke hente reservasjoner.");
        }

        const items = Array.isArray(json.reservations) ? json.reservations : [];
        if (cancelled) return;

        setReservations(items);

        const uniqueCabinIds = [...new Set(items.map((reservation) => String(reservation.cabin_id || "").trim()).filter(Boolean))];
        const cabinPairs = await Promise.all(
          uniqueCabinIds.map(async (cabinId) => {
            try {
              const cabinRes = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`, {
                credentials: "include",
                cache: "no-store",
              });
              const cabinJson = await cabinRes.json().catch(() => ({}));
              return [cabinId, cabinRes.ok ? cabinJson.cabin || null : null];
            } catch {
              return [cabinId, null];
            }
          })
        );

        if (!cancelled) {
          setReservationCabins(Object.fromEntries(cabinPairs.filter(([, cabin]) => cabin)));
        }
      } catch (err) {
        if (!cancelled) {
          setReservations([]);
          setReservationCabins({});
          setReservationsError(err.message || "Kunne ikke hente reservasjoner.");
        }
      } finally {
        if (!cancelled) {
          setReservationsLoading(false);
        }
      }
    }

    if (userData?.id || userData?.email) {
      loadReservations();
    }

    return () => {
      cancelled = true;
    };
  }, [userData.id, userData.email]);

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
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: "pointer", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "center", color: themeColors.text, border: `1px solid ${themeColors.border}`, background: themeColors.buttonBg, padding: "0.7rem 0.85rem", borderRadius: "4px", width: "100%" }}>
          <FiMenu size={20} />
        </button>

        {sidebarOpen && (
          <>
            <h2 style={{ marginBottom: "2rem", color: themeColors.text, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>{t.categories}</h2>
            {[
              { id: "account",      icon: <FiUser size={14} />,       label: t.account },
              { id: "reservations", icon: <FiCalendar size={14} />,  label: t.reservations },
              { id: "transactions", icon: <FiDollarSign size={14} />,  label: t.transactions },
              { id: "payment",      icon: <FiCreditCard size={14} />,  label: t.payment },
              { id: "trips",        icon: <FiMapPin size={14} />,      label: t.trips },
              { id: "sosial",       icon: <FiUsers size={14} />,       label: "Sosial" },
            ].map(({ id, icon, label }) => (
              <div key={id} style={{ ...sidebarItemStyle(id), display: "flex", alignItems: "center", gap: "0.55rem" }} onClick={() => setActiveCategory(id)}>
                <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
                {label}
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
      <section style={{ flex: 1, display: "flex", flexDirection: "column", background: themeColors.bg, color: themeColors.text, transition: "background 0.3s ease, color 0.3s ease" }}>
        {/* BANNER */}
        <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
          <Image src={bannerImage} alt="Profilbakgrunn" fill unoptimized style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.6) 100%)" }} />
          <button onClick={handleBannerClick} style={{ position: "absolute", bottom: 14, right: 14, padding: "0.5rem 1rem", background: "rgba(0,0,0,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, backdropFilter: "blur(4px)" }}>Endre bakgrunn</button>
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerChange} />
        </div>
        <div style={{ padding: "2rem", flex: 1 }}>
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
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    {String(userData.role || "").toUpperCase() === ROLE_ADMIN && (
                      <button
                        type="button"
                        onClick={() => router.push("/admin")}
                        style={actionButtonStyle}
                      >
                        Admin panel
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      style={secondaryButtonStyle}
                    >
                      {t.editProfile}
                    </button>
                  </div>
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
                    <div>
                      <label style={statLabelStyle}>{t.birthDate}</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr auto", gap: "0.5rem", alignItems: "center" }}>
                        <select
                          value={dobParts.day}
                          onChange={(e) => setDobFromParts({ day: e.target.value })}
                          style={{ width: "100%", padding: "0.7rem 0.6rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        >
                          <option value="">Dag</option>
                          {Array.from({ length: maxDayInMonth }, (_, i) => {
                            const val = pad2(i + 1);
                            return <option key={val} value={val}>{val}</option>;
                          })}
                        </select>
                        <select
                          value={dobParts.month}
                          onChange={(e) => setDobFromParts({ month: e.target.value })}
                          style={{ width: "100%", padding: "0.7rem 0.6rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        >
                          <option value="">Måned</option>
                          {monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                        <select
                          value={dobParts.year}
                          onChange={(e) => setDobFromParts({ year: e.target.value })}
                          style={{ width: "100%", padding: "0.7rem 0.6rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        >
                          <option value="">År</option>
                          {Array.from({ length: maxBirthYear - 1899 }, (_, i) => {
                            const year = String(maxBirthYear - i);
                            return <option key={year} value={year}>{year}</option>;
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={() => setDobFromParts({ year: "", month: "", day: "" })}
                          style={{
                            padding: "0.62rem 0.75rem",
                            borderRadius: "4px",
                            border: `1px solid ${themeColors.border}`,
                            background: themeColors.cardBg,
                            color: themeColors.text,
                            cursor: "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Tom
                        </button>
                      </div>
                      <p style={{ margin: "0.45rem 0 0", color: themeColors.lightText, fontSize: "0.75rem" }}>
                        Velg dag, måned og år.
                      </p>
                      <input type="hidden" value={editFields.dob || ""} max={maxBirthDate} readOnly />
                    </div>
                    <div><label style={statLabelStyle}>{t.age}</label><input type="number" value={editFields.age} onChange={e => setEditFields({ ...editFields, age: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div><label style={statLabelStyle}>{t.phone}</label><input type="text" value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label style={statLabelStyle}>{t.email}</label><input type="email" value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }} /></div>
                    
                    <div style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}>
                      <strong style={{ display: "block", marginBottom: "0.75rem" }}>Endre passord</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                        <input
                          type="password"
                          placeholder="Nåværende passord"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        />
                        <input
                          type="password"
                          placeholder="Nytt passord"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        />
                        <input
                          type="password"
                          placeholder="Bekreft nytt passord"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "4px", border: `1px solid ${themeColors.border}`, background: themeColors.inputBg, color: themeColors.text, boxSizing: "border-box" }}
                        />
                      </div>

                      {passwordError ? <p style={{ color: "#b42318", marginTop: "0.75rem" }}>{passwordError}</p> : null}
                      {passwordSuccess ? <p style={{ color: "#067647", marginTop: "0.75rem" }}>{passwordSuccess}</p> : null}
                    </div>
                  </div>

                  <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                    <button onClick={handleSaveEdit} style={actionButtonStyle}>{t.save}</button>
                    <button onClick={() => setIsEditing(false)} style={secondaryButtonStyle}>{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
                    <div style={cardStyle}>
                      <strong>{t.bio}</strong>
                      <p style={{ marginBottom: interests.length > 0 ? "0.75rem" : 0 }}>{userData.bio || "Ingen bio ennå."}</p>
                      {interests.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {interests.map((tag) => (
                            <span key={tag} style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "999px",
                              background: themeColors.accent,
                              color: theme === "Mørk" ? "#0d0f12" : "#fff",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              letterSpacing: "0.02em",
                            }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={cardStyle}><strong>{t.details}</strong><p>{t.age}: {userData.age}</p><p>{t.phone}: {userData.phone}</p><p>{t.email}: {userData.email}</p><p>{t.birthDate}: {formatDobForDisplay(userData.dob)}</p></div>
                  </div>

                  {/* INTERESSETAGS */}
                  <div style={{ ...cardStyle, marginTop: "1rem" }}>
                    <p style={{ ...statLabelStyle, marginBottom: "1rem" }}>Interesser</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                      {["Fottur", "Sykling", "Ski", "Fjellklatring", "Padling", "Løping", "Vandring", "Fiske", "Camping", "Klatring"].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleToggleInterest(tag)}
                          style={{
                            padding: "0.4rem 1rem",
                            borderRadius: "999px",
                            border: `1px solid ${interests.includes(tag) ? themeColors.accent : themeColors.border}`,
                            background: interests.includes(tag) ? themeColors.accent : themeColors.cardBg,
                            color: interests.includes(tag) ? (theme === "Mørk" ? "#0d0f12" : "#fff") : themeColors.text,
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.82rem",
                            letterSpacing: "0.02em",
                            transition: "all 0.2s",
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
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

        {/* RESERVASJONER */}
        {activeCategory === "reservations" && (
          <div>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.8rem" }}>{t.reservations}</h2>
            <p style={{ margin: "0 0 1.5rem", color: themeColors.lightText }}>
              {t.reservationsIntro}
            </p>

            {reservationsLoading ? (
              <div style={{ background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "2rem", color: themeColors.lightText }}>
                {t.loadingReservations}
              </div>
            ) : reservationsError ? (
              <div style={{ background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "1.25rem", color: "#b42318" }}>
                {reservationsError}
              </div>
            ) : reservations.length === 0 ? (
              <div style={{ background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "2rem", textAlign: "center", color: themeColors.lightText }}>
                {t.noReservations}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {reservations.map((reservation) => {
                  const cabin = reservationCabins[String(reservation.cabin_id)] || null;
                  const cabinName = reservation.cabin_name || cabin?.name || `${t.cabinFallback} ${reservation.cabin_id}`;
                  const cabinLocation = reservation.cabin_location || cabin?.location || t.locationUnavailable;
                  const coverImage = Array.isArray(cabin?.image_urls) && cabin.image_urls.length > 0 ? cabin.image_urls[0] : null;

                  return (
                    <article
                      key={reservation.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "220px 1fr",
                        gap: "1rem",
                        background: themeColors.cardBg,
                        border: `1px solid ${themeColors.border}`,
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: themeColors.shadow,
                      }}
                    >
                      <div style={{ minHeight: 180, background: "#eef2f6", position: "relative" }}>
                        {coverImage ? (
                          <Image
                            src={coverImage}
                            alt={cabinName}
                            fill
                            unoptimized
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: themeColors.lightText, fontWeight: 700 }}>
                            {t.noCabinImage}
                          </div>
                        )}
                      </div>

                      <div style={{ padding: "1.25rem 1.25rem 1.1rem", display: "grid", gap: "0.9rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{cabinName}</h3>
                            <p style={{ margin: "0.35rem 0 0", color: themeColors.lightText }}>{cabinLocation}</p>
                          </div>
                          <span style={{ padding: "0.35rem 0.75rem", borderRadius: 999, background: themeColors.panelBg, border: `1px solid ${themeColors.border}`, fontSize: "0.78rem", fontWeight: 700 }}>
                            {formatReservationStatus(reservation.status)}
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                          <div style={{ background: themeColors.panelBg, border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: "0.9rem" }}>
                            <p style={statLabelStyle}>{t.from}</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{formatReservationDate(reservation.start_date)}</p>
                          </div>
                          <div style={{ background: themeColors.panelBg, border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: "0.9rem" }}>
                            <p style={statLabelStyle}>{t.to}</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{formatReservationDate(reservation.end_date)}</p>
                          </div>
                          <div style={{ background: themeColors.panelBg, border: `1px solid ${themeColors.border}`, borderRadius: 10, padding: "0.9rem" }}>
                            <p style={statLabelStyle}>{t.guests}</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{reservation.guests_count}</p>
                          </div>
                        </div>

                        {reservation.notes ? (
                          <p style={{ margin: 0, color: themeColors.cardText, lineHeight: 1.6 }}>
                            {reservation.notes}
                          </p>
                        ) : null}

                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                          <a
                            href={`/reserver/booking?cabinId=${encodeURIComponent(reservation.cabin_id)}`}
                            style={{
                              ...actionButtonStyle,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {t.openCabin}
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
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


        {activeCategory === "sosial" && (() => {
          // Load social data once when tab is first opened
          if (!socialLoaded && userData?.id) {
            setSocialLoaded(true);
            fetch(`/api/sosial/posts`)
              .then((r) => r.json().catch(() => []))
              .then((all) => {
                const arr = Array.isArray(all) ? all : [];
                setMyPosts(arr.filter((p) => String(p.userid) === String(userData.id)));
              });
            fetch(`/api/sosial/follows?userId=${userData.id}`)
              .then((r) => r.json().catch(() => ({ following: [], followers: [] })))
              .then((d) => setFollowStats({ following: (d.following ?? []).length, followers: (d.followers ?? []).length }));
          }
          return (
            <div>
              <h2 style={{ marginBottom: "1.5rem", fontSize: "1.8rem" }}>Sosial aktivitet</h2>

              {/* Stats row */}
              <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
                {[{ label: "Innlegg", value: myPosts.length }, { label: "Følger", value: followStats.following }, { label: "Følgere", value: followStats.followers }].map(({ label, value }) => (
                  <div key={label} style={{ flex: 1, background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "1.25rem", textAlign: "center", boxShadow: themeColors.shadow }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: themeColors.accent }}>{value}</div>
                    <div style={{ fontSize: "0.78rem", color: themeColors.lightText, marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Go to social platform */}
              <div style={{ marginBottom: "2rem" }}>
                <a href="/sosial" style={{ display: "inline-block", padding: "0.65rem 1.5rem", background: themeColors.accent, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem" }}>
                  Gå til sosialplattformen →
                </a>
              </div>

              {/* My posts */}
              <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", color: themeColors.text }}>Mine innlegg</h3>
              {myPosts.length === 0 ? (
                <div style={{ background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "2rem", textAlign: "center", color: themeColors.lightText }}>
                  Du har ikke publisert noen innlegg ennå.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {myPosts.map((p) => {
                    const ts = new Date(p.timestamp);
                    const ago = Date.now() - ts.getTime();
                    const timeStr = ago < 3600000 ? `${Math.floor(ago/60000)} min siden` : ago < 86400000 ? `${Math.floor(ago/3600000)} t siden` : ts.toLocaleDateString("no-NO");
                    return (
                      <div key={p.postid} style={{ background: themeColors.cardBg, border: `1px solid ${themeColors.border}`, borderRadius: 8, padding: "1rem 1.25rem", boxShadow: themeColors.shadow }}>
                        <div style={{ fontSize: "0.72rem", color: themeColors.lightText, marginBottom: "0.4rem" }}>{timeStr}</div>
                        <div style={{ fontSize: "0.92rem", lineHeight: 1.6, color: themeColors.text }}>{p.caption}</div>
                        <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.75rem", fontSize: "0.78rem", color: themeColors.lightText }}>
                          <span>❤️ {p.likes || 0} liker</span>
                          <span>💬 {p.comment_count || 0} kommentarer</span>
                          <a href={`/sosial#post-${p.postid}`} style={{ color: themeColors.accent, textDecoration: "none", fontWeight: 600 }}>Vis →</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        </div>{/* end padding div */}

        {/* Logg ut knapp — nederst på siden */}
        <div style={{ padding: "1.5rem 2rem 3rem", borderTop: `1px solid ${themeColors.border}`, display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setShowLogoutModal(true)}
            style={{
              padding: "0.85rem 2rem",
              borderRadius: "4px",
              border: "1px solid #ef4444",
              background: "transparent",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          >
            {t.logout}
          </button>
        </div>
      </section>

      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

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