"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdvertiserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await fetch("/api/advertisers/dashboard");
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/annonseportal/register");
          return;
        }
        throw new Error("Kunne ikke hente dashboard-data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredAds = data?.ads?.filter(ad => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return ad.status === "active";
    if (statusFilter === "pending") return ad.approval_status === "pending_approval";
    if (statusFilter === "rejected") return ad.status === "rejected";
    return true;
  }) || [];

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Laster...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!data) return <div style={{ padding: "2rem" }}>Ingen data</div>;

  const { advertiser, stats } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 800, color: "#111827" }}>
              {advertiser.company_name}
            </h1>
            <p style={{ margin: 0, color: "#667085" }}>
              Status: <strong>{advertiser.approval_status === "approved" ? "✓ Godkjent" : "⏳ Venter på godkjenning"}</strong>
            </p>
          </div>
          <Link href="/annonseportal/ny">
            <button style={{
              background: "#0066ff",
              color: "#fff",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}>
              + Ny annonse
            </button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}>
          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Aktive annonser</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#111827" }}>
              {stats.active_ads}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Totale visninger</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#111827" }}>
              {stats.total_all_impressions.toLocaleString("no-NO")}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Totale klikk</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#111827" }}>
              {stats.total_all_clicks.toLocaleString("no-NO")}
            </div>
          </div>

          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1.5rem",
          }}>
            <div style={{ color: "#667085", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Totalforbruk</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#111827" }}>
              {Number(stats.total_all_spent).toFixed(2)} kr
            </div>
          </div>
        </div>

        {/* Pending Approval Alert */}
        {stats.pending_approval > 0 && (
          <div style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "2rem",
            color: "#92400e",
          }}>
            ⏳ Du har <strong>{stats.pending_approval}</strong> {stats.pending_approval === 1 ? "annonse" : "annonser"} som venter på godkjenning
          </div>
        )}

        {/* Ads List */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>
              Mine annonser
            </h2>

            {/* Filters */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["all", "active", "pending", "rejected"].map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  style={{
                    padding: "0.5rem 1rem",
                    border: statusFilter === filter ? "2px solid #0066ff" : "1px solid #e5e7eb",
                    background: statusFilter === filter ? "#f0f7ff" : "#fff",
                    color: statusFilter === filter ? "#0066ff" : "#667085",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {filter === "all" && "Alle"}
                  {filter === "active" && "Aktive"}
                  {filter === "pending" && "Venter"}
                  {filter === "rejected" && "Avvist"}
                </button>
              ))}
            </div>
          </div>

          {filteredAds.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#667085" }}>
              Ingen annonser å vise
            </div>
          ) : (
            <div>
              {filteredAds.map(ad => (
                <div key={ad.id} style={{
                  padding: "1.5rem",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.5rem", color: "#111827", fontSize: "1.1rem" }}>
                      {ad.title}
                    </h3>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem", color: "#667085" }}>
                      <span>Status: <strong style={{
                        color: ad.status === "active" ? "#10b981" :
                          ad.status === "rejected" ? "#ef4444" :
                            ad.status === "paused" ? "#f59e0b" : "#6b7280"
                      }}>{ad.status}</strong></span>
                      <span>Godkjenning: <strong>{ad.approval_status}</strong></span>
                      <span>📊 Visninger: {ad.total_impressions} | Klikk: {ad.total_clicks}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link href={`/annonseportal/annonse/${ad.id}`}>
                      <button style={{
                        padding: "0.5rem 1rem",
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}>
                        Vis
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
