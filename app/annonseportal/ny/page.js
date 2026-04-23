"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PLACEMENTS = [
  { id: "right-sidebar", name: "Høyre sidebar", desc: "Vises på alle sider, synlig for alle besøkende" },
  { id: "left-sidebar", name: "Venstre sidebar", desc: "Fremtredende posisjon, høy klikk-rate" },
  { id: "top-banner", name: "Toppbanner", desc: "Første ting brukeren ser – maks synlighet" },
  { id: "mid-banner", name: "Midtside-banner", desc: "Vises mellom innhold, naturlig integrert" },
];

const PRICING_MODELS = [
  { id: "cpc", name: "Pay-Per-Click (PPC)", desc: "Du betaler kun for faktiske klikk på annonsen din" },
  { id: "cpm", name: "Pay-Per-Thousand Impressions (CPM)", desc: "Du betaler for hver 1000 visninger av annonsen" },
];

export default function NewAd() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    target_url: "",
    placement: "top-banner",
    pricing_model: "cpc",
    cost_per_click: "",
    cost_per_thousand_impressions: "",
    start_date: "",
    end_date: "",
    daily_budget: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch("/api/ads/categories");
      if (!res.ok) throw new Error("Kunne ikke hente kategorier");
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Kun JPEG, PNG eller WebP-bilder er tillatt");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Bildet kan ikke være større enn 5 MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 1) {
      if (!form.title || !form.description || !form.category_id || !form.target_url) {
        setError("Alle felt må fylles ut");
        return;
      }
      setStep(2);
      setError(null);
    } else if (step === 2) {
      if (!imageFile) {
        setError("Bilde er påkrevd");
        return;
      }
      setStep(3);
      setError(null);
    } else if (step === 3) {
      if (!form.placement) {
        setError("Velg en plassering");
        return;
      }
      setStep(4);
      setError(null);
    } else if (step === 4) {
      if (!form.pricing_model || !form.start_date || !form.end_date || !form.daily_budget) {
        setError("Alle felt må fylles ut");
        return;
      }
      if (form.pricing_model === "cpc" && !form.cost_per_click) {
        setError("Cost per click er påkrevd");
        return;
      }
      if (form.pricing_model === "cpm" && !form.cost_per_thousand_impressions) {
        setError("Cost per 1000 impressions er påkrevd");
        return;
      }
      setStep(5);
      setError(null);
    } else if (step === 5) {
      await submitAd();
    }
  }

  async function submitAd() {
    try {
      setSubmitting(true);
      setError(null);

      // First, upload image
      let imageUrl = null;
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await fetch("/api/simple-file-upload/public-key", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.path || URL.createObjectURL(imageFile);
        }
      }

      // Create ad
      const adRes = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category_id: parseInt(form.category_id),
          daily_budget: parseFloat(form.daily_budget),
          cost_per_click: form.cost_per_click ? parseFloat(form.cost_per_click) : null,
          cost_per_thousand_impressions: form.cost_per_thousand_impressions ? parseFloat(form.cost_per_thousand_impressions) : null,
          image_url: imageUrl,
        }),
      });

      if (!adRes.ok) {
        const err = await adRes.json();
        throw new Error(err.error || "Kunne ikke opprette annonse");
      }

      router.push("/annonseportal/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Laster kategorier...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "2rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Progress */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                background: s <= step ? "#0066ff" : "#e5e7eb",
                color: s <= step ? "#fff" : "#9ca3af",
              }}>
                {s}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", color: "#667085", fontSize: "0.875rem" }}>
            Steg {step} av 5
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "2rem",
        }}>
          {error && (
            <div style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              padding: "1rem",
              borderRadius: "6px",
              marginBottom: "1.5rem",
            }}>
              ❌ {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Grunninfo</h2>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Annons-tittel *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  maxLength={255}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                  placeholder="F.eks. Premium Turjakke"
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Beskrivelse *</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                  placeholder="Beskriv annonsen din..."
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Kategori *</label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">Velg kategori</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Destinasjons-URL *</label>
                <input
                  type="url"
                  name="target_url"
                  value={form.target_url}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                  placeholder="https://eksempel.no"
                />
              </div>
            </div>
          )}

          {/* Step 2: Image Upload */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Last opp bilde</h2>
              <p style={{ color: "#667085", marginBottom: "1rem" }}>
                Velg et høykvalitets-bilde (JPEG, PNG eller WebP). Maksimal størrelse: 5 MB.
              </p>

              <div style={{
                border: "2px dashed #e5e7eb",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                cursor: "pointer",
              }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                  id="imageInput"
                />
                <label htmlFor="imageInput" style={{ cursor: "pointer" }}>
                  {imagePreview ? (
                    <div>
                      <img src={imagePreview} alt="Preview" style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        borderRadius: "6px",
                      }} />
                      <p style={{ marginTop: "1rem", color: "#0066ff", textDecoration: "underline" }}>
                        Klikk for å bytte bilde
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📸</div>
                      <p style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: 600 }}>
                        Klikk for å laste opp bilde
                      </p>
                      <p style={{ margin: 0, color: "#667085" }}>eller dra og slipp</p>
                    </div>
                  )}
                </label>
              </div>

              {imageFile && (
                <p style={{ marginTop: "1rem", color: "#10b981", fontSize: "0.875rem" }}>
                  ✓ {imageFile.name}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Placement */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Velg plassering</h2>

              <div style={{ display: "grid", gap: "1rem" }}>
                {PLACEMENTS.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setForm(prev => ({ ...prev, placement: p.id }))}
                    style={{
                      border: form.placement === p.id ? "2px solid #0066ff" : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "1.5rem",
                      cursor: "pointer",
                      background: form.placement === p.id ? "#f0f7ff" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <h3 style={{ margin: "0 0 0.5rem", fontWeight: 700 }}>{p.name}</h3>
                        <p style={{ margin: 0, color: "#667085", fontSize: "0.875rem" }}>{p.desc}</p>
                      </div>
                      <div style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: "2px solid " + (form.placement === p.id ? "#0066ff" : "#e5e7eb"),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {form.placement === p.id && (
                          <div style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            background: "#0066ff",
                          }} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Pricing & Budget */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Prissetting og budsjett</h2>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "1rem", fontWeight: 600 }}>Betalingsmodell *</label>
                <div style={{ display: "grid", gap: "1rem" }}>
                  {PRICING_MODELS.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setForm(prev => ({ ...prev, pricing_model: m.id }))}
                      style={{
                        border: form.pricing_model === m.id ? "2px solid #0066ff" : "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem",
                        cursor: "pointer",
                        background: form.pricing_model === m.id ? "#f0f7ff" : "#fff",
                      }}
                    >
                      <h4 style={{ margin: "0 0 0.25rem" }}>{m.name}</h4>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#667085" }}>{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {form.pricing_model === "cpc" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Kostnad per klikk (kr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="cost_per_click"
                    value={form.cost_per_click}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                    }}
                    placeholder="0.50"
                  />
                </div>
              )}

              {form.pricing_model === "cpm" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Kostnad per 1000 visninger (kr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="cost_per_thousand_impressions"
                    value={form.cost_per_thousand_impressions}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                    }}
                    placeholder="50.00"
                  />
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Daglig budsjett (kr) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  name="daily_budget"
                  value={form.daily_budget}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                  }}
                  placeholder="500"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Start-dato *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Slutt-dato *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div>
              <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Gjennomgang</h2>

              <div style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "1.5rem",
              }}>
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Tittel</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{form.title}</p>
                </div>

                {imagePreview && (
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Bilde</p>
                    <img src={imagePreview} alt="Preview" style={{
                      maxWidth: "200px",
                      borderRadius: "6px",
                    }} />
                  </div>
                )}

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Kategori</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {categories.find(c => c.id.toString() === form.category_id)?.name}
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Plassering</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {PLACEMENTS.find(p => p.id === form.placement)?.name}
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Periode</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {form.start_date} til {form.end_date}
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", color: "#667085", fontSize: "0.875rem" }}>Budsjett</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{form.daily_budget} kr/dag</p>
                </div>
              </div>

              <p style={{
                marginTop: "1.5rem",
                padding: "1rem",
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: "6px",
                color: "#92400e",
                fontSize: "0.875rem",
              }}>
                ℹ️ Annonsen vil sendes på godkjenning. Ansvarlig redaktør gjennomgår innholdet og bildet før publisering.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "2rem",
            paddingTop: "2rem",
            borderTop: "1px solid #e5e7eb",
          }}>
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: step === 1 ? "not-allowed" : "pointer",
                opacity: step === 1 ? 0.5 : 1,
                fontWeight: 600,
              }}
            >
              ← Forrige
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#0066ff",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {step === 5 ? (submitting ? "Sender..." : "Send til godkjenning") : "Neste →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
