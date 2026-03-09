"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();

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

  const [expanded, setExpanded] = useState({
    account: false,
    transactions: false,
    payment: false,
    trips: false,
    settings: false,
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  function toggleCategory(category) {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  }

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

  const sidebarItemStyle = {
    padding: "1rem 1.2rem",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid #ddd",
    marginBottom: "0.5rem",
    background: "#f7f7f7",
  };

  const sidebarContainerStyle = {
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

  const infoStyle = {
    paddingLeft: "1rem",
    paddingTop: "0.5rem",
    color: "#555",
    background: "#f0f0f0",
    borderRadius: "8px",
    marginTop: "0.5rem",
  };

  return (
    <main
      style={{
        display: "flex",
        width: "100%",
        minHeight: "100vh",
        fontFamily: "Poppins, Arial, sans-serif",
        background: "#ffffff",
      }}
    >
      {/* SIDEBAR */}
      <div style={sidebarContainerStyle}>
        <div
          style={{ marginBottom: "2rem", fontWeight: 700, fontSize: "1.2rem" }}
        >
          Kategorier
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Min konto */}
          <div
            style={sidebarItemStyle}
            onClick={() => toggleCategory("account")}
          >
            Min konto
          </div>
          {expanded.account && (
            <div style={infoStyle}>
              <p><strong>Navn:</strong> {user.name}</p>
              <p><strong>Alder:</strong> {user.age}</p>
              <p><strong>Telefon:</strong> {user.phone}</p>
              <p><strong>Biografi:</strong> {user.bio}</p>
            </div>
          )}

          {/* Transaksjoner */}
          <div
            style={sidebarItemStyle}
            onClick={() => toggleCategory("transactions")}
          >
            Transaksjoner
          </div>
          {expanded.transactions && (
            <div style={infoStyle}>
              {user.transactions.length === 0 ? (
                <p>Ingen transaksjoner enda</p>
              ) : (
                user.transactions.map((tx, i) => (
                  <p key={i}>
                    {tx.date} - {tx.desc} - {tx.amount}
                  </p>
                ))
              )}
            </div>
          )}

          {/* Betalingsinformasjon */}
          <div
            style={sidebarItemStyle}
            onClick={() => toggleCategory("payment")}
          >
            Betalingsinformasjon
          </div>
          {expanded.payment && (
            <div style={infoStyle}>
              <p><strong>Kort:</strong> {user.payment.card}</p>
              <p><strong>Fakturaperiode:</strong> {user.payment.billing}</p>
            </div>
          )}

          {/* Mine turer */}
          <div
            style={sidebarItemStyle}
            onClick={() => toggleCategory("trips")}
          >
            Mine turer
          </div>
          {expanded.trips && (
            <div style={infoStyle}>
              <p>Siste tur: {user.lastTrip}</p>
              <p>Se flere turer i historikken din</p>
            </div>
          )}

          {/* Innstillinger */}
          <div
            style={sidebarItemStyle}
            onClick={() => toggleCategory("settings")}
          >
            Innstillinger
          </div>
          {expanded.settings && (
            <div style={infoStyle}>
              <p><strong>Varslinger:</strong> {user.settings.notifications ? "På" : "Av"}</p>
              <p><strong>Tema:</strong> {user.settings.theme}</p>
            </div>
          )}
        </div>

        {/* Logg ut knapp */}
        <div style={{ marginTop: "1rem" }}>
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
      </div>

      {/* HOVEDINNHOLD */}
      <div style={{ flex: 1, padding: "2rem" }}>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          <img
            src={user.profileImage}
            alt="Profilbilde"
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #eee",
            }}
          />

          <div>
            <h1 style={{ marginBottom: "0.5rem", color: "#171717" }}>
              {user.name}
            </h1>
            <p style={{ color: "#555", marginBottom: "0.5rem" }}>{user.bio}</p>
            <p style={{ color: "#444" }}>Alder: {user.age}</p>
            <p style={{ color: "#444" }}>Telefon: {user.phone}</p>
            <p style={{ color: "#444" }}>Siste tur: {user.lastTrip}</p>
          </div>
        </div>
      </div>

      {/* LOGG UT MODAL */}
      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "12px",
              width: "300px",
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>Er du sikker på at du vil logge ut?</h2>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  cursor: "pointer",
                }}
              >
                Avbryt
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#171717",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Logg ut
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}