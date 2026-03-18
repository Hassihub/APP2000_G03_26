"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const defaultUser = {
    name: "Marius Nordli",
    dob: "1999-01-01",
    age: 24,
    phone: "+47 123 45 678",
    email: "marius@example.com",
    bio: "Friluftsinteressert student som elsker fjellturer og natur.",
    lastTrip: {
      title: "Helgetur til Gaustatoppen",
      date: "Februar 2026",
      description: "En fantastisk vintertur med utsikt over halve Norge. Startet tidlig på morgenen og nådde toppen i solnedgang.",
      image: "/images/gaustatoppen.jpg"
    },
    profileImage: "/images/profil.jpg",
    transactions: [
      { date: "2026-02-01", amount: "450 NOK", desc: "Hyttebooking" },
      { date: "2026-01-20", amount: "150 NOK", desc: "Padletur-utstyr" },
    ],
    payment: { card: "Visa **** 1234", billing: "Januar 2026" },
    settings: { notifications: true, theme: "Lys" },
  };

  const [activeCategory, setActiveCategory] = useState("account");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({ ...defaultUser });
  const [editFields, setEditFields] = useState({ ...defaultUser });
  const [profileImage, setProfileImage] = useState(() => {
    return localStorage.getItem("profileImage") || defaultUser.profileImage;
  });

  // Escape lukker redigeringsmodus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsEditing(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleImageClick() {
    fileInputRef.current.click();
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
        setProfileImage(data.filePath);
        localStorage.setItem("profileImage", data.filePath);
      } else {
        alert("Opplasting feilet");
      }
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt");
    }
  }

  function handleSaveEdit() {
    setUserData({ ...editFields });
    setIsEditing(false);
  }

  // ✅ FUNGERENDE LOGOUT
  async function handleLogout() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("profileImage");
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt ved utlogging");
    }
  }

  const sidebarItemStyle = (category) => ({
    padding: "1rem",
    cursor: "pointer",
    borderRadius: "8px",
    fontWeight: activeCategory === category ? 600 : 500,
    marginBottom: "10px",
    transition: "all 0.2s",
    background: activeCategory === category ? "#e0e0e0" : "#f9f9f9",
  });

  const cardStyle = {
    background: "#fff",
    padding: "1.5rem",
    borderRadius: "12px",
    marginBottom: "2rem",
    boxShadow: "0 6px 15px rgba(0,0,0,0.05)",
  };

  return (
    <main style={{ display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: "#f5f5f5" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarOpen ? "250px" : "60px",
        transition: "width 0.3s",
        padding: "2rem 1rem",
        borderRight: "1px solid #ddd",
        background: "#fafafa",
        position: "relative"
      }}>
        <div onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: "pointer", marginBottom: "2rem", fontSize: "22px" }}>
          ☰
        </div>

        {sidebarOpen && (
          <>
            <h2 style={{ marginBottom: "2rem" }}>Kategorier</h2>
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
      <section style={{ flex: 1, padding: "2rem" }}>

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
              border: "3px solid #ddd",
              background: "#f0f0f0"
            }}>
              <img src={profileImage} alt="Profilbilde" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{
                position: "absolute",
                top: "5px",
                right: "5px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#171717",
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
                      border: "1px solid #171717",
                      background: "#fff",
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
                  background: "#fff",
                  padding: "1rem",
                  borderRadius: "10px",
                  boxShadow: "0 6px 15px rgba(0,0,0,0.1)",
                  marginTop: "1rem"
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div><label>Navn:</label><input type="text" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                    <div><label>Fødselsdato:</label><input type="date" value={editFields.dob} onChange={e => setEditFields({ ...editFields, dob: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                    <div><label>Alder:</label><input type="number" value={editFields.age} onChange={e => setEditFields({ ...editFields, age: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                    <div><label>Telefon:</label><input type="text" value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label>Email:</label><input type="email" value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label>Bio:</label><textarea value={editFields.bio} onChange={e => setEditFields({ ...editFields, bio: e.target.value })} rows={3} style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }} /></div>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem" }}>
                    <button onClick={handleSaveEdit} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", background: "#171717", color: "#fff", cursor: "pointer" }}>Lagre</button>
                    <button onClick={() => setIsEditing(false)} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #ccc", background: "#f7f7f7", cursor: "pointer" }}>Avbryt</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={cardStyle}><strong>Bio</strong><p>{userData.bio}</p></div>
                    <div style={cardStyle}><strong>Detaljer</strong><p>Alder: {userData.age}</p><p>Telefon: {userData.phone}</p><p>Email: {userData.email}</p><p>Fødselsdato: {userData.dob}</p></div>
                  </div>

                  {/* NYTT: Siste tur med bilde */}
                  <div style={{ ...cardStyle, marginTop: "1rem" }}>
                    <strong>Siste tur</strong>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.5rem" }}>
                      <img
                        src={userData.lastTrip.image}
                        alt="Siste tur"
                        style={{ width: "150px", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                      />
                      <div>
                        <p style={{ margin: "0", fontWeight: "600" }}>{userData.lastTrip.title}</p>
                        <p style={{ margin: "2px 0", color: "#666" }}>{userData.lastTrip.date}</p>
                        <p style={{ margin: 0 }}>{userData.lastTrip.description}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeCategory === "transactions" && <div style={cardStyle}><h2>Transaksjoner</h2><ul>{userData.transactions.map((tx, i) => <li key={i}>{tx.date} - {tx.desc} - {tx.amount}</li>)}</ul></div>}
        {activeCategory === "payment" && <div style={cardStyle}><h2>Betalingsinformasjon</h2><p>{userData.payment.card}</p><p>{userData.payment.billing}</p></div>}
        {activeCategory === "trips" && <div style={cardStyle}><h2>Mine turer</h2><p>{userData.lastTrip.title}</p></div>}
        {activeCategory === "settings" && <div style={cardStyle}><h2>Innstillinger</h2><p>Varslinger: {userData.settings.notifications ? "På" : "Av"}</p><p>Tema: {userData.settings.theme}</p></div>}

      </section>

      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

      {/* LOGOUT MODAL */}
      {showLogoutModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ background: "#fff", padding: "2rem", borderRadius: "8px" }}>
          <h3>Er du sikker?</h3>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button onClick={() => setShowLogoutModal(false)}>Avbryt</button>
            <button onClick={handleLogout}>Logg ut</button>
          </div>
        </div>
      </div>}

    </main>
  );
}