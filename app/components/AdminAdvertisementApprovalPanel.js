"use client";

import { useState, useEffect } from "react";

export default function AdminAdvertisementApprovalPanel() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAd, setSelectedAd] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingAds();
  }, []);

  const fetchPendingAds = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/advertisements/pending");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAds(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (adId) => {
    if (!window.confirm("Godkjenne denne annonsen?")) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/advertisements/${adId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Approval failed");

      setAds(ads.filter((a) => a.id !== adId));
      alert("Annonse godkjent!");
    } catch (err) {
      alert("Feil: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (adId) => {
    if (!rejectReason.trim()) {
      alert("Skriv inn grunn for avvisning");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/advertisements/${adId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!response.ok) throw new Error("Rejection failed");

      setAds(ads.filter((a) => a.id !== adId));
      setSelectedAd(null);
      setRejectReason("");
      alert("Annonse avvist!");
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
        Ventende Annonser ({ads.length})
      </h2>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {ads.length === 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "2rem", textAlign: "center", color: "#166534" }}>
          Ingen ventende annonser
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {ads.map((ad) => (
            <div
              key={ad.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "1.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
                {ad.image_url && (
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    style={{
                      width: "200px",
                      height: "150px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  />
                )}
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
                    {ad.title}
                  </h3>
                  <p style={{ color: "#6b7280", marginBottom: "0.75rem" }}>
                    {ad.description}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.9rem", color: "#6b7280" }}>
                    <div>
                      <strong>Annonsør:</strong> {ad.company_name}
                    </div>
                    <div>
                      <strong>E-post:</strong> {ad.email}
                    </div>
                    <div>
                      <strong>URL:</strong> <a href={ad.url} target="_blank" style={{ color: "#2563eb" }}>{ad.url}</a>
                    </div>
                    <div>
                      <strong>Plassering:</strong> {ad.placement}
                    </div>
                    <div>
                      <strong>Startdato:</strong> {new Date(ad.start_date).toLocaleDateString("no-NO")}
                    </div>
                    <div>
                      <strong>Sluttdato:</strong> {new Date(ad.end_date).toLocaleDateString("no-NO")}
                    </div>
                    <div>
                      <strong>Modell:</strong> {ad.pricing_model === "cpc" ? `Pay-Per-Click (${ad.cost_per_click} kr)` : `CPM (${ad.cost_per_thousand_impressions} kr)`}
                    </div>
                    <div>
                      <strong>Kategorier:</strong> {ad.categories?.join(", ") || "Ingen"}
                    </div>
                  </div>
                </div>
              </div>

              {selectedAd === ad.id && (
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
                {selectedAd !== ad.id ? (
                  <>
                    <button
                      onClick={() => handleApprove(ad.id)}
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
                      ✓ Godkjenn Annonse
                    </button>
                    <button
                      onClick={() => setSelectedAd(ad.id)}
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
                      ✗ Avvis Annonse
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleReject(ad.id)}
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
                        setSelectedAd(null);
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
