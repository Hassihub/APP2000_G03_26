"use client";
<<<<<<< HEAD
import { useState } from "react";
import Link from "next/link";
=======

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')

export default function SignUp() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

<<<<<<< HEAD
  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passordene matcher ikke!");
      return;
    }
=======
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            router.replace("/");
          }
        }
      } catch {
        // ignore, just show signup form
      }
    };

    checkLoggedIn();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
<<<<<<< HEAD
      if (res.ok) {
        alert(`Bruker ${data.user.username} registrert!`);
        setFormData({ username: "", email: "", password: "", confirmPassword: "" });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt!");
=======

      if (!res.ok) {
        setError(data.error || "Kunne ikke opprette konto");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      setError("Noe gikk galt");
      setLoading(false);
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
    }
  };

  return (
<<<<<<< HEAD
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
=======
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Registrer deg</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
>>>>>>> parent of e7135d2 (Merge branch 'MariusMain')
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Brukernavn
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          E-post
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Passord (minst 8 tegn)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          {loading ? "Oppretter konto..." : "Opprett konto"}
        </button>
      </form>
    </div>
  );
}
