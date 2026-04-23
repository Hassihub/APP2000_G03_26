"use client";

import TripImageCarousel from "./TripImageCarousel";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const [dateSelection, setDateSelection] = useState({
    dateOptionId: "",
    minParticipants: 1,
    maxParticipants: "",
    loading: false,
    error: "",
    message: "",
  });

  const [deleteState, setDeleteState] = useState({
    loading: false,
    error: "",
  });

  const [confirmState, setConfirmState] = useState({
    loading: false,
    error: "",
    message: "",
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

  useEffect(() => {
    if (!trip?.date_options?.length) return;

    const selectedOption = trip.date_options.find((option) => option.is_selected);
    const firstOption = selectedOption || trip.date_options[0];

    setDateSelection((prev) => ({
      ...prev,
      dateOptionId: firstOption?.id ? String(firstOption.id) : "",
    }));
  }, [trip?.date_options]);

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
      window.dispatchEvent(new Event("ff-notifications-updated"));
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const handleWithdrawBinding = async () => {
    if (!trip?.departure_id) return;

    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/departures/${trip.departure_id}/register`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke melde deg av turen");
      }

      setActionState({
        loading: false,
        message: data?.message || "Du er meldt av turen",
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

  const handleWithdrawInterest = async () => {
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const res = await fetch(`/api/trips/${trip.id}/interest`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke trekke interesse");
      }

      setActionState({
        loading: false,
        message: data?.message || "Interessen er trukket",
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

  const handleSelectDate = async () => {
    if (!trip?.id || !dateSelection.dateOptionId) return;

    setDateSelection((prev) => ({
      ...prev,
      loading: true,
      error: "",
      message: "",
    }));

    try {
      const res = await fetch(`/api/trips/${trip.id}/select-date`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateOptionId: Number(dateSelection.dateOptionId),
          min_participants: Number(dateSelection.minParticipants || 1),
          max_participants:
            dateSelection.maxParticipants === ""
              ? null
              : Number(dateSelection.maxParticipants),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke velge dato");
      }

      setDateSelection((prev) => ({
        ...prev,
        loading: false,
        error: "",
        message: data?.message || "Dato valgt og bindende påmelding åpnet",
      }));

      await fetchTrip();
      window.dispatchEvent(new Event("ff-notifications-updated"));
    } catch (err) {
      setDateSelection((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Noe gikk galt",
        message: "",
      }));
    }
  };

  const handleConfirmDeparture = async () => {
    if (!trip?.departure_id) return;

    setConfirmState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      const res = await fetch(`/api/departures/${trip.departure_id}/confirm`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke bekrefte turen");
      }

      setConfirmState({
        loading: false,
        error: "",
        message: data?.message || "Turen er bekreftet",
      });

      await fetchTrip();
    } catch (err) {
      setConfirmState({
        loading: false,
        error: err.message || "Noe gikk galt",
        message: "",
      });
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip?.id) return;

    const confirmed = window.confirm(
      `Er du sikker på at du vil slette turen "${trip.navn}"? Dette kan ikke angres.`
    );

    if (!confirmed) return;

    setDeleteState({
      loading: true,
      error: "",
    });

    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke slette tur");
      }

      router.push("/explore");
    } catch (err) {
      setDeleteState({
        loading: false,
        error: err.message || "Noe gikk galt",
      });
    }
  };

  const goToGroup = () => {
    if (!trip?.id) return;
    router.push(`/explore/${trip.id}/group`);
  };

  const canRegisterBinding =
    Boolean(trip?.departure_id) && trip?.is_binding_registered !== true;

  const canExpressInterest =
    Boolean(trip?.tiu_trip_id) &&
    trip?.is_flexible === true &&
    trip?.planning_status === "interest_open" &&
    trip?.is_interested !== true &&
    trip?.is_binding_registered !== true;

  const canShowGroupButton = trip?.can_open_group === true;

  const canSelectDate =
    trip?.is_trip_admin === true &&
    Array.isArray(trip?.date_options) &&
    trip.date_options.length > 0 &&
    !trip?.departure_id;

  const canDeleteTrip = trip?.is_trip_admin === true;
  const canConfirmDeparture = trip?.can_confirm_departure === true;

  const selectedDateLabel = useMemo(() => {
    if (!trip?.date_options?.length) return null;
    const selected = trip.date_options.find((option) => option.is_selected);
    if (!selected) return null;

    return `${new Date(selected.start_time).toLocaleString("no-NO")} – ${new Date(
      selected.end_time
    ).toLocaleString("no-NO")}`;
  }, [trip?.date_options]);

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

              <ul className={styles.optionList}>
                {trip.date_options.map((option) => (
                  <li key={option.id} className={styles.optionItem}>
                    {new Date(option.start_time).toLocaleString("no-NO")} –{" "}
                    {new Date(option.end_time).toLocaleString("no-NO")}
                    {option.is_selected ? " (valgt dato)" : ""}
                  </li>
                ))}
              </ul>

              <p>
                <strong>Antall interesserte:</strong> {trip.interested_count ?? 0}
              </p>

              {selectedDateLabel && (
                <p className={styles.selectedDateInfo}>
                  <strong>Valgt dato:</strong> {selectedDateLabel}
                </p>
              )}

              {canSelectDate && (
                <div className={styles.adminPanel}>
                  <h3>Velg endelig dato</h3>

                  <label className={styles.field}>
                    <span>Datoalternativ</span>
                    <select
                      className={styles.select}
                      value={dateSelection.dateOptionId}
                      onChange={(e) =>
                        setDateSelection((prev) => ({
                          ...prev,
                          dateOptionId: e.target.value,
                        }))
                      }
                    >
                      {trip.date_options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {new Date(option.start_time).toLocaleString("no-NO")} –{" "}
                          {new Date(option.end_time).toLocaleString("no-NO")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className={styles.inlineFields}>
                    <label className={styles.field}>
                      <span>Min deltakere</span>
                      <input
                        className={styles.input}
                        type="number"
                        min="1"
                        value={dateSelection.minParticipants}
                        onChange={(e) =>
                          setDateSelection((prev) => ({
                            ...prev,
                            minParticipants: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Maks deltakere</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={dateSelection.minParticipants || 1}
                        value={dateSelection.maxParticipants}
                        onChange={(e) =>
                          setDateSelection((prev) => ({
                            ...prev,
                            maxParticipants: e.target.value,
                          }))
                        }
                        placeholder="Valgfritt"
                      />
                    </label>
                  </div>

                  {dateSelection.message && (
                    <p className={styles.successMessage}>{dateSelection.message}</p>
                  )}

                  {dateSelection.error && (
                    <p className={styles.errorMessage}>{dateSelection.error}</p>
                  )}

                  <button
                    className={styles.registerButton}
                    onClick={handleSelectDate}
                    disabled={dateSelection.loading || !dateSelection.dateOptionId}
                    type="button"
                  >
                    {dateSelection.loading
                      ? "Velger dato..."
                      : "Velg dato og åpne bindende påmelding"}
                  </button>
                </div>
              )}
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
                <p>
                  <strong>Bindende påmeldte:</strong> {trip.binding_count ?? 0} /{" "}
                  {trip.min_participants ?? 0} minimum
                </p>
              </>
            ) : (
              <p>Ingen planlagt avgang enda.</p>
            )}
          </section>

          {trip.is_trip_admin && trip.binding_registrations?.length > 0 && (
            <section className={styles.section}>
              <h2>Bindende påmeldte</h2>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {trip.binding_registrations.map((person) => (
                  <li key={person.id} style={{ marginBottom: 10 }}>
                    <strong>{person.username}</strong>
                    <div style={{ color: "#374151" }}>{person.email}</div>
                    <div style={{ fontSize: "0.9rem", color: "#6b7280", marginTop: 2 }}>
                      Meldte seg på: {new Date(person.registered_at).toLocaleString("no-NO")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {confirmState.message && (
            <p className={styles.successMessage}>{confirmState.message}</p>
          )}

          {confirmState.error && (
            <p className={styles.errorMessage}>{confirmState.error}</p>
          )}

          {actionState.message && (
            <p className={styles.successMessage}>{actionState.message}</p>
          )}

          {actionState.error && (
            <p className={styles.errorMessage}>{actionState.error}</p>
          )}

          {deleteState.error && (
            <p className={styles.errorMessage}>{deleteState.error}</p>
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

            {trip?.can_withdraw_interest && (
              <button
                className={styles.secondaryButton}
                onClick={handleWithdrawInterest}
                disabled={actionState.loading}
                type="button"
              >
                {actionState.loading ? "Behandler..." : "Trekk interesse"}
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

            {trip?.can_withdraw_binding && (
              <button
                className={styles.secondaryButton}
                onClick={handleWithdrawBinding}
                disabled={actionState.loading}
                type="button"
              >
                {actionState.loading ? "Behandler..." : "Meld meg av"}
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

            {canConfirmDeparture && (
              <button
                className={styles.confirmButton}
                onClick={handleConfirmDeparture}
                disabled={confirmState.loading}
                type="button"
              >
                {confirmState.loading ? "Bekrefter..." : "Bekreft tur"}
              </button>
            )}

            {canDeleteTrip && (
              <button
                className={styles.deleteButton}
                onClick={handleDeleteTrip}
                disabled={deleteState.loading}
                type="button"
              >
                {deleteState.loading ? "Sletter..." : "Slett tur"}
              </button>
            )}

            {!canExpressInterest &&
              !trip?.can_withdraw_interest &&
              !canRegisterBinding &&
              !trip?.can_withdraw_binding &&
              !canShowGroupButton &&
              !canConfirmDeparture &&
              !canDeleteTrip && (
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