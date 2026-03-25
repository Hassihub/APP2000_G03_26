"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "../Reserver.module.css";
import { formatTranslation, useTranslations } from "../../components/LanguageProvider";

export default function NewCabinPage() {
  const t = useTranslations("newCabinPage");
  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    price_per_night: "",
    capacity: "",
    amenities: "",
  });

  const [coords, setCoords] = useState(null); // { lat, lon }
  const [Leaflet, setLeaflet] = useState(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [status, setStatus] = useState({
    type: "idle", // idle | loading | success | error
    message: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Sett opp lite kart hvor brukeren kan plassere pin for hyttens posisjon
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!Leaflet) {
      import("leaflet").then((L) => {
        import("leaflet/dist/leaflet.css");
        setLeaflet(L);
      });
      return;
    }

    if (mapRef.current) return;

    const L = Leaflet;
    const map = L.map("new-cabin-map", {
      center: [63.2, 15],
      zoom: 5,
      minZoom: 4,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // Legg til maske som skjuler alt utenfor Norge (samme som hovedkartet)
    import("../../components/map/maskLayer").then(({ addMaskLayer }) => {
      try {
        addMaskLayer(map, L);
      } catch (e) {
        console.error("Kunne ikke legge til maske for Norge på nytt hytte-kart:", e);
      }
    });

    const cabinIcon = L.icon({
      iconUrl: "/images/pinEnd.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setCoords({ lat, lon: lng });

      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { icon: cabinIcon }).addTo(map);

        // Klikk på pinnen fjerner den igjen og nullstiller koordinater
        markerRef.current.on("click", () => {
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
            markerRef.current = null;
            setCoords(null);
          }
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
    });

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [Leaflet]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!coords) {
      setStatus({ type: "error", message: t.pinRequired });
      return;
    }

    setStatus({ type: "loading", message: t.saving });

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      location: form.location.trim(),
      price_per_night: Number(form.price_per_night),
      capacity: Number(form.capacity),
      amenities: form.amenities
        ? form.amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
          latitude: coords?.lat ?? null,
          longitude: coords?.lon ?? null,
    };

    try {
      const res = await fetch("/api/cabins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          type: "error",
          message: json?.error || "Kunne ikke lagre hytta.",
          message: json?.error || t.saveError,
        });
        return;
      }

      setStatus({
        type: "success",
        message: formatTranslation(t.savedCabin, { name: json?.cabin?.name || payload.name }),
      });

      // Reset skjema (valgfritt)
      setForm({
        name: "",
        description: "",
        location: "",
        price_per_night: "",
        capacity: "",
        amenities: "",
      });
      setCoords(null);
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || t.networkError,
      });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Samme main-oppsett som Home */}
      <main style={{ padding: 0 }}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              {t.notice} ({t.noticeDetail})
            </div>

            <div className={styles.layout}>
              {/* Venstre: info/kort */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>Tips</h3>
                <h3 className={styles.listTitle}>{t.tips}</h3>
                <div className={styles.meta} style={{ marginTop: 10 }}>
                  <div>• {t.facilityTip}</div>
                  <div>• {t.priceTip}</div>
                  <div>• {t.locationTip}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link className={styles.button} href="/reserver">
                    ← {t.backOverview}
                  </Link>
                </div>
              </div>

              {/* Høyre: skjema */}
              <div className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.info}>
                    <h2 style={{ marginTop: 0 }}>{t.newCabin}</h2>

                    {status.type !== "idle" && status.message ? (
                      <div
                        style={{
                          marginBottom: 12,
                          fontWeight: 700,
                        }}
                      >
                        {status.type === "loading"
                          ? ""
                          : status.type === "success"
                          ? ""
                          : ""}
                        {status.message}
                      </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className={styles.list}>
                      <input
                        name="name"
                        placeholder={t.namePlaceholder}
                        value={form.name}
                        onChange={handleChange}
                        required
                      />

                      <textarea
                        name="description"
                        placeholder={t.descriptionPlaceholder}
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                      />

                      <input
                        name="location"
                        placeholder={t.locationPlaceholder}
                        value={form.location}
                        onChange={handleChange}
                        required
                      />

                      <input
                        name="price_per_night"
                        type="number"
                        placeholder={t.pricePlaceholder}
                        value={form.price_per_night}
                        onChange={handleChange}
                        required
                        min="0"
                      />

                      <input
                        name="capacity"
                        type="number"
                        placeholder={t.capacityPlaceholder}
                        value={form.capacity}
                        onChange={handleChange}
                        required
                        min="1"
                      />

                      <input
                        name="amenities"
                        placeholder={t.amenitiesPlaceholder}
                        value={form.amenities}
                        onChange={handleChange}
                      />

                      <div>
                        <div style={{ marginBottom: 4, fontWeight: 600 }}>
                          {t.mapLabel}
                        </div>
                        <div
                          id="new-cabin-map"
                          style={{
                            width: "100%",
                            height: "260px",
                            borderRadius: 12,
                            border: "1px solid #e6e6ef",
                            overflow: "hidden",
                          }}
                        />
                        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                          {t.mapHelp}
                        </div>
                        {coords && (
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {formatTranslation(t.selectedPosition, { lat: coords.lat.toFixed(5), lon: coords.lon.toFixed(5) })}
                          </div>
                        )}
                      </div>

                      <button
                        className={styles.button}
                        type="submit"
                        disabled={status.type === "loading"}
                      >
                        {status.type === "loading" ? t.saving : t.saveCabin}
                      </button>
                    </form>

                    <div style={{ marginTop: 12 }}>
                      <Link href="/reserver" className="topbar-item">
                        {t.overview}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              {/* slutt høyre */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
