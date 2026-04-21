"use client";

import TripImageCarousel from "./TripImageCarousel";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./tripDetails.module.css";
import CabinWeather from "../../reserver/CabinWeather";
import TripMap from "./TripMap";

export default function TripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionState, setActionState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const fetchTrip = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/trips/${params.id}`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke hente tur");
      }

      setTrip(data);
    } catch (err) {
      setError(err.message || "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    if (params?.id) {
      fetchTrip();
    }
  }, [params?.id, fetchTrip]);

  const handleRegister = async () => {
    if (!trip?.departure_id) return;

    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/departures/${trip.departure_id}/register`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere bindende påmelding");
      }

      setActionState({
        loading: false,
        message: data?.message || "Bindende påmelding registrert",
        error: "",
      });

      await fetchTrip();
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const handleInterest = async () => {
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/trips/${trip.id}/interest`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere interesse");
      }

      setActionState({
        loading: false,
        message: data?.message || "Ikke-bindende interesse registrert",
        error: "",
      });

      await fetchTrip();
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const goToGroup = () => {
    if (!trip?.id) return;
    router.push(`/explore/${trip.id}/group`);
  };

  const canRegisterBinding = Boolean(trip?.departure_id);
  const canExpressInterest =
    Boolean(trip?.tiu_trip_id) &&
    trip?.is_flexible === true &&
    trip?.planning_status === "interest_open";

  const canShowGroupButton = trip?.can_open_group === true;

  if (loading) {
    return (
      <main className={styles.container}>
        <p>Laster tur...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push("/explore")}
          type="button"
        >
          ← Tilbake
        </button>
        <p className={styles.error}>{error}</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className={styles.container}>
        <button
          className={styles.backButton}
          onClick={() => router.push("/explore")}
          type="button"
        >
          ← Tilbake
        </button>
        <p>Fant ikke turen.</p>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <button
        className={styles.backButton}
        onClick={() => router.push("/explore")}
        type="button"
      >
        ← Tilbake til turer
      </button>

      <article className={styles.detailsCard}>
        {Array.isArray(trip.bilde_urls) && trip.bilde_urls.length > 0 ? (
          <TripImageCarousel images={trip.bilde_urls} altBase={trip.navn} />
        ) : trip.bilde_url ? (
          <TripImageCarousel images={[trip.bilde_url]} altBase={trip.navn} />
        ) : (
          <div className={styles.imagePlaceholder}>Ingen bilde</div>
        )}

        <div className={styles.content}>
          <h1 className={styles.title}>{trip.navn}</h1>

          <div className={styles.metaRow}>
            <span className={styles.metaBadge}>{trip.type}</span>
            <span className={styles.metaBadge}>{trip.lengde_km} km</span>
            <span className={styles.metaBadge}>{trip.vanskelighetsgrad}</span>
            {trip.is_flexible && (
              <span className={styles.metaBadge}>Fleksibel fellestur</span>
            )}
          </div>

          {trip.geometry && (
            <section className={styles.section}>
              <h2>Rute</h2>
              <TripMap geometry={trip.geometry} />
            </section>
          )}

          <section className={styles.section}>
            <h2>Om turen</h2>
            <p>{trip.beskrivelse || "Ingen beskrivelse lagt til."}</p>

            <div style={{ marginTop: "1rem" }}>
              <strong style={{ fontSize: "0.85rem" }}>Vær ved turen:</strong>
              <div style={{ marginTop: "0.4rem" }}>
                <CabinWeather
                  location={trip.navn}
                  lat={trip.geometry?.coordinates?.[0]?.[1]}
                  lon={trip.geometry?.coordinates?.[0]?.[0]}
                />
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Organisering</h2>
            {trip.tiu_trip_id ? (
              <div>
                <p>
                  <strong>Organisert av:</strong> TiU
                </p>
                {trip.turleder_navn && (
                  <p>
                    <strong>Turleder:</strong> {trip.turleder_navn}
                  </p>
                )}
                {trip.planning_status && (
                  <p>
                    <strong>Planstatus:</strong> {trip.planning_status}
                  </p>
                )}
              </div>
            ) : (
              <p>Denne turen er ikke organisert av TiU.</p>
            )}
          </section>

          {trip.date_options?.length > 0 && (
            <section className={styles.section}>
              <h2>Datoalternativer</h2>
              <ul style={{ paddingLeft: 18 }}>
                {trip.date_options.map((option) => (
                  <li key={option.id} style={{ marginBottom: 8 }}>
                    {new Date(option.start_time).toLocaleString("no-NO")} –{" "}
                    {new Date(option.end_time).toLocaleString("no-NO")}
                    {option.is_selected ? " (valgt dato)" : ""}
                  </li>
                ))}
              </ul>
              <p>
                <strong>Antall interesserte:</strong> {trip.interested_count ?? 0}
              </p>
            </section>
          )}

          <section className={styles.section}>
            <h2>Avgang</h2>
            {trip.departure_start_time ? (
              <>
                <p>
                  <strong>Neste avgang:</strong>{" "}
                  {new Date(trip.departure_start_time).toLocaleString("no-NO")}
                </p>
                {trip.departure_status && (
                  <p>
                    <strong>Status:</strong> {trip.departure_status}
                  </p>
                )}
              </>
            ) : (
              <p>Ingen planlagt avgang enda.</p>
            )}
          </section>

          {actionState.message && (
            <p className={styles.successMessage}>{actionState.message}</p>
          )}

          {actionState.error && (
            <p className={styles.errorMessage}>{actionState.error}</p>
          )}

          <div className={styles.actions}>
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

            {canShowGroupButton && (
              <button
                className={styles.registerButton}
                onClick={goToGroup}
                type="button"
              >
                Åpne turgruppe
              </button>
            )}

            {!canExpressInterest && !canRegisterBinding && !canShowGroupButton && (
              <p className={styles.noDeparture}>
                Det finnes ingen aktiv avgang eller åpen interesserunde akkurat nå.
              </p>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}