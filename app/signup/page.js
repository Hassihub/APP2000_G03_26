"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke opprette konto");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      setError("Noe gikk galt");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Registrer deg</h1>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Brukernavn
        </label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, username: e.target.value }))
          }
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
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
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
          value={formData.password}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, password: e.target.value }))
          }
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

        <label style={{ display: "block", margin: "0.75rem 0 0.5rem" }}>
          Bekreft passord
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              confirmPassword: e.target.value,
            }))
          }
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.75rem",
          }}
        />
      </form>
    </div>
  );
}
