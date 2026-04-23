"use client";

import { useState, useEffect } from "react";

export default function AdvertiserDashboard() {
  const [advertiser, setAdvertiser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [adForm, setAdForm] = useState({
    title: "",
    description: "",
    image_url: "",
    url: "",
    categories: [],
    keywords: [],
    pricing_model: "cpc",
    cost_per_click: "",
    cost_per_thousand_impressions: "",
    placement: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    fetchAdvertiser();
    fetchStats();
  }, [startDate, endDate]);

  const fetchAdvertiser = async () => {
    try {
      const response = await fetch("/api/advertisers");
      if (response.ok) {
        const data = await response.json();
        setAdvertiser(data);
      } else {
        setError("Kunne ikke hente annonsørprofil");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchStats = async () => {
    try {
      let url = "/api/advertisers/dashboard/stats";
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdChange = (e) => {
    const { name, value } = e.target;
    setAdForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (category) => {
    setAdForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleSubmitAd = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/advertisements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create ad");
      }

      alert("Annonse opprettet! Den avventer godkjenning fra redaktør.");
      setAdForm({
        title: "",
        description: "",
        image_url: "",
        url: "",
        categories: [],
        keywords: [],
        pricing_model: "cpc",
        cost_per_click: "",
        cost_per_thousand_impressions: "",
        placement: "",
        start_date: "",
        end_date: "",
      });
      setShowCreateForm(false);
      fetchStats();
    } catch (err) {
      alert("Feil: " + err.message);
    }
  };

  if (!advertiser || !stats) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        {error ? (
          <div style={{ color: "#991b1b" }}>{error}</div>
        ) : (
          "Laster..."
        )}
      </div>
    );
  }

  if (advertiser.status !== "approved") {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "2rem", textAlign: "center" }}>
          <h2 style={{ color: "#92400e", marginBottom: "1rem" }}>Annonsør under godkjenning</h2>
          <p style={{ color: "#92400e", lineHeight: 1.6 }}>
            Takk for at du registrerte deg! Din annonsørprofil er under vurdering av redaktør.
            Du vil motta en e-post når godkjenningen er gjennomført, vanligvis innen 2 arbeidsdager.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "2rem" }}>
        Annonsør Dashboard - {advertiser.company_name}
      </h1>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#2563eb" }}>
            {stats.summary.total_ads}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Aktive Annonser
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#059669" }}>
            {stats.summary.total_impressions.toLocaleString("no-NO")}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Totale Visninger
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#dc2626" }}>
            {stats.summary.total_clicks.toLocaleString("no-NO")}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Totale Klikk
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#7c3aed" }}>
            {stats.summary.ctr_percentage}%
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Click-Through Rate
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", marginBottom: "2rem", display: "flex", gap: "1rem", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600, fontSize: "0.9rem" }}>Fra:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "6px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600, fontSize: "0.9rem" }}>Til:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "6px" }}
          />
        </div>
        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          style={{ padding: "0.5rem 1rem", background: "#6b7280", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Nullstill
        </button>
      </div>

      {/* Create New Ad */}
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          {showCreateForm ? "Skjul skjema" : "+ Opprett ny annonse"}
        </button>

        {showCreateForm && (
          <form onSubmit={handleSubmitAd} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.5rem", marginTop: "1rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>Ny Annonse</h3>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Tittel *</label>
                <input
                  type="text"
                  name="title"
                  value={adForm.title}
                  onChange={handleAdChange}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  placeholder="Annonsens tittel"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Beskrivelse *</label>
                <textarea
                  name="description"
                  value={adForm.description}
                  onChange={handleAdChange}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", minHeight: "100px", boxSizing: "border-box", fontFamily: "inherit" }}
                  placeholder="Annonsens beskrivelse"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Bilde URL</label>
                <input
                  type="url"
                  name="image_url"
                  value={adForm.image_url}
                  onChange={handleAdChange}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  placeholder="https://eksempel.no/bilde.jpg"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Landing Page URL *</label>
                <input
                  type="url"
                  name="url"
                  value={adForm.url}
                  onChange={handleAdChange}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  placeholder="https://din-side.no"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Kategorier</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem" }}>
                  {["hiking_gear", "hiking_food", "cabin", "guides", "travel"].map((cat) => (
                    <label key={cat} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={adForm.categories.includes(cat)}
                        onChange={() => handleCategoryChange(cat)}
                      />
                      <span style={{ fontSize: "0.9rem" }}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Plasering *</label>
                  <select
                    name="placement"
                    value={adForm.placement}
                    onChange={handleAdChange}
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  >
                    <option value="">Velg plassering...</option>
                    <option value="right_sidebar">Høyre sidebar</option>
                    <option value="left_sidebar">Venstre sidebar</option>
                    <option value="top_banner">Toppbanner</option>
                    <option value="mid_page_banner">Midtsidebanner</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Betalingsmodell *</label>
                  <select
                    name="pricing_model"
                    value={adForm.pricing_model}
                    onChange={handleAdChange}
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  >
                    <option value="cpc">Pay-Per-Click (CPC)</option>
                    <option value="cpm">Cost-Per-Mille (CPM)</option>
                  </select>
                </div>
              </div>

              {adForm.pricing_model === "cpc" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Pris per klikk (kr) *</label>
                  <input
                    type="number"
                    name="cost_per_click"
                    value={adForm.cost_per_click}
                    onChange={handleAdChange}
                    step="0.01"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                    placeholder="5.00"
                  />
                </div>
              )}

              {adForm.pricing_model === "cpm" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Pris per 1000 visninger (kr) *</label>
                  <input
                    type="number"
                    name="cost_per_thousand_impressions"
                    value={adForm.cost_per_thousand_impressions}
                    onChange={handleAdChange}
                    step="0.01"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                    placeholder="50.00"
                  />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Startdato *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={adForm.start_date}
                    onChange={handleAdChange}
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Sluttdato *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={adForm.end_date}
                    onChange={handleAdChange}
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="submit"
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
                  Opprett Annonse
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "#6b7280",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Avbryt
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Ads List */}
      <div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1rem" }}>Dine Annonser</h2>
        {stats.ads && stats.ads.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {stats.ads.map((ad) => (
              <div key={ad.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
                      {ad.title}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", fontSize: "0.9rem", color: "#6b7280" }}>
                      <div>📊 Visninger: {ad.impressions?.toLocaleString("no-NO") || 0}</div>
                      <div>🖱️ Klikk: {ad.clicks?.toLocaleString("no-NO") || 0}</div>
                      <div>💵 Kostnad: {ad.cost?.toLocaleString("no-NO", { minimumFractionDigits: 2 }) || "0.00"} kr</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "2rem", textAlign: "center", color: "#166534" }}>
            Du har ingen annonser ennå. Opprett din første annonse!
          </div>
        )}
      </div>
    </div>
  );
}
