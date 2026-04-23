"use client";

// Tvinger siden til å være dynamisk rendret.
// Dette er nyttig når innholdet avhenger av ferske data fra API,
// slik at Next.js ikke prøver å cache siden statisk.
export const dynamic = "force-dynamic";

// Import av Image-komponenten fra Next.js for optimal bildevisning.
import Image from "next/image";

// useCallback brukes for å memoize funksjoner,
// så de ikke lages på nytt unødvendig ved hver render.
import { useCallback } from "react";

// Suspense brukes fordi useSearchParams i Next.js ofte må ligge inni Suspense.
import { Suspense } from "react";

// Henter query-parametere fra URL-en, som f.eks. ?search=fjell&type=fottur
import { useSearchParams } from "next/navigation";

// useEffect brukes for sideeffekter,
// og useState brukes for lokal state i komponentene.
import { useEffect, useState } from "react";

// useRouter brukes til navigasjon mellom sider i appen.
import { useRouter } from "next/navigation";

// CSS-modulen til explore-siden.
import styles from "./explore.module.css";

// Henter oversettelser fra appens språk-provider.
import { useTranslations } from "../components/LanguageProvider";


// Denne komponenten er "entry point" for siden.
// Den wrapper ExplorePage i Suspense slik at useSearchParams fungerer trygt.
export default function Page() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <ExplorePage />
    </Suspense>
  );
}


// Dette er hovedkomponenten for utforskingssiden.
// Her håndteres søk, filtre, henting av turer og rendering av turkortene.
function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("explorePage");

  // Liste over turer hentet fra API-et.
  const [trips, setTrips] = useState([]);

  // State for filtrene brukeren kan endre.
  const [search, setSearch] = useState("");
  const [type, setType] = useState("alle");
  const [difficulty, setDifficulty] = useState("alle");
  const [onlyTiu, setOnlyTiu] = useState(false);

  // Denne funksjonen henter turer fra backend basert på nåværende filtre.
  // useCallback gjør at funksjonen kun opprettes på nytt hvis avhengighetene endres.
  const fetchTrips = useCallback(async () => {
    try {
      // Lager query-parametere som sendes til API-ruta /api/trips
      const params = new URLSearchParams({
        search,
        type,
        difficulty,
        onlyTiu: onlyTiu ? "true" : "false",
      });

      // Kaller API-et med filtrene
      const res = await fetch(`/api/trips?${params.toString()}`);

      // Hvis API-kallet feiler, kastes en feil
      if (!res.ok) throw new Error(t.fetchError);

      // Leser responsen som JSON og lagrer turene i state
      const data = await res.json();
      setTrips(data);
    } catch (err) {
      // Logger feilen i konsollen for debugging
      console.error(err);

      // Ved feil setter vi tom liste, slik at UI ikke krasjer
      setTrips([]);
    }
  }, [difficulty, onlyTiu, search, t.fetchError, type]);

  // Henter turer hver gang fetchTrips endres,
  // altså når søk/filter-verdiene endres.
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Leser filtre fra URL-parametere når siden lastes eller URL-en endres.
  // Dette gjør at f.eks. /explore?type=fottur setter riktig filter i UI-et.
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setType(searchParams.get("type") || "alle");
    setDifficulty(searchParams.get("difficulty") || "alle");
    setOnlyTiu(searchParams.get("onlyTiu") === "true");
  }, [searchParams]);

  // Selve brukergrensesnittet for explore-siden.
  return (
    <main className={styles.container}>
      {/* Toppseksjon med overskrift og knapp for å opprette ny tur */}
      <section className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>{t.title}</h1>
          <p className={styles.subheading}>{t.subtitle}</p>
        </div>

        {/* Navigerer til siden for å opprette ny tur */}
        <button
          className={styles.createButton}
          onClick={() => router.push("/turrute/ny")}
          type="button"
        >
          + {t.createTrip}
        </button>
      </section>

      {/* Seksjon med filtre */}
      <section className={styles.filters}>
        {/* Søkeinput */}
        <input
          className={styles.search}
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Filter for turtype */}
        <select
          className={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="alle">{t.allTypes}</option>
          <option value="fottur">{t.hike}</option>
          <option value="skitur">{t.ski}</option>
          <option value="sykkel">{t.bike}</option>
        </select>

        {/* Filter for vanskelighetsgrad */}
        <select
          className={styles.select}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="alle">{t.difficulty}</option>
          <option value="lett">{t.easy}</option>
          <option value="middels">{t.medium}</option>
          <option value="krevende">{t.hard}</option>
        </select>

        {/* Checkbox som lar brukeren vise kun TiU-turer */}
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyTiu}
            onChange={(e) => setOnlyTiu(e.target.checked)}
          />
          {t.tiuOnly}
        </label>
      </section>

      {/* Seksjon som viser søkeresultatene */}
      <section className={styles.results}>
        <h2>{t.trips}</h2>

        <div className={styles.grid}>
          {trips.length > 0 ? (
            // Hvis vi har turer, rendres ett TripCard per tur
            trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onUpdated={fetchTrips} />
            ))
          ) : (
            // Hvis ingen turer finnes, vises tom-tekst
            <p>{t.noTrips}</p>
          )}
        </div>
      </section>
    </main>
  );
}


