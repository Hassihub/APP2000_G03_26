"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Reserver.module.css";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../lib/roles";
import CabinWeather from "./CabinWeather";

const AMENITY_OPTIONS = [
  "WiFi",
  "Badstue",
  "Parkering",
  "Kjøkken",
  "Peis",
  "Grill",
  "Kjæledyr tillatt",
  "Ski-in/ski-out",
];

export default function ReserverPage() {
  const [cabins, setCabins] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [staffedFilter, setStaffedFilter] = useState("all");
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  useEffect(() => {
    async function fetchCabins() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/cabins");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data?.error || "Kunne ikke hente hytter");

        setCabins(data.cabins || []);
      } catch (err) {
        setError(err?.message || "Ukjent feil");
      } finally {
        setLoading(false);
      }
    }

    fetchCabins();
  }, []);

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
          setUserId(null);
          return;
        }

        const data = await res.json().catch(() => ({}));
        setUserRole(data?.user?.role ?? null);
        setUserId(data?.user?.id ?? null);
      } catch {
        if (alive) {
          setUserRole(null);
          setUserId(null);
        }
      }
    }

    loadUser();
    return () => {
      alive = false;
    };
  }, []);

  function hasManageAccess(cabin) {
    if (!cabin || !userRole) return false;
    if (userRole === ROLE_ADMIN) return true;
    if (userRole === ROLE_UTLEIER) return cabin.owner_id === userId;
    return false;
  }

  function toggleAmenity(amenity) {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((item) => item !== amenity)
        : [...prev, amenity]
    );
  }

  const filteredCabins = useMemo(() => {
    const locationFilter = locationQuery.trim().toLowerCase();
    const selectedAmenityFilters = selectedAmenities.map((amenity) =>
      amenity.toLowerCase()
    );

    return cabins.filter((cabin) => {
      const price = Number(cabin.price_per_night);
      const capacity = Number(cabin.capacity);
      const isStaffed = Boolean(cabin.is_staffed);
      const amenities = Array.isArray(cabin.amenities)
        ? cabin.amenities.map((amenity) => String(amenity).toLowerCase())
        : [];

      if (
        String(maxPrice).trim() !== "" &&
        Number.isFinite(Number(maxPrice)) &&
        price > Number(maxPrice)
      ) {
        return false;
      }

      if (
        String(minCapacity).trim() !== "" &&
        Number.isFinite(Number(minCapacity)) &&
        capacity < Number(minCapacity)
      ) {
        return false;
      }

      if (locationFilter) {
        const locationText = String(cabin.location ?? "").toLowerCase();
        const nameText = String(cabin.name ?? "").toLowerCase();
        const descriptionText = String(cabin.description ?? "").toLowerCase();

        if (
          !locationText.includes(locationFilter) &&
          !nameText.includes(locationFilter) &&
          !descriptionText.includes(locationFilter)
        ) {
          return false;
        }
      }

      if (selectedAmenityFilters.length > 0) {
        const matchesAmenities = selectedAmenityFilters.every((selected) =>
          amenities.some((amenity) => amenity.includes(selected))
        );

        if (!matchesAmenities) return false;
      }

      if (staffedFilter === "staffed" && !isStaffed) return false;
      if (staffedFilter === "unstaffed" && isStaffed) return false;

      return true;
    });
  }, [cabins, locationQuery, maxPrice, minCapacity, selectedAmenities, staffedFilter]);

  const hasFilters =
    String(maxPrice).trim() !== "" ||
    String(minCapacity).trim() !== "" ||
    String(locationQuery).trim() !== "" ||
    staffedFilter !== "all" ||
    selectedAmenities.length > 0;

  return (
    <main className={styles.reservePageShell}>
      <section className={styles.reserveHero}>
        <Image
          src="/images/hytte.jpg"
          alt="Hytter i fjellandskap"
          fill
          priority
          className={styles.reserveHeroImage}
        />
        <div className={styles.reserveHeroOverlay} />

        <div className={styles.reserveHeroContent}>
          <p className={styles.reserveHeroKicker}>Fritt Fram</p>
          <h1 className={styles.reserveHeroTitle}>Reserver hytte</h1>
          <p className={styles.reserveHeroText}>Finn en base for neste tur.</p>
        </div>
      </section>

      <section className={styles.reserveContentSection}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.notice}>🏡 Velg hytte</div>

            {userRole && (
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <Link href="/reserver/foresporsler" className={styles.buttonSecondary}>
                  Overnattingsforespørsler
                </Link>
              </div>
            )}

            <div className={styles.cabinBrowseLayout}>
              <aside className={styles.filtersCard}>
                <div className={styles.filtersHeader}>
                  <div>
                    <h2 className={styles.filtersTitle}>Filtrer hytter</h2>
                    <p className={styles.filtersText}>
                      Filtrer på pris, kapasitet, lokasjon og viktige fasiliteter.
                    </p>
                  </div>

                  {hasFilters ? (
                    <button
                      type="button"
                      className={styles.filtersReset}
                      onClick={() => {
                        setMaxPrice("");
                        setMinCapacity("");
                        setLocationQuery("");
                        setStaffedFilter("all");
                        setSelectedAmenities([]);
                      }}
                    >
                      Nullstill filtre
                    </button>
                  ) : null}
                </div>

                <div className={styles.filtersGrid}>
                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>Sted / navn</span>
                    <input
                      className={styles.filterInput}
                      type="text"
                      placeholder="Søk i lokasjon eller navn"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                    />
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>Maks pris</span>
                    <input
                      className={styles.filterInput}
                      type="number"
                      min="0"
                      placeholder="f.eks. 2500"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>Min. antall personer</span>
                    <input
                      className={styles.filterInput}
                      type="number"
                      min="1"
                      placeholder="f.eks. 6"
                      value={minCapacity}
                      onChange={(e) => setMinCapacity(e.target.value)}
                    />
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>Type hytte</span>
                    <select
                      className={styles.filterInput}
                      value={staffedFilter}
                      onChange={(e) => setStaffedFilter(e.target.value)}
                    >
                      <option value="all">Alle</option>
                      <option value="staffed">Betjent</option>
                      <option value="unstaffed">Ubetjent</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginTop: 14 }}>
                  <details className={styles.amenityDropdown}>
                    <summary className={styles.amenityDropdownSummary}>
                      <span>Fasiliteter</span>
                      <span className={styles.amenityDropdownCount}>
                        {selectedAmenities.length > 0
                          ? `${selectedAmenities.length} valgt`
                          : "Velg"}
                      </span>
                    </summary>

                    <div className={styles.amenityDropdownPanel}>
                      {AMENITY_OPTIONS.map((amenity) => {
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
                  </details>
                </div>
              </aside>

              <div className={styles.resultsColumn}>
                <div className={styles.filterSummary}>
                  {loading
                    ? "Laster hytter..."
                    : cabins.length === 0
                      ? "Ingen hytter enda."
                      : filteredCabins.length === 0
                        ? "Ingen hytter matcher filtrene dine."
                        : `${filteredCabins.length} hytte${filteredCabins.length === 1 ? "" : "r"} funnet`}
                </div>

                {error ? <div className={styles.errorBox}>❌ {error}</div> : null}

                {(userRole === ROLE_UTLEIER || userRole === ROLE_ADMIN) && (
                  <div style={{ marginBottom: 12 }}>
                    <Link className={styles.button} href="/reserver/ny">
                      ➕ Legg til hytte
                    </Link>
                  </div>
                )}

                {loading ? (
                  <div className={styles.card}>
                    <div className={styles.cardContent}>
                      <div className={styles.empty}>Laster hytter...</div>
                    </div>
                  </div>
                ) : cabins.length === 0 ? (
                  <div className={styles.card}>
                    <div className={styles.cardContent}>
                      <div className={styles.empty}>Ingen hytter enda.</div>
                    </div>
                  </div>
                ) : filteredCabins.length === 0 ? (
                  <div className={styles.card}>
                    <div className={styles.cardContent}>
                      <div className={styles.empty}>
                        Ingen hytter matcher filtrene dine.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cabinGrid}>
                    {filteredCabins.map((cabin) => {
                      const previewImage = Array.isArray(cabin.image_urls) && cabin.image_urls.length > 0
                        ? cabin.image_urls[0]
                        : null;

                      return (
                        <article key={cabin.id} className={styles.cabinTile}>
                          <Link
                            href={`/reserver/booking?cabinId=${encodeURIComponent(cabin.id)}`}
                            className={styles.cabinLink}
                          >
                            <div className={styles.tileImageWrap}>
                              {previewImage ? (
                                <Image
                                  src={previewImage}
                                  alt={`Forsidebilde av ${cabin.name}`}
                                  className={styles.tileImage}
                                  width={640}
                                  height={480}
                                />
                              ) : (
                                <div className={styles.tileImageFallback}>
                                  Ingen bilde
                                </div>
                              )}
                            </div>

                            <div className={styles.tileBody}>
                              <h3 className={styles.tileTitle}>{cabin.name}</h3>
                              <div className={styles.tileMeta}>
                                📍 {cabin.location} •{" "}
                                <CabinWeather location={cabin.location} /> • {cabin.is_staffed ? "Betjent" : "Ubetjent"}
                              </div>
                              <div className={styles.tileStats}>
                                <span>
                                  💰 {Number(cabin.price_per_night)} kr / natt
                                </span>
                                <span>👥 {Number(cabin.capacity)} personer</span>
                              </div>
                            </div>
                          </Link>

                          {hasManageAccess(cabin) && (
                            <div
                              className={styles.actionsRow}
                              style={{ padding: "0 12px 12px" }}
                            >
                              <Link
                                className={styles.buttonSecondary}
                                href={`/reserver/edit?cabinId=${encodeURIComponent(cabin.id)}`}
                              >
                                ✏️ Rediger
                              </Link>

                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Slette "${cabin.name}"? Dette kan ikke angres.`)) return;

                                  const res = await fetch(`/api/cabins/${cabin.id}`, {
                                    method: "DELETE",
                                    credentials: "include",
                                  });
                                  const json = await res.json().catch(() => ({}));

                                  if (!res.ok) {
                                    alert(json?.error || "Kunne ikke slette hytta.");
                                    return;
                                  }

                                  setCabins((prev) => prev.filter((c) => c.id !== cabin.id));
                                }}
                              >
                                🗑️ Slett
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}