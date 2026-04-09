"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "../components/LanguageProvider";

const surfaceStyle = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid rgba(12, 62, 36, 0.1)",
  boxShadow: "0 18px 40px rgba(21, 53, 38, 0.08)",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<StatusMessage text="Laster sokesiden..." />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q")?.trim() || "";

  const [query, setQuery] = useState(queryFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState({ trips: [], cabins: [] });
  const t = useTranslations("searchPage");

  useEffect(() => {
    setQuery(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!queryFromUrl) {
        setResults({ trips: [], cabins: [] });
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [tripsResponse, cabinsResponse] = await Promise.all([
          fetch(`/api/trips?search=${encodeURIComponent(queryFromUrl)}`),
          fetch(`/api/cabins?search=${encodeURIComponent(queryFromUrl)}`),
        ]);

        const [tripsJson, cabinsJson] = await Promise.all([
          tripsResponse.json().catch(() => []),
          cabinsResponse.json().catch(() => ({})),
        ]);

        if (!tripsResponse.ok) {
          throw new Error(tripsJson?.error || t.loading);
        }

        if (!cabinsResponse.ok) {
          throw new Error(cabinsJson?.error || t.noHitsDescription);
        }

        if (cancelled) {
          return;
        }

        setResults({
          trips: Array.isArray(tripsJson) ? tripsJson : [],
          cabins: Array.isArray(cabinsJson?.cabins) ? cabinsJson.cabins : [],
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        setResults({ trips: [], cabins: [] });
        setError(err.message || t.noHitsDescription);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [queryFromUrl, t.loading, t.noHitsDescription]);

  const totalResults = results.trips.length + results.cabins.length;

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      router.push("/search");
      return;
    }

    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #edf6ef 0%, #f8faf8 55%, #ffffff 100%)",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <section
          style={{
            ...surfaceStyle,
            padding: "2rem",
            marginBottom: "1.5rem",
          }}
        >
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: "0.8rem",
              color: "#466555",
            }}
          >
              {t.eyebrow}
          </p>
            <h1 style={{ marginBottom: "0.5rem", color: "#163324" }}>{t.title}</h1>
          <p style={{ marginTop: 0, color: "#5a6f62", maxWidth: "700px" }}>
              {t.subtitle}
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.inputPlaceholder}
              style={{
                flex: "1 1 340px",
                minWidth: "260px",
                padding: "1rem 1.1rem",
                borderRadius: "14px",
                border: "1px solid #c8d9cd",
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "1rem 1.4rem",
                borderRadius: "14px",
                border: "none",
                background: "#214c34",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.submit}
            </button>
          </form>
        </section>

        {!queryFromUrl ? (
          <section style={{ ...surfaceStyle, padding: "1.5rem 2rem" }}>
            <h2 style={{ marginTop: 0, color: "#163324" }}>{t.suggestions}</h2>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {[
                "Gaustatoppen",
                "Trolltunga",
                "Hardangervidda",
                "Hytte",
                "Fottur",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(suggestion)}`)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "999px",
                    border: "1px solid #d7e4da",
                    background: "#f8fbf8",
                    color: "#214c34",
                    cursor: "pointer",
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <StatCard label={t.searchTerm} value={queryFromUrl} />
              <StatCard label={t.trips} value={String(results.trips.length)} />
              <StatCard label={t.cabins} value={String(results.cabins.length)} />
              <StatCard label={t.totalResults} value={String(totalResults)} />
            </section>

            {loading ? <StatusMessage text={t.loading} /> : null}
            {error ? <StatusMessage text={error} error /> : null}

            {!loading && !error && totalResults === 0 ? (
              <section style={{ ...surfaceStyle, padding: "2rem" }}>
                <h2 style={{ marginTop: 0, color: "#163324" }}>{t.noHitsTitle}</h2>
                <p style={{ marginBottom: 0, color: "#5a6f62" }}>
                  {t.noHitsDescription}
                </p>
              </section>
            ) : null}

            {results.trips.length > 0 ? (
              <ResultSection title={t.trips}>
                {results.trips.map((trip) => (
                  <article key={trip.id} style={{ ...surfaceStyle, padding: "1.25rem" }}>
                    <p style={{ margin: 0, color: "#597060", fontSize: "0.9rem" }}>
                      {trip.type} • {trip.vanskelighetsgrad}
                    </p>
                    <h3 style={{ margin: "0.4rem 0", color: "#163324" }}>{trip.navn}</h3>
                    <p style={{ color: "#50665a", minHeight: "3rem" }}>
                      {trip.beskrivelse || t.noDescription}
                    </p>
                    <p style={{ margin: "0 0 1rem", color: "#214c34", fontWeight: 600 }}>
                      {trip.lengde_km} km
                    </p>
                    <Link
                      href={`/explore?search=${encodeURIComponent(trip.navn)}`}
                      style={{ color: "#214c34", fontWeight: 700, textDecoration: "none" }}
                    >
                      {t.openExplore}
                    </Link>
                  </article>
                ))}
              </ResultSection>
            ) : null}

            {results.cabins.length > 0 ? (
              <ResultSection title={t.cabins}>
                {results.cabins.map((cabin) => (
                  <article key={cabin.id} style={{ ...surfaceStyle, padding: "1.25rem" }}>
                    <p style={{ margin: 0, color: "#597060", fontSize: "0.9rem" }}>{cabin.location}</p>
                    <h3 style={{ margin: "0.4rem 0", color: "#163324" }}>{cabin.name}</h3>
                    <p style={{ color: "#50665a", minHeight: "3rem" }}>
                      {cabin.description || t.noDescription}
                    </p>
                    <p style={{ margin: "0 0 0.4rem", color: "#214c34", fontWeight: 600 }}>
                      {cabin.price_per_night} kr/natt
                    </p>
                    <p style={{ margin: "0 0 1rem", color: "#597060" }}>{cabin.capacity} personer</p>
                    <Link
                      href={`/reserver?cabinId=${encodeURIComponent(cabin.id)}`}
                      style={{ color: "#214c34", fontWeight: 700, textDecoration: "none" }}
                    >
                      {t.openReserve}
                    </Link>
                  </article>
                ))}
              </ResultSection>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function ResultSection({ title, children }) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ color: "#163324" }}>{title}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ ...surfaceStyle, padding: "1rem 1.25rem" }}>
      <p style={{ margin: 0, color: "#5d7365", fontSize: "0.85rem", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "0.5rem 0 0", color: "#163324", fontSize: "1.4rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

function StatusMessage({ text, error = false }) {
  return (
    <section
      style={{
        ...surfaceStyle,
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        borderColor: error ? "#e3b4b4" : "rgba(12, 62, 36, 0.1)",
        color: error ? "#8a2f2f" : "#214c34",
      }}
    >
      {text}
    </section>
  );
}
