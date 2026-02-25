"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        setUser(data.user);
        setUsername(data.user?.username || "");
      } catch (err) {
        setError("Kunne ikke hente bruker");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      router.push("/login");
    } catch (err) {
      setError("Kunne ikke logge ut");
    }
  };

  const handleUsernameSave = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke oppdatere profil");
        return;
      }

      setUser(data.user);
    } catch (err) {
      setError("Kunne ikke oppdatere profil");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke endre passord");
        return;
      }

      setPasswordMessage("Passordet er oppdatert");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError("Kunne ikke endre passord");
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Er du sikker på at du vil slette profilen din?")) {
      return;
    }

    setError("");

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke slette profil");
        return;
      }

      router.push("/");
    } catch (err) {
      setError("Kunne ikke slette profil");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Laster profil...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Profil</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Brukerinformasjon</h2>
        <p>
          <strong>E-post:</strong> {user.email}
        </p>
        <form onSubmit={handleUsernameSave} style={{ marginTop: "1rem" }}>
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
          <button
            type="submit"
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            Lagre brukernavn
          </button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Endre passord</h2>
        <form onSubmit={handlePasswordChange}>
          <label style={{ display: "block", marginTop: "0.5rem" }}>
            Nåværende passord
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.75rem",
            }}
          />

          <label style={{ display: "block", marginTop: "0.5rem" }}>
            Nytt passord
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.75rem",
            }}
          />

          <button
            type="submit"
            style={{ padding: "0.5rem 1rem", cursor: "pointer", marginTop: "0.5rem" }}
          >
            Oppdater passord
          </button>
        </form>
        {passwordMessage && (
          <p style={{ color: "green", marginTop: "0.5rem" }}>
            {passwordMessage}
          </p>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Logg ut
        </button>
        <button
          type="button"
          onClick={handleDeleteAccount}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            marginLeft: "1rem",
            backgroundColor: "#b00020",
            color: "white",
            border: "none",
          }}
        >
          Slett profil
        </button>
      </section>
    </div>
  );
}
