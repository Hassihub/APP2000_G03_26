"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvertiserRegistration() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    company_description: "",
    contact_person: "",
    phone: "",
    website: "",
    payment_method: "card",
    bank_account: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/advertisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Registration failed");
      }

      setSuccess("Registrering vellykket! Du har blitt oppført som annonsør og avventer godkjenning.");
      setForm({
        company_name: "",
        company_description: "",
        contact_person: "",
        phone: "",
        website: "",
        payment_method: "card",
        bank_account: "",
      });

      setTimeout(() => router.push("/profile"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "2rem" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111827" }}>
          Registrer som Annonsør
        </h1>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", color: "#166534" }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Bedriftsnavn *
            </label>
            <input
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="F.eks. Mountain Gear AS"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Bedriftsbeskrivelse
            </label>
            <textarea
              name="company_description"
              value={form.company_description}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                minHeight: "120px",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              placeholder="Beskriv bedriften din og hva du tilbyr..."
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Kontaktperson *
            </label>
            <input
              type="text"
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="Navn på kontaktperson"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Telefon *
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="+47 98765432"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Nettside
            </label>
            <input
              type="url"
              name="website"
              value={form.website}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="https://bedrift.no"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
              Betalingsmåte *
            </label>
            <select
              name="payment_method"
              value={form.payment_method}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            >
              <option value="card">Kredittkort</option>
              <option value="invoice">Faktura</option>
              <option value="bank_transfer">Bankoverføring</option>
            </select>
          </div>

          {form.payment_method === "bank_transfer" && (
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }}>
                Kontonummer
              </label>
              <input
                type="text"
                name="bank_account"
                value={form.bank_account}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
                placeholder="Norsk kontonummer (11 siffer)"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: loading ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.3s",
            }}
          >
            {loading ? "Registrerer..." : "Registrer som Annonsør"}
          </button>
        </form>

        <div style={{ marginTop: "2rem", padding: "1rem", background: "#f0f9ff", borderRadius: "8px", fontSize: "0.9rem", color: "#1e40af" }}>
          <strong>Hva skjer videre?</strong>
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem", lineHeight: 1.6 }}>
            <li>Du godkjennes av redaktør innen 2 arbeidsdager</li>
            <li>Du vil motta e-post når godkjenningen er gjennomført</li>
            <li>Deretter kan du opprette og publisere annonser</li>
            <li>Annonser må godkjennes av redaktør før de vises</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
