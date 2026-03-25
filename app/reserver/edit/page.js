"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Reserver.module.css";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../lib/roles";

const STANDARD_IMAGE_WIDTH = 1200;
const STANDARD_IMAGE_HEIGHT = 900;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error(`Kunne ikke lese bildet: ${file.name}`));
    };

    img.src = imageUrl;
  });
}

async function normalizeImageFile(file, index) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`Filen ${file.name} er ikke et bilde.`);
  }

  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = STANDARD_IMAGE_WIDTH;
  canvas.height = STANDARD_IMAGE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunne ikke klargjore bildebehandling.");

  const scale = Math.max(
    STANDARD_IMAGE_WIDTH / img.width,
    STANDARD_IMAGE_HEIGHT / img.height
  );
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const dx = (STANDARD_IMAGE_WIDTH - drawWidth) / 2;
  const dy = (STANDARD_IMAGE_HEIGHT - drawHeight) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, STANDARD_IMAGE_WIDTH, STANDARD_IMAGE_HEIGHT);
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

  if (!blob) throw new Error(`Kunne ikke konvertere bildet: ${file.name}`);

  const baseName =
    file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() ||
    "hyttebilde";

  return new File([blob], `${baseName}-${index + 1}.jpg`, {
    type: "image/jpeg",
  });
}

