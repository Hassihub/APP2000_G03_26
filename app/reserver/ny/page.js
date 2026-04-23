// Laget av Sigurd

"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SimpleFileUpload } from "simple-file-upload-react";
import styles from "../Reserver.module.css";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../lib/roles";
import {
  formatTranslation,
  useTranslations,
} from "../../components/LanguageProvider";
import { COMMON_AMENITIES } from "../amenities";

export default function NewCabinPage() {
  const t = useTranslations("newCabinPage");
  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    price_per_night: "",
    capacity: "",
    is_staffed: false,
    customAmenities: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  const [coords, setCoords] = useState(null); // { lat, lon }
  const [Leaflet, setLeaflet] = useState(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [status, setStatus] = useState({
    type: "idle", // idle | loading | success | error
    message: "",
  });
  const [imageUrls, setImageUrls] = useState([]);
  const [uploadPublicKey, setUploadPublicKey] = useState("");

  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Henter innlogget bruker for a sikre at bare utleier/admin kan opprette hytte.
  useEffect(() => {
    let alive = true;

    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setUserRole(null);
          return;
        }

        const data = await res.json().catch(() => ({}));
        setUserRole(data?.user?.role ?? null);
      } catch {
        if (alive) setUserRole(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadUser();
    return () => {
      alive = false;
    };
  }, []);

  // Henter public key brukt av filopplastingstjenesten.
  useEffect(() => {
    let alive = true;
    async function loadUploadPublicKey() {
      try {
        const res = await fetch("/api/simple-file-upload/public-key", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const data = await res.json().catch(() => ({}));
        const key = typeof data?.publicKey === "string" ? data.publicKey.trim() : "";
        if (alive) setUploadPublicKey(key);
      } catch {
        // nøkkel ikke tilgjengelig
      }
    }
    loadUploadPublicKey();
    return () => { alive = false; };
  }, []);

  function handleImageUploadChange(event) {
    const files = Array.isArray(event?.allFiles) ? event.allFiles : [];
    const newUrls = files
      .map((file) => file.cdnUrl)
      .filter((url) => url && !imageUrls.includes(url));
    if (newUrls.length === 0) return;
    setImageUrls((prev) => [...prev, ...newUrls]);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function toggleAmenity(amenity) {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((item) => item !== amenity)
        : [...prev, amenity],
    );
  }

  // Initialiserer kart og lar bruker velge koordinater ved a klikke i kartet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authLoading) return;
    if (!(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN)) return;

    // Vent til authLoading er ferdig – map-div-en finnes ikke i DOM før da
    if (authLoading) return;

    if (!Leaflet) {
      import("leaflet").then((L) => {
        import("leaflet/dist/leaflet.css");
        setLeaflet(L);
      });
      return;
    }

    if (mapRef.current) return;

    const mapContainer = document.getElementById("new-cabin-map");
    if (!mapContainer) return;

    const L = Leaflet;
    const map = L.map(mapContainer, {
      center: [63.2, 15],
      zoom: 5,
      minZoom: 4,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    import("../../components/map/maskLayer").then(({ addMaskLayer }) => {
      try {
        addMaskLayer(map, L);
      } catch (e) {
        console.error(
          "Kunne ikke legge til maske for Norge på nytt hytte-kart:",
          e,
        );
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
        markerRef.current = L.marker([lat, lng], { icon: cabinIcon }).addTo(
          map,
        );
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
  }, [Leaflet, authLoading]);

  // Bygger payload fra skjema og oppretter ny hytte via API.
  async function handleSubmit(e) {
    e.preventDefault();

    if (!coords) {
      setStatus({ type: "error", message: t.pinRequired });
      return;
    }

    setStatus({ type: "loading", message: t.saving });

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        location: form.location.trim(),
        price_per_night: Number(form.price_per_night),
        capacity: Number(form.capacity),
        is_staffed: Boolean(form.is_staffed),
        amenities: [
          ...selectedAmenities,
          ...form.customAmenities
            .split(",")
            .map((amenity) => amenity.trim())
            .filter(Boolean),
        ],
        latitude: coords?.lat ?? null,
        longitude: coords?.lon ?? null,
        image_urls: imageUrls,
      };

      const res = await fetch("/api/cabins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          type: "error",
          message: json?.error || t.saveError,
        });
        return;
      }

      setStatus({
        type: "success",
        message: formatTranslation(t.savedCabin, {
          name: json?.cabin?.name || payload.name,
        }),
      });

      // Reset skjema (valgfritt)
      setForm({
        name: "",
        description: "",
        location: "",
        price_per_night: "",
        capacity: "",
        is_staffed: false,
        customAmenities: "",
      });
      setSelectedAmenities([]);
      setCoords(null);
      setImageUrls([]);
      if (mapRef.current && markerRef.current) {
        mapRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || t.networkError,
      });
    }
  }

  if (authLoading) {
    return (
      <main className={styles.reservePageShell}>
        <section
          className={styles.reserveContentSection}
          style={{ marginTop: 0 }}
        >
          <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
            <p>Laster tilgang...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN)) {
    return (
      <main className={styles.reservePageShell}>
        <section
          className={styles.reserveContentSection}
          style={{ marginTop: 0 }}
        >
          <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
            <h1>Ingen tilgang</h1>
            <p>Du må være utleier for å opprette hytter.</p>
            <Link href="/reserver" className={styles.button}>
              Tilbake til oversikt
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.reservePageShell}>
      <section className={styles.reserveHero}>
        <Image
          src="/images/hytte.jpg"
          alt="Ny hytte"
          fill
          priority
          className={styles.reserveHeroImage}
        />
        <div className={styles.reserveHeroOverlay} />

        <div className={styles.reserveHeroContent}>
          <p className={styles.reserveHeroKicker}>Fritt Fram</p>
          <h1 className={styles.reserveHeroTitle}>Legg til ny hytte</h1>
          <p className={styles.reserveHeroText}>
            Opprett en ny hytte i samme visuelle uttrykk som resten av
            applikasjonen.
          </p>
        </div>
      </section>

      <section className={styles.reserveContentSection}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>
              {t.notice || "➕ Legg til ny hytte"}
              {t.noticeDetail ? ` (${t.noticeDetail})` : ""}
            </div>

            <div className={styles.layout}>
              {/* Venstre: info/kort */}
              <div className={styles.listCard}>
                <h3 className={styles.listTitle}>{t.tips || "Tips"}</h3>
                <div className={styles.meta} style={{ marginTop: 10 }}>
                  <div>
                    •{" "}
                    {t.facilityTip || (
                      <>
                        <b>Fasiliteter</b>: kryss av vanlige valg og legg
                        eventuelt til egne under
                      </>
                    )}
                  </div>
                  <div>
                    •{" "}
                    {t.priceTip || (
                      <>
                        <b>Pris</b> og <b>kapasitet</b> må være tall
                      </>
                    )}
                  </div>
                  <div>
                    •{" "}
                    {t.locationTip || (
                      <>
                        <b>Lokasjon</b> er f.eks: “Hemsedal, Norge”
                      </>
                    )}
                  </div>
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

                      <label className={styles.filterField}>
                        <span className={styles.filterLabel}>Type hytte</span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <input
                            name="is_staffed"
                            type="checkbox"
                            checked={Boolean(form.is_staffed)}
                            onChange={handleChange}
                          />
                          <span>
                            {form.is_staffed ? "Betjent" : "Ubetjent"}
                          </span>
                        </div>
                      </label>

                      <div className={styles.field}>
                        <label className={styles.label}>Fasiliteter</label>
                        <div className={styles.amenitySummary}>
                          {selectedAmenities.length
                            ? `${selectedAmenities.length} valgt`
                            : "Ingen valgt ennå"}
                        </div>
                        <div className={styles.amenityGrid}>
                          {COMMON_AMENITIES.map((amenity) => {
                            const checked = selectedAmenities.includes(amenity);

                            return (
                              <label
                                key={amenity}
                                className={`${styles.amenityChip} ${checked ? styles.amenityChipActive : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAmenity(amenity)}
                                />
                                <span>{amenity}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className={styles.helper}>
                          Velg det som passer best. Du kan også legge til egne
                          fasiliteter i feltet under.
                        </div>
                      </div>

                      <input
                        name="customAmenities"
                        placeholder={
                          t.customAmenitiesPlaceholder ||
                          "Andre fasiliteter, kommaseparert"
                        }
                        value={form.customAmenities}
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
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {t.mapHelp}
                        </div>
                        {coords ? (
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {formatTranslation(t.selectedPosition, {
                              lat: coords.lat.toFixed(5),
                              lon: coords.lon.toFixed(5),
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          Bilder (valgfritt)
                        </label>
                        {uploadPublicKey ? (
                          <SimpleFileUpload
                            publicKey={uploadPublicKey}
                            multiple={true}
                            maxFileSize={5 * 1024 * 1024}
                            onChange={handleImageUploadChange}
                          />
                        ) : (
                          <p className={styles.helper}>
                            Mangler nøkkel for Simple File Upload i miljøvariabler.
                          </p>
                        )}
                        {imageUrls.length > 0 ? (
                          <div className={styles.helper}>
                            Lastet opp: {imageUrls.length} bilde
                            {imageUrls.length > 1 ? "r" : ""}
                          </div>
                        ) : null}
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
      </section>
    </main>
  );
}
