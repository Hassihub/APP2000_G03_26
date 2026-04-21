"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowRight, FiCompass, FiHome, FiMapPin, FiSearch } from "react-icons/fi";
import styles from "./page.module.css";

function ResultCard({ title, subtitle, meta, href, icon }) {
  const content = (
    <article className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {subtitle ? <p className={styles.cardSubtitle}>{subtitle}</p> : null}
        {meta ? <p className={styles.cardMeta}>{meta}</p> : null}
      </div>
      <FiArrowRight className={styles.cardArrow} />
    </article>
  );

  if (!href) return content;

  return (
    <Link href={href} className={styles.cardLink}>
      {content}
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className={styles.page}><section className={styles.content}><div className={styles.emptyState}><h2>Laster</h2><p>Henter søkesiden...</p></div></section></main>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState({ locations: [], cabins: [], trips: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmedQuery = initialQuery.trim();

    if (!trimmedQuery) {
      setResults({ locations: [], cabins: [], trips: [] });
      setError("");
      setLoading(false);
      return;
    }

    let alive = true;

    async function loadSearchResults() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        if (!res.ok) {
          throw new Error(data?.error || "Kunne ikke hente søkeresultater.");
        }

        setResults({
          locations: Array.isArray(data?.locations) ? data.locations : [],
          cabins: Array.isArray(data?.cabins) ? data.cabins : [],
          trips: Array.isArray(data?.trips) ? data.trips : [],
        });
      } catch (err) {
        if (alive) {
          setError(err?.message || "Kunne ikke hente søkeresultater.");
          setResults({ locations: [], cabins: [], trips: [] });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSearchResults();

    return () => {
      alive = false;
    };
  }, [initialQuery]);

  function handleSubmit(e) {
    e.preventDefault();
    const nextQuery = query.trim();

    if (!nextQuery) {
      router.push("/search");
      return;
    }

    router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
  }

  const hasResults =
    results.locations.length > 0 || results.cabins.length > 0 || results.trips.length > 0;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Søk</p>
          <h1 className={styles.title}>Finn steder, hytter og turer</h1>
          <p className={styles.description}>
            Søk i hele appen med samme søkefelt som toppmenyen bruker.
          </p>

          <form className={styles.searchForm} onSubmit={handleSubmit}>
            <FiSearch className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk etter sted, hytte eller tur"
            />
            <button className={styles.searchButton} type="submit">
              Søk
            </button>
          </form>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.toolbar}>
          <Link href="/" className={styles.toolbarLink}>
            <FiHome />
            Hjem
          </Link>
          <Link href="/explore" className={styles.toolbarLink}>
            <FiCompass />
            Utforsk turer
          </Link>
          <Link href="/reserver" className={styles.toolbarLink}>
            <FiMapPin />
            Hytter
          </Link>
        </div>

        {!initialQuery.trim() ? (
          <div className={styles.emptyState}>
            <h2>Skriv noe for å begynne</h2>
            <p>Bruk søkefeltet over for å finne steder, hytter og turer.</p>
          </div>
        ) : loading ? (
          <div className={styles.emptyState}>
            <h2>Laster treff</h2>
            <p>Henter resultater for &quot;{initialQuery}&quot;.</p>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>{error}</div>
        ) : hasResults ? (
          <div className={styles.grid}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Steder</h2>
                <span>{results.locations.length}</span>
              </div>
              <div className={styles.list}>
                {results.locations.length > 0 ? (
                  results.locations.map((location, index) => (
                    <ResultCard
                      key={`${location.name}-${index}`}
                      title={location.name}
                      subtitle={location.type ? `Type: ${location.type}` : "Geografisk treff"}
                      meta={
                        Number.isFinite(location.lat) && Number.isFinite(location.lon)
                          ? `Koordinater: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
                          : null
                      }
                      href={null}
                      icon={<FiMapPin />}
                    />
                  ))
                ) : (
                  <p className={styles.sectionEmpty}>Ingen stedstreff.</p>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Hytter</h2>
                <span>{results.cabins.length}</span>
              </div>
              <div className={styles.list}>
                {results.cabins.length > 0 ? (
                  results.cabins.map((cabin) => (
                    <ResultCard
                      key={cabin.id}
                      title={cabin.name}
                      subtitle={cabin.location || "Ukjent lokasjon"}
                      meta={
                        [
                          cabin.price_per_night ? `${Number(cabin.price_per_night)} kr/natt` : null,
                          cabin.capacity ? `${Number(cabin.capacity)} personer` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || null
                      }
                      href={`/reserver/booking?cabinId=${encodeURIComponent(cabin.id)}`}
                      icon={<FiHome />}
                    />
                  ))
                ) : (
                  <p className={styles.sectionEmpty}>Ingen hytteresultater.</p>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Turer</h2>
                <span>{results.trips.length}</span>
              </div>
              <div className={styles.list}>
                {results.trips.length > 0 ? (
                  results.trips.map((trip) => (
                    <ResultCard
                      key={trip.id}
                      title={trip.navn}
                      subtitle={trip.type || trip.vanskelighetsgrad || "Tur"}
                      meta={
                        [
                          trip.lengde_km ? `${trip.lengde_km} km` : null,
                          trip.vanskelighetsgrad ? trip.vanskelighetsgrad : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || null
                      }
                      href="/explore"
                      icon={<FiCompass />}
                    />
                  ))
                ) : (
                  <p className={styles.sectionEmpty}>Ingen turtreff.</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h2>Ingen treff</h2>
            <p>Prøv et annet navn, sted eller aktivitet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