// Komponent for ett enkelt turkort i oversikten.
function TripCard({ trip, onUpdated }) {
  const router = useRouter();

  // Lokal state for handlinger som påmelding/interesse.
  // loading = om en handling pågår
  // message = suksessmelding
  // error = feilmelding
  const [actionState, setActionState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  // Brukeren kan melde seg bindende på hvis turen har en departure_id.
  const canRegisterBinding = Boolean(trip.departure_id);

  // Brukeren kan melde ikke-bindende interesse hvis:
  // - turen er en TiU-tur
  // - turen er fleksibel
  // - planstatus er "interest_open"
  const canExpressInterest =
    Boolean(trip.tiu_trip_id) &&
    trip.is_flexible === true &&
    trip.planning_status === "interest_open";

  // Handler for bindende påmelding.
  const handleRegister = async () => {
    // Hvis turen ikke har avgang, avslutt tidlig.
    if (!trip.departure_id) return;

    // Sett loading-state og nullstill tidligere meldinger.
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // Kaller API-ruta for bindende påmelding.
      const res = await fetch(`/api/departures/${trip.departure_id}/register`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      // Hvis responsen ikke er OK, kast feil
      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere bindende påmelding");
      }

      // Vis suksessmelding til brukeren
      setActionState({
        loading: false,
        message: data?.message || "Bindende påmelding registrert",
        error: "",
      });

      // Oppdater explore-listen etter vellykket handling,
      // slik at kortet får ferske data fra backend.
      if (onUpdated) {
        await onUpdated();
      }
    } catch (err) {
      // Vis feilmelding ved feil
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Handler for ikke-bindende interesse.
  const handleInterest = async () => {
    // Sett loading-state og nullstill tidligere meldinger.
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // Kaller API-ruta som registrerer interesse på turen.
      const res = await fetch(`/api/trips/${trip.id}/interest`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      // Hvis API-et svarer med feil, kast feilen
      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere interesse");
      }

      // Vis suksessmelding
      setActionState({
        loading: false,
        message: data?.message || "Ikke-bindende interesse registrert",
        error: "",
      });

      // Oppdater listen med turer etter vellykket interessepåmelding
      if (onUpdated) {
        await onUpdated();
      }
    } catch (err) {
      // Vis feilmelding ved feil
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Navigerer til detaljsiden for turen.
  const goToDetails = () => {
    router.push(`/explore/${trip.id}`);
  };

  // Velger hvilket bilde som skal vises på kortet.
  // Hvis turen har bilde_urls-array, brukes første bilde.
  // Hvis ikke, brukes enkel bilde_url.
  // Hvis ingen finnes, blir previewUrl null.
  const previewUrl = Array.isArray(trip.bilde_urls) && trip.bilde_urls.length > 0
    ? trip.bilde_urls[0]
    : trip.bilde_url || null;

  return (
    <article className={styles.card}>
      {/* Viser bilde hvis det finnes */}
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={trip.navn}
          className={styles.tripImage}
          width={480}
          height={320}
          unoptimized
        />
      ) : (
        // Hvis turen ikke har bilde, vis placeholder
        <div className={styles.imagePlaceholder} />
      )}

      <div className={styles.cardContent}>
        {/* Turens navn */}
        <h3>{trip.navn}</h3>

        {/* Turtype */}
        <p className={styles.location}>{trip.type}</p>

        {/* Kort metadata om lengde og vanskelighetsgrad */}
        <div className={styles.meta}>
          <span>{trip.lengde_km} km</span>
          <span>{trip.vanskelighetsgrad}</span>
        </div>

        {/* Viser TiU-badge hvis det er en TiU-tur */}
        {trip.tiu_trip_id && (
          <span className={styles.tiuBadge}>
            TiU
            {trip.turleder_navn ? ` • ${trip.turleder_navn}` : ""}
          </span>
        )}

        {/* Viser info om fleksibel tur hvis relevant */}
        {trip.is_flexible && (
          <p className={styles.departureInfo}>
            Fleksibel fellestur • {trip.date_options_count || 0} datoalternativer
          </p>
        )}

        {/* Viser planstatus hvis den finnes */}
        {trip.planning_status && (
          <p className={styles.departureInfo}>
            Planstatus: {trip.planning_status}
          </p>
        )}

        {/* Viser neste avgang hvis turen har en avgang */}
        {trip.departure_start_time && (
          <p className={styles.departureInfo}>
            Neste avgang:{" "}
            {new Date(trip.departure_start_time).toLocaleString("no-NO")}
          </p>
        )}

        {/* Viser status på avgangen hvis den finnes */}
        {trip.departure_status && (
          <p className={styles.departureInfo}>
            Status på avgang: {trip.departure_status}
          </p>
        )}

        {/* Viser suksessmelding etter handling */}
        {actionState.message && (
          <p className={styles.successMessage}>{actionState.message}</p>
        )}

        {/* Viser feilmelding etter handling */}
        {actionState.error && (
          <p className={styles.errorMessage}>{actionState.error}</p>
        )}

        {/* Handlingsknapper nederst på kortet */}
        <div className={styles.cardActions}>
          {/* Gå til detaljside */}
          <button
            className={styles.button}
            onClick={goToDetails}
            type="button"
          >
            Se detaljer
          </button>

          {/* Knapp for ikke-bindende interesse hvis tillatt */}
          {canExpressInterest && (
            <button
              className={styles.registerButton}
              onClick={handleInterest}
              disabled={actionState.loading}
              type="button"
            >
              {actionState.loading
                ? "Registrerer..."
                : "Meld ikke-bindende interesse"}
            </button>
          )}

          {/* Knapp for bindende påmelding hvis tillatt */}
          {canRegisterBinding && (
            <button
              className={styles.registerButton}
              onClick={handleRegister}
              disabled={actionState.loading}
              type="button"
            >
              {actionState.loading
                ? "Registrerer..."
                : "Meld meg bindende på"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}