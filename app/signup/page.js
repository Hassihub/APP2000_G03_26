"use client";
import { useState } from "react";
import Link from "next/link";

export default function SignUp() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passordene matcher ikke!");
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Bruker ${data.user.username} registrert!`);
        setFormData({ username: "", email: "", password: "", confirmPassword: "" });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt!");
    }
  };

  return (
    <main style={{
      position: "relative",
      minHeight: "100vh",
      backgroundImage: "url('/images/profilbakgrunn.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      color: "white",
      fontFamily: "Poppins, Arial, sans-serif"
    }}>
      {/* Overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.3)",
        zIndex: 0
      }}></div>

      {/* Innhold */}
      <div style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        background: "rgba(0,0,0,0.6)",
        padding: "3rem 2rem",
        borderRadius: "12px",
        width: "350px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
      }}>
        <h1 style={{ marginBottom: "2rem" }}>Registrer deg</h1>

        <form onSubmit={handleSubmit} style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem"
        }}>
          <input
            type="text"
            name="username"
            placeholder="Brukernavn"
            value={formData.username}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />
          <input
            type="email"
            name="email"
            placeholder="E-post"
            value={formData.email}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />
          <input
            type="password"
            name="password"
            placeholder="Passord"
            value={formData.password}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Bekreft passord"
            value={formData.confirmPassword}
            onChange={handleChange}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "white",
            }}
          />
          <button type="submit" style={{
            padding: "0.75rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#ffffffcc",
            color: "#171717",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s ease"
          }}>Registrer</button>
        </form>

        <p style={{ marginTop: "1.5rem" }}>
          Har du allerede konto? <Link href="/profile" style={{ color: "#ffffffcc", fontWeight: "600", textDecoration: "underline" }}>Logg inn</Link>
        </p>
      </div>
    </main>
  );
}