export default function EditCabinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cabinId = searchParams.get("cabinId");

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    price_per_night: "",
    capacity: "",
    amenities: "",
  });

  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [existingImageUrls, setExistingImageUrls] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!cabinId) return;

      setStatus({ type: "loading", message: "Laster hytte..." });

      const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (!alive) return;
        setStatus({ type: "error", message: json?.error || "Kunne ikke hente hytta." });
        return;
      }

      const c = json.cabin;

      if (!alive) return;
      setForm({
        name: c?.name ?? "",
        description: c?.description ?? "",
        location: c?.location ?? "",
        price_per_night: String(c?.price_per_night ?? ""),
        capacity: String(c?.capacity ?? ""),
        amenities: Array.isArray(c?.amenities) ? c.amenities.join(", ") : "",
      });
      setExistingImageUrls(Array.isArray(c?.image_urls) ? c.image_urls : []);

      setStatus({ type: "idle", message: "" });
    }

    load();
    return () => {
      alive = false;
    };
  }, [cabinId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleImageChange(e) {
    const files = Array.from(e.target.files || []).slice(0, 8);
    if (!files.length) {
      setNewImageFiles([]);
      return;
    }

    setIsProcessingImages(true);
    try {
      const normalizedFiles = await Promise.all(
        files.map((file, index) => normalizeImageFile(file, index))
      );
      setNewImageFiles(normalizedFiles);
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Kunne ikke tilpasse bilder.",
      });
      setNewImageFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsProcessingImages(false);
    }
  }

  function removeExistingImage(imageUrl) {
    setExistingImageUrls((prev) => prev.filter((url) => url !== imageUrl));
  }

  async function uploadImages(files) {
    if (!files.length) return [];

    const formData = new FormData();
    for (const file of files) {
      formData.append("images", file);
    }

    const res = await fetch("/api/cabins/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || "Kunne ikke laste opp bilder.");
    }

    return Array.isArray(json?.image_urls) ? json.image_urls : [];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cabinId) return;

    if (isProcessingImages) {
      setStatus({
        type: "error",
        message: "Venter pa at bildene blir ferdig tilpasset (1200x900).",
      });
      return;
    }

    setStatus({ type: "loading", message: "Lagrer..." });

    try {
      const uploadedImageUrls = await uploadImages(newImageFiles);
      const image_urls = [...existingImageUrls, ...uploadedImageUrls];

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
          : null,
        image_urls,
      };

      const res = await fetch(`/api/cabins/${encodeURIComponent(cabinId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({ type: "error", message: json?.error || "Kunne ikke lagre endringer." });
        return;
      }

      setStatus({ type: "success", message: "✅ Endringer lagret!" });
      setNewImageFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => router.push("/reserver"), 600);
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "Kunne ikke lagre endringer." });
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <p>Laster tilgang...</p>
      </div>
    );
  }

  if (!(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN)) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Ingen tilgang</h1>
        <p>Du må være utleier for å redigere hytter.</p>
        <Link href="/reserver" className={styles.button}>
          Tilbake til oversikt
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <main>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>✏️ Rediger hytte</div>

            {!cabinId ? (
              <div className={styles.errorBox}>❌ Mangler cabinId i URL.</div>
            ) : (
              <div className={styles.layout}>
                <div className={styles.listCard}>
                  <h3 className={styles.listTitle}>Navigasjon</h3>
                  <Link className={styles.buttonSecondary} href="/reserver">
                    ← Tilbake
                  </Link>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardContent}>
                    {status.type === "error" ? (
                      <div className={styles.errorBox}>❌ {status.message}</div>
                    ) : null}

                    {status.type === "success" ? (
                      <div className={styles.successBox}>{status.message}</div>
                    ) : null}

                    <form onSubmit={handleSubmit} className={styles.form}>
                      <div className={styles.field}>
                        <label className={styles.label}>Navn</label>
                        <input
                          className={styles.input}
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Beskrivelse</label>
                        <textarea
                          className={styles.textarea}
                          name="description"
                          value={form.description}
                          onChange={handleChange}
                          rows={3}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Lokasjon</label>
                        <input
                          className={styles.input}
                          name="location"
                          value={form.location}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className={styles.row2}>
                        <div className={styles.field}>
                          <label className={styles.label}>Pris per natt</label>
                          <input
                            className={styles.input}
                            name="price_per_night"
                            type="number"
                            value={form.price_per_night}
                            onChange={handleChange}
                            required
                            min="0"
                          />
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>Kapasitet</label>
                          <input
                            className={styles.input}
                            name="capacity"
                            type="number"
                            value={form.capacity}
                            onChange={handleChange}
                            required
                            min="1"
                          />
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Fasiliteter</label>
                        <input
                          className={styles.input}
                          name="amenities"
                          value={form.amenities}
                          onChange={handleChange}
                          placeholder="WiFi, Badstue, Peis"
                        />
                        <div className={styles.helper}>
                          Skriv kommaseparert. Tomt felt → lagres som NULL.
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Eksisterende bilder</label>
                        {existingImageUrls.length === 0 ? (
                          <div className={styles.helper}>Ingen bilder registrert.</div>
                        ) : (
                          <div className={styles.imageGrid}>
                            {existingImageUrls.map((url) => (
                              <div className={styles.imageCard} key={url}>
                                <Image
                                  src={url}
                                  alt="Hyttebilde"
                                  className={styles.cabinImage}
                                  width={640}
                                  height={480}
                                />
                                <button
                                  type="button"
                                  className={styles.imageRemoveButton}
                                  onClick={() => removeExistingImage(url)}
                                >
                                  Fjern
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Legg til nye bilder</label>
                        <input
                          ref={fileInputRef}
                          className={styles.input}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={handleImageChange}
                        />
                        <div className={styles.helper}>
                          Maks 8 bilder per opplasting. JPG, PNG eller WEBP.
                        </div>
                        <div className={styles.helper}>
                          Nye bilder tilpasses automatisk til 1200x900 (4:3).
                        </div>
                        {isProcessingImages ? (
                          <div className={styles.helper}>Tilpasser bilder...</div>
                        ) : null}
                        {newImageFiles.length > 0 ? (
                          <div className={styles.helper}>
                            Nye filer: {newImageFiles.length} bilde{newImageFiles.length > 1 ? "r" : ""}
                          </div>
                        ) : null}
                      </div>

                      <button
                        className={styles.button}
                        type="submit"
                        disabled={status.type === "loading" || isProcessingImages}
                      >
                        {status.type === "loading" ? "Lagrer..." : "Lagre endringer"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
