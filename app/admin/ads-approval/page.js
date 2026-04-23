"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdsApprovalPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("advertisers");
  const [processingId, setProcessingId] = useState(null);
  const [comment, setComment] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  async function fetchPendingApprovals() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/ads-approval");
      if (!res.ok) {
        if (res.status === 403) {
          router.push("/");
          return;
        }
        throw new Error("Kunne ikke hente ventende godkjenninger");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id, type) {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/admin/ads-approval/${id}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error("Godkjenning feilet");
      setComment("");
      setSelectedItem(null);
      fetchPendingApprovals();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(id, type) {
    if (!comment.trim()) {
      setError("Kommentar er påkrevd ved avvisning");
      return;
    }
    try {
      setProcessingId(id);
      const res = await fetch(`/api/admin/ads-approval/${id}/${type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error("Avvisning feilet");
      setComment("");
      setSelectedItem(null);
      fetchPendingApprovals();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Laster...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;

  const advertisers = data?.advertisers || [];
  const ads = data?.ads || [];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 2rem", fontSize: "2rem", fontWeight: 800 }}>
          Godkjenning av annonseportal
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "2px solid #e5e7eb" }}>
          <button
            onClick={() => { setActiveTab("advertisers"); setSelectedItem(null); }}
            style={{
              padding: "1rem 1.5rem",
              border: "none",
              background: "none",
              borderBottom: activeTab === "advertisers" ? "3px solid #0066ff" : "none",
              color: activeTab === "advertisers" ? "#0066ff" : "#667085",
              fontWeight: activeTab === "advertisers" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Annonsører ({advertisers.length})
          </button>
          <button
            onClick={() => { setActiveTab("ads"); setSelectedItem(null); }}
            style={{
              padding: "1rem 1.5rem",
              border: "none",
              background: "none",
              borderBottom: activeTab === "ads" ? "3px solid #0066ff" : "none",
              color: activeTab === "ads" ? "#0066ff" : "#667085",
              fontWeight: activeTab === "ads" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Annonser ({ads.length})
          </button>
        </div>

        {/* Advertisers Tab */}
        {activeTab === "advertisers" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div>
              {advertisers.length === 0 ? (
                <div style={{
                  background: "#ecfdf5",
                  border: "1px solid #d1fae5",
                  color: "#166534",
                  padding: "2rem",
                  borderRadius: "8px",
                  textAlign: "center",
                }}>
                  ✓ Ingen ventende annonsør-godkjenninger
                </div>
              ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {advertisers.map(adv => (
                    <div
                      key={adv.id}
                      onClick={() => setSelectedItem(adv)}
                      style={{
                        background: selectedItem?.id === adv.id ? "#f0f7ff" : "#fff",
                        border: selectedItem?.id === adv.id ? "2px solid #0066ff" : "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem",
                        cursor: "pointer",
                      }}
                    >
                      <h3 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{adv.company_name}</h3>
                      <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>
                        Kontakt: {adv.contact_person}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#667085" }}>
                        {adv.email} | {adv.phone}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedItem?.type === "advertiser" && (
              <div style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "1.5rem",
              }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 700 }}>
                  {selectedItem.company_name}
                </h3>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>Kontaktperson</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.contact_person}</p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>E-post</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.email}</p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>Telefon</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.phone}</p>
                </div>

                {selectedItem.website && (
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>Nettside</p>
                    <p style={{ margin: 0 }}>
                      <a href={selectedItem.website} target="_blank" rel="noopener noreferrer" style={{
                        color: "#0066ff",
                        textDecoration: "none",
                      }}>
                        {selectedItem.website}
                      </a>
                    </p>
                  </div>
                )}

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Kommentar (valgfritt ved godkjenning, påkrevd ved avvisning)"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                    fontFamily: "inherit",
                    minHeight: "80px",
                  }}
                />

                <div style={{ display: "flex", gap: "1rem" }}>
                  <button
                    onClick={() => approve(selectedItem.id, "advertiser")}
                    disabled={processingId === selectedItem.id}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Godkjenn
                  </button>
                  <button
                    onClick={() => reject(selectedItem.id, "advertiser")}
                    disabled={processingId === selectedItem.id}
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
                    ✕ Avvis
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ads Tab */}
        {activeTab === "ads" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div>
              {ads.length === 0 ? (
                <div style={{
                  background: "#ecfdf5",
                  border: "1px solid #d1fae5",
                  color: "#166534",
                  padding: "2rem",
                  borderRadius: "8px",
                  textAlign: "center",
                }}>
                  ✓ Ingen ventende annonse-godkjenninger
                </div>
              ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {ads.map(ad => (
                    <div
                      key={ad.id}
                      onClick={() => setSelectedItem(ad)}
                      style={{
                        background: selectedItem?.id === ad.id ? "#f0f7ff" : "#fff",
                        border: selectedItem?.id === ad.id ? "2px solid #0066ff" : "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem",
                        cursor: "pointer",
                      }}
                    >
                      <h3 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{ad.title}</h3>
                      <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>
                        Annonsør: {ad.company_name}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#667085" }}>
                        Kategori: {ad.category_name} | Plassering: {ad.placement}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedItem?.type === "ad" && (
              <div style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "1.5rem",
                maxHeight: "80vh",
                overflowY: "auto",
              }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 700 }}>
                  {selectedItem.title}
                </h3>

                {selectedItem.image_url && (
                  <div style={{ marginBottom: "1rem" }}>
                    <img src={selectedItem.image_url} alt="Ad" style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: "6px",
                      marginBottom: "0.5rem",
                    }} />
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#667085" }}>
                      ℹ️ Sjekk at bildet passer grafisk profil
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>Beskrivelse</p>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>{selectedItem.description}</p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", color: "#667085" }}>Destinasjons-URL</p>
                  <p style={{ margin: 0 }}>
                    <a href={selectedItem.target_url} target="_blank" rel="noopener noreferrer" style={{
                      color: "#0066ff",
                      textDecoration: "none",
                    }}>
                      {selectedItem.target_url}
                    </a>
                  </p>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                  padding: "1rem",
                  background: "#f9fafb",
                  borderRadius: "6px",
                }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085" }}>Kategori</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.category_name}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085" }}>Plassering</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.placement}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085" }}>Betalingsmodell</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{selectedItem.pricing_model}</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085" }}>Periode</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {new Date(selectedItem.created_at).toLocaleDateString("no-NO")}
                    </p>
                  </div>
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Kommentar (valgfritt ved godkjenning, påkrevd ved avvisning)"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                    fontFamily: "inherit",
                    minHeight: "80px",
                  }}
                />

                <div style={{ display: "flex", gap: "1rem" }}>
                  <button
                    onClick={() => approve(selectedItem.id, "ad")}
                    disabled={processingId === selectedItem.id}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Godkjenn & Publiser
                  </button>
                  <button
                    onClick={() => reject(selectedItem.id, "ad")}
                    disabled={processingId === selectedItem.id}
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
                    ✕ Avvis
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
