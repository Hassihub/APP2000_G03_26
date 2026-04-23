"use client";

import { useState, useEffect } from "react";

export default function AdminAdvertiserApprovalPanel() {
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAdvertiser, setSelectedAdvertiser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingAdvertisers();
  }, []);

  const fetchPendingAdvertisers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/advertisers/pending");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAdvertisers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (advertiserId) => {
    if (!window.confirm("Godkjenne denne annonsøren?")) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/advertisers/${advertiserId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Approval failed");
      
      setAdvertisers(advertisers.filter((a) => a.id !== advertiserId));
      alert("Annonsør godkjent!");
    } catch (err) {
      alert("Feil: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (advertiserId) => {
    if (!rejectReason.trim()) {
      alert("Skriv inn grunn for avvisning");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/advertisers/${advertiserId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!response.ok) throw new Error("Rejection failed");

      setAdvertisers(advertisers.filter((a) => a.id !== advertiserId));
      setSelectedAdvertiser(null);
      setRejectReason("");
      alert("Annonsør avvist!");
    } catch (err) {
      alert("Feil: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Laster...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Ventende Annonsører ({advertisers.length})
      </h2>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {advertisers.length === 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "2rem", textAlign: "center", color: "#166534" }}>
          Ingen ventende annonsører
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1.5rem" }}>
          {advertisers.map((advertiser) => (
            <div
              key={advertiser.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
                  {advertiser.company_name}
                </h3>
                <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  <strong>Kontakt:</strong> {advertiser.contact_person}
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  <strong>E-post:</strong> {advertiser.email}
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  <strong>Telefon:</strong> {advertiser.phone}
                </p>
                {advertiser.company_description && (
                  <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    <strong>Beskrivelse:</strong> {advertiser.company_description}
                  </p>
                )}
                <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                  <strong>Betalingsmåte:</strong> {advertiser.payment_method}
                </p>
              </div>

              {selectedAdvertiser === advertiser.id && (
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                    Grunn for avvisning:
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #fcd34d",
                      borderRadius: "4px",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                    placeholder="Skriv grunn for avvisning..."
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {selectedAdvertiser !== advertiser.id ? (
                  <>
                    <button
                      onClick={() => handleApprove(advertiser.id)}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: actionLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      ✓ Godkjenn
                    </button>
                    <button
                      onClick={() => setSelectedAdvertiser(advertiser.id)}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✗ Avvis
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleReject(advertiser.id)}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: actionLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {actionLoading ? "Behandler..." : "Bekreft Avvisning"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAdvertiser(null);
                        setRejectReason("");
                      }}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#9ca3af",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Avbryt
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
