"use client";

// Denne siden kjører som en client component i Next.js.
// Det betyr at hooks som useState, useEffect, useRouter og useParams kan brukes.

// Denne siden viser detaljene for én spesifikk tur.
// Her kan brukeren:
// - se bilder, kart og vær
// - melde interesse
// - melde seg bindende på
// - trekke interesse eller melde seg av
// - åpne turgruppe
// - velge dato hvis brukeren er turleder/admin
// - bekrefte tur hvis den er klar
// - slette tur hvis brukeren har tilgang

// Komponent som viser en karusell med bilder for turen.
import TripImageCarousel from "./TripImageCarousel";

// React-hooks:
// useState for lokal state
// useEffect for sideeffekter
// useCallback for memoiserte funksjoner
// useMemo for utregnet verdi som bare oppdateres når avhengigheter endres
import { useCallback, useEffect, useMemo, useState } from "react";

// Next.js hooks for å lese URL-parametere og navigere mellom sider.
import { useParams, useRouter } from "next/navigation";

// CSS-modulen for detaljsiden.
import styles from "./tripDetails.module.css";

// Komponent som viser værdata for et sted.
import CabinWeather from "../../reserver/CabinWeather";

// Komponent som viser kart/rute for turen.
import TripMap from "./TripMap";


// Hovedkomponenten for turdetaljsiden.
export default function TripDetailsPage() {
  // Henter route-parametere fra URL-en, f.eks. /explore/12 -> id = 12
  const params = useParams();

  // Router brukes for navigasjon til andre sider.
  const router = useRouter();

  // State for selve turdataene som hentes fra backend.
  const [trip, setTrip] = useState(null);

  // State for om siden holder på å laste.
  const [loading, setLoading] = useState(true);

  // State for eventuell feil som oppstår når turen hentes.
  const [error, setError] = useState("");

  // State som brukes for handlinger som:
  // - ikke-bindende interesse
  // - bindende påmelding
  // - trekke interesse
  // - melde seg av
  const [actionState, setActionState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  // State for admin/turleder når endelig dato velges.
  // Inneholder:
  // - hvilket datoalternativ som er valgt
  // - minimum antall deltakere
  // - maksimum antall deltakere
  // - loading / error / message
  const [dateSelection, setDateSelection] = useState({
    dateOptionId: "",
    minParticipants: 1,
    maxParticipants: "",
    loading: false,
    error: "",
    message: "",
  });

  // State for sletting av tur.
  const [deleteState, setDeleteState] = useState({
    loading: false,
    error: "",
  });

  // State for bekreftelse av tur/avgang.
  const [confirmState, setConfirmState] = useState({
    loading: false,
    error: "",
    message: "",
  });

  // Denne funksjonen henter detaljdata om turen fra backend.
  // useCallback brukes for å unngå at funksjonen opprettes på nytt
  // for hver render med mindre params.id endres.
  const fetchTrip = useCallback(async () => {
    try {
      // Starter laste-state og nullstiller tidligere feil.
      setLoading(true);
      setError("");

      // Henter turdata fra API.
      const res = await fetch(`/api/trips/${params.id}`, {
        credentials: "include",
      });

      // Leser responsen som JSON.
      const data = await res.json();

      // Hvis API-et ikke returnerte OK, kastes en feil.
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Kunne ikke hente tur");
      }

      // Lagrer turdata i state.
      setTrip(data);
    } catch (err) {
      // Lagrer feilmelding hvis noe går galt.
      setError(err.message || "Noe gikk galt");
    } finally {
      // Slår av laste-state uansett om det gikk bra eller ikke.
      setLoading(false);
    }
  }, [params?.id]);

  // Henter turen når komponenten lastes første gang,
  // og hver gang params.id endres.
  useEffect(() => {
    if (params?.id) {
      fetchTrip();
    }
  }, [params?.id, fetchTrip]);

  // Setter standard valgt dato i admin-panelet når trip.date_options er lastet.
  // Hvis en dato allerede er markert som valgt, brukes den.
  // Hvis ikke brukes første datoalternativ.
  useEffect(() => {
    if (!trip?.date_options?.length) return;

    const selectedOption = trip.date_options.find((option) => option.is_selected);
    const firstOption = selectedOption || trip.date_options[0];

    setDateSelection((prev) => ({
      ...prev,
      dateOptionId: firstOption?.id ? String(firstOption.id) : "",
    }));
  }, [trip?.date_options]);

  // Håndterer bindende påmelding til turen.
  const handleRegister = async () => {
    // Hvis turen ikke har en departure_id, finnes det ingen aktiv avgang å melde seg på.
    if (!trip?.departure_id) return;

    // Setter loading og nullstiller gamle meldinger.
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // Kaller API for bindende påmelding.
      const res = await fetch(`/api/departures/${trip.departure_id}/register`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      // Ved feil fra backend kastes feilen.
      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke registrere bindende påmelding");
      }

      // Viser suksessmelding.
      setActionState({
        loading: false,
        message: data?.message || "Bindende påmelding registrert",
        error: "",
      });

      // Henter oppdatert turdata fra backend.
      await fetchTrip();

      // Varsler resten av appen om at notifications bør oppdateres.
      // Dette brukes blant annet av bjella i headeren.
      window.dispatchEvent(new Event("ff-notifications-updated"));
    } catch (err) {
      // Viser feilmelding hvis noe gikk galt.
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Håndterer avmelding fra bindende påmelding.
  const handleWithdrawBinding = async () => {
    if (!trip?.departure_id) return;

    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // DELETE brukes for å melde brukeren av turen.
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

      // Oppdaterer turdata etter avmelding.
      await fetchTrip();
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Håndterer registrering av ikke-bindende interesse.
  const handleInterest = async () => {
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // Kaller API-ruta for interesse.
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

      // Oppdaterer turdata etter vellykket registrering.
      await fetchTrip();
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Håndterer trekking av ikke-bindende interesse.
  const handleWithdrawInterest = async () => {
    setActionState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // DELETE brukes for å trekke interesse.
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

      // Oppdaterer turdata etter endringen.
      await fetchTrip();
    } catch (err) {
      setActionState({
        loading: false,
        message: "",
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Håndterer valg av endelig dato for turen.
  // Dette brukes av turleder/admin.
  const handleSelectDate = async () => {
    // Hvis tur eller datoalternativ mangler, avslutt.
    if (!trip?.id || !dateSelection.dateOptionId) return;

    setDateSelection((prev) => ({
      ...prev,
      loading: true,
      error: "",
      message: "",
    }));

    try {
      // Sender valgt dato og min/maks deltakere til backend.
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

      // Oppdater siden med ny turstatus.
      await fetchTrip();

      // Oppdater bjellevarslinger.
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

  // Håndterer bekreftelse av turen når nok bindende påmeldinger er nådd.
  // Kun turleder/admin skal kunne bruke denne.
  const handleConfirmDeparture = async () => {
    if (!trip?.departure_id) return;

    setConfirmState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      // Kaller API-ruta som bekrefter turen.
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

      // Oppdaterer turdata etter bekreftelse.
      await fetchTrip();
    } catch (err) {
      setConfirmState({
        loading: false,
        error: err.message || "Noe gikk galt",
        message: "",
      });
    }
  };

  // Håndterer sletting av turen.
  // Brukeren må først bekrefte i en standard browser-confirm dialog.
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
      // Kaller DELETE på turens API-rute.
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke slette tur");
      }

      // Hvis sletting lykkes, send brukeren tilbake til explore.
      router.push("/explore");
    } catch (err) {
      setDeleteState({
        loading: false,
        error: err.message || "Noe gikk galt",
      });
    }
  };

  // Navigerer til turgruppa/chatten for denne turen.
  const goToGroup = () => {
    if (!trip?.id) return;
    router.push(`/explore/${trip.id}/group`);
  };

  // Bindende påmelding er mulig hvis turen har avgang
  // og brukeren ikke allerede er bindende registrert.
  const canRegisterBinding =
    Boolean(trip?.departure_id) && trip?.is_binding_registered !== true;

  // Ikke-bindende interesse kan vises hvis:
  // - turen er TiU-tur
  // - turen er fleksibel
  // - planstatus er interest_open
  // - brukeren ikke allerede er interessert
  // - brukeren ikke allerede er bindende påmeldt
  const canExpressInterest =
    Boolean(trip?.tiu_trip_id) &&
    trip?.is_flexible === true &&
    trip?.planning_status === "interest_open" &&
    trip?.is_interested !== true &&
    trip?.is_binding_registered !== true;

  // Om brukeren kan åpne gruppe/chat for turen.
  const canShowGroupButton = trip?.can_open_group === true;

  // Kun admin/turleder skal kunne velge endelig dato,
  // og bare hvis turen har datoalternativer og ingen avgang enda.
  const canSelectDate =
    trip?.is_trip_admin === true &&
    Array.isArray(trip?.date_options) &&
    trip.date_options.length > 0 &&
    !trip?.departure_id;

  // Kun admin/turleder kan slette tur.
  const canDeleteTrip = trip?.is_trip_admin === true;

  // Kun admin/turleder kan bekrefte tur hvis backend sier den er klar.
  const canConfirmDeparture = trip?.can_confirm_departure === true;

  // Lager en pen tekstversjon av valgt dato.
  const selectedDateLabel = useMemo(() => {
    if (!trip?.date_options?.length) return null;

    const selected = trip.date_options.find((option) => option.is_selected);
    if (!selected) return null;

    return `${new Date(selected.start_time).toLocaleString("no-NO")} – ${new Date(
      selected.end_time
    ).toLocaleString("no-NO")}`;
  }, [trip?.date_options]);

  // Hvis siden fortsatt laster, vis enkel laste-tekst.
  if (loading) {
    return (
      <main className={styles.container}>
        <p>Laster tur...</p>
      </main>
    );
  }

  // Hvis en feil oppstod, vis tilbakeknapp og feilmelding.
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

  // Hvis ingen tur ble funnet, vis fallback.
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

  // Selve UI-et for turdetaljsiden.
  return (
    <main className={styles.container}>
      {/* Tilbakeknapp til oversikten */}
      <button
        className={styles.backButton}
        onClick={() => router.push("/explore")}
        type="button"
      >
        ← Tilbake til turer
      </button>

      <article className={styles.detailsCard}>
        {/* Viser bilder hvis turen har det */}
        {Array.isArray(trip.bilde_urls) && trip.bilde_urls.length > 0 ? (
          <TripImageCarousel images={trip.bilde_urls} altBase={trip.navn} />
        ) : trip.bilde_url ? (
          <TripImageCarousel images={[trip.bilde_url]} altBase={trip.navn} />
        ) : (
          // Hvis ingen bilder finnes, vis placeholder
          <div className={styles.imagePlaceholder}>Ingen bilde</div>
        )}

        <div className={styles.content}>
          {/* Turens navn */}
          <h1 className={styles.title}>{trip.navn}</h1>

          {/* Badges med viktig metadata */}
          <div className={styles.metaRow}>
            <span className={styles.metaBadge}>{trip.type}</span>
            <span className={styles.metaBadge}>{trip.lengde_km} km</span>
            <span className={styles.metaBadge}>{trip.vanskelighetsgrad}</span>
            {trip.is_flexible && (
              <span className={styles.metaBadge}>Fleksibel fellestur</span>
            )}
          </div>

          {/* Kartseksjon hvis geometri finnes */}
          {trip.geometry && (
            <section className={styles.section}>
              <h2>Rute</h2>
              <TripMap geometry={trip.geometry} cabins={trip.cabins ?? []} />
            </section>
          )}

          {/* Beskrivelse og værseksjon */}
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

          {/* Seksjon som viser hvem som organiserer turen */}
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

          {/* Seksjon for datoalternativer */}
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

              {/* Viser valgt dato hvis en dato er markert */}
              {selectedDateLabel && (
                <p className={styles.selectedDateInfo}>
                  <strong>Valgt dato:</strong> {selectedDateLabel}
                </p>
              )}

              {/* Adminpanel for valg av dato */}
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

                  {/* Meldinger for dato-valg */}
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

          {/* Seksjon med info om aktiv avgang */}
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

          {/* Liste over bindende påmeldte hvis bruker er admin/turleder */}
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

          {/* Meldinger for bekreftelse */}
          {confirmState.message && (
            <p className={styles.successMessage}>{confirmState.message}</p>
          )}

          {confirmState.error && (
            <p className={styles.errorMessage}>{confirmState.error}</p>
          )}

          {/* Meldinger for påmelding/interesse */}
          {actionState.message && (
            <p className={styles.successMessage}>{actionState.message}</p>
          )}

          {actionState.error && (
            <p className={styles.errorMessage}>{actionState.error}</p>
          )}

          {/* Feil ved sletting */}
          {deleteState.error && (
            <p className={styles.errorMessage}>{deleteState.error}</p>
          )}

          {/* Handlingsknapper */}
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

            {/* Fallback-tekst hvis ingen handlinger er tilgjengelige */}
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