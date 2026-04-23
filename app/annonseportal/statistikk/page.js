"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedAd, setSelectedAd] = useState(null);
  const [adDetails, setAdDetails] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const res = await fetch("/api/ads/analytics/summary");
      if (!res.ok) throw new Error("Kunne ikke hente statistikk");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectAd(adId) {
    try {
      setSelectedAd(adId);
      const res = await fetch(`/api/ads/analytics/${adId}`);
      if (!res.ok) throw new Error("Kunne ikke hente annonse-detaljer");
      const json = await res.json();
      setAdDetails(json);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Laster statistikk...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!data) return <div style={{ padding: "2rem" }}>Ingen data</div>;

  const { ads, summary } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              Statistikk og analyser
            </h1>
            <p style={{ margin: 0, color: "#667085" }}>
              Oversikt over ytelse på alle dine annonser
            </p>
          </div>
          <Link href="/annonseportal/dashboard">
            <button style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}>
              ← Tilbake til dashboard
            </button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}>
          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              Totale annonser
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#111827" }}>
              {summary.total_ads}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              Aktive
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#10b981" }}>
              {summary.active_ads}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              Visninger
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              {summary.total_impressions.toLocaleString("no-NO")}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              Klikk
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              {summary.total_clicks.toLocaleString("no-NO")}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              CTR
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              {summary.ctr}%
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase" }}>
              Totalforbruk
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              {Number(summary.total_spent).toFixed(0)} kr
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          {/* Ads List */}
          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Dine annonser</h2>
            </div>
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {ads.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#667085" }}>
                  Ingen annonser
                </div>
              ) : (
                ads.map(ad => (
                  <div
                    key={ad.id}
                    onClick={() => selectAd(ad.id)}
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                      cursor: "pointer",
                      background: selectedAd === ad.id ? "#f0f7ff" : "transparent",
                      borderLeft: selectedAd === ad.id ? "4px solid #0066ff" : "4px solid transparent",
                    }}
                  >
                    <h3 style={{
                      margin: "0 0 0.5rem",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#111827",
                    }}>
                      {ad.title}
                    </h3>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.5rem",
                      fontSize: "0.75rem",
                      color: "#667085",
                    }}>
                      <div>📊 {ad.impressions.toLocaleString("no-NO")} visninger</div>
                      <div>🖱️ {ad.clicks.toLocaleString("no-NO")} klikk</div>
                      <div>💰 {Number(ad.spent).toFixed(0)} kr</div>
                      <div style={{
                        color: ad.status === "active" ? "#10b981" :
                          ad.status === "paused" ? "#f59e0b" : "#ef4444"
                      }}>
                        ● {ad.status}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail View */}
          {selectedAd && adDetails ? (
            <div style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
            }}>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.25rem", fontWeight: 700 }}>
                {adDetails.summary ? ads.find(a => a.id === selectedAd)?.title : "Detaljer"}
              </h2>

              {/* Key Metrics */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.5rem",
                padding: "1rem",
                background: "#f9fafb",
                borderRadius: "8px",
              }}>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085", fontWeight: 600 }}>
                    VISNINGER
                  </p>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>
                    {adDetails.summary.total_impressions.toLocaleString("no-NO")}
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085", fontWeight: 600 }}>
                    KLIKK
                  </p>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>
                    {adDetails.summary.total_clicks.toLocaleString("no-NO")}
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085", fontWeight: 600 }}>
                    CTR (Klikk-rate)
                  </p>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>
                    {adDetails.summary.ctr}%
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#667085", fontWeight: 600 }}>
                    CPC (Kostnad per klikk)
                  </p>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>
                    {adDetails.summary.cpc} kr
                  </p>
                </div>
              </div>

              {/* Total Spent */}
              <div style={{
                padding: "1rem",
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: "8px",
                marginBottom: "1.5rem",
              }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#92400e", fontWeight: 600 }}>
                  TOTAL FORBRUK
                </p>
                <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
                  {Number(adDetails.summary.total_spent).toFixed(2)} kr
                </p>
              </div>

              {/* Daily Table */}
              <div>
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem", fontWeight: 700 }}>Daglig statistikk</h3>
                <div style={{
                  background: "#f9fafb",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    background: "#f3f4f6",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    color: "#667085",
                    padding: "0.75rem",
                    borderBottom: "1px solid #e5e7eb",
                  }}>
                    <div>DATO</div>
                    <div>VISNINGER</div>
                    <div>KLIKK</div>
                    <div>FORBRUK</div>
                  </div>

                  {adDetails.daily.length === 0 ? (
                    <div style={{ padding: "1rem", textAlign: "center", color: "#667085" }}>
                      Ingen daglig data ennå
                    </div>
                  ) : (
                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                      {adDetails.daily.map((day, idx) => (
                        <div key={idx} style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr 1fr",
                          padding: "0.75rem",
                          borderBottom: "1px solid #e5e7eb",
                          fontSize: "0.875rem",
                        }}>
                          <div>{new Date(day.date).toLocaleDateString("no-NO")}</div>
                          <div>{day.impressions.toLocaleString("no-NO")}</div>
                          <div>{day.clicks.toLocaleString("no-NO")}</div>
                          <div>{Number(day.spent).toFixed(2)} kr</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p style={{
                marginTop: "1rem",
                fontSize: "0.75rem",
                color: "#9ca3af",
              }}>
                💾 Eksportfunksjonalitet kommer snart
              </p>
            </div>
          ) : (
            <div style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "2rem",
              textAlign: "center",
              color: "#667085",
            }}>
              Velg en annonse for å se detaljer
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
