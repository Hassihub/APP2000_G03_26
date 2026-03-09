"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();

  // Brukerdata
  const user = {
    name: "Marius Nordli",
    age: 24,
    phone: "+47 123 45 678",
    bio: "Friluftsinteressert student som elsker fjellturer og natur.",
    lastTrip: "Gaustatoppen",
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

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/login");
      } else {
        alert("Kunne ikke logge ut");
      }
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt");
    }
  }

  // Sidebar styling
  const sidebarItemStyle = (category) => ({
    padding: "1rem 1.2rem",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "0.5rem",
    fontWeight: activeCategory === category ? 600 : 500,
    background: activeCategory === category ? "#e0e0e0" : "#f7f7f7",
    border: activeCategory === category ? "2px solid #171717" : "1px solid #ddd",
    transition: "all 0.2s ease",
  });

  const sidebarStyle = {
    width: "250px",
    display: "flex",
    flexDirection: "column",
    padding: "2rem 1rem",
    background: "#ffffff",
    boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
    height: "100vh",
    position: "sticky",
    top: 0,
  };

  const contentStyle = {
    flex: 1,
    padding: "2rem",
    background: "#f9f9f9",
    minHeight: "100vh",
  };

  const sectionStyle = {
    background: "#ffffff",
    padding: "1.5rem",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
  };

  return (
    <main style={{ display: "flex", width: "100%", minHeight: "100vh", fontFamily: "Poppins, Arial, sans-serif" }}>
      
      {/* VENSTRE SIDEBAR */}
      <div style={sidebarStyle}>
        <h2 style={{ marginBottom: "2rem", fontWeight: 700, fontSize: "1.2rem" }}>Kategorier</h2>

        <div style={{ flex: 1 }}>
          <div style={sidebarItemStyle("account")} onClick={() => setActiveCategory("account")}>Min konto</div>
          <div style={sidebarItemStyle("transactions")} onClick={() => setActiveCategory("transactions")}>Transaksjoner</div>
          <div style={sidebarItemStyle("payment")} onClick={() => setActiveCategory("payment")}>Betalingsinformasjon</div>
          <div style={sidebarItemStyle("trips")} onClick={() => setActiveCategory("trips")}>Mine turer</div>
          <div style={sidebarItemStyle("settings")} onClick={() => setActiveCategory("settings")}>Innstillinger</div>
        </div>

        {/* LOGG UT */}
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{
            width: "100%",
            padding: "0.8rem",
            borderRadius: "10px",
            border: "none",
            background: "#171717",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Logg ut
        </button>
      </div>

      {/* HØYRE HOVEDINNHOLD */}
      <div style={contentStyle}>
        {activeCategory === "account" && (
          <div style={sectionStyle}>
            <h2>Min konto</h2>
            <img src={user.profileImage} alt="Profilbilde" style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", border: "3px solid #eee", marginBottom: "1rem" }} />
            <p><strong>Navn:</strong> {user.name}</p>
            <p><strong>Alder:</strong> {user.age}</p>
            <p><strong>Telefon:</strong> {user.phone}</p>
            <p><strong>Biografi:</strong> {user.bio}</p>
            <p><strong>Siste tur:</strong> {user.lastTrip}</p>
          </div>
        )}

        {activeCategory === "transactions" && (
          <div style={sectionStyle}>
            <h2>Transaksjoner</h2>
            {user.transactions.length === 0 ? <p>Ingen transaksjoner</p> :
              <ul>
                {user.transactions.map((tx, i) => (
                  <li key={i}>{tx.date} - {tx.desc} - {tx.amount}</li>
                ))}
              </ul>
            }
          </div>
        )}

        {activeCategory === "payment" && (
          <div style={sectionStyle}>
            <h2>Betalingsinformasjon</h2>
            <p><strong>Kort:</strong> {user.payment.card}</p>
            <p><strong>Fakturaperiode:</strong> {user.payment.billing}</p>
          </div>
        )}

        {activeCategory === "trips" && (
          <div style={sectionStyle}>
            <h2>Mine turer</h2>
            <p>Siste tur: {user.lastTrip}</p>
            <p>Se flere turer i historikken din.</p>
          </div>
        )}

        {activeCategory === "settings" && (
          <div style={sectionStyle}>
            <h2>Innstillinger</h2>
            <p><strong>Varslinger:</strong> {user.settings.notifications ? "På" : "Av"}</p>
            <p><strong>Tema:</strong> {user.settings.theme}</p>
          </div>
        )}
      </div>

      {/* LOGG UT MODAL */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "300px", textAlign: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.3)" }}>
            <h2 style={{ marginBottom: "1rem" }}>Er du sikker på at du vil logge ut?</h2>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #ccc", background: "#f7f7f7", cursor: "pointer" }}>Avbryt</button>
              <button onClick={handleLogout} style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: "#171717", color: "white", cursor: "pointer" }}>Logg ut</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}