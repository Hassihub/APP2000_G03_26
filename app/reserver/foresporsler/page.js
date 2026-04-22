"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  if (status === "approved") return "Godkjent";
  if (status === "rejected") return "Avslatt";
  return "Venter";
}

function statusClass(status) {
  if (status === "approved") return styles.approved;
  if (status === "rejected") return styles.rejected;
  return styles.pending;
}

function formatRequestedDates(start, end) {
  const startText = String(start || "").trim();
  const endText = String(end || "").trim();

  if (startText && endText) {
    return `${startText.slice(0, 10)} til ${endText.slice(0, 10)}`;
  }

  if (startText || endText) {
    return `${startText.slice(0, 10) || "?"} til ${endText.slice(0, 10) || "?"}`;
  }

  return "Fleksibel startdato - datoer velges ved godkjenning";
}

function formatDateOption(option) {
  const startText = String(option?.start_time || "").trim();
  const endText = String(option?.end_time || "").trim();

  if (!startText && !endText) return null;

  return `${startText.slice(0, 10)} – ${endText.slice(0, 10)}`;
}

export default function CabinStayRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [incomingReservations, setIncomingReservations] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [decisionLoadingId, setDecisionLoadingId] = useState(null);
  const [ownerResponseById, setOwnerResponseById] = useState({});
  const [approvalDatesById, setApprovalDatesById] = useState({});
  const [notice, setNotice] = useState({ type: "", message: "" });

  const pendingIncomingCount = useMemo(
    () => incoming.filter((item) => item.status === "pending").length,
    [incoming]
  );

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const [stayRes, reservationRes] = await Promise.all([
        fetch("/api/cabin-stay-requests", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/reservations?pending_for_owner=true", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const stayData = await stayRes.json().catch(() => ({}));
      if (!stayRes.ok) {
        throw new Error(stayData?.error || "Kunne ikke hente foresporsler.");
      }

      const reservationData = await reservationRes.json().catch(() => ({}));
      if (!reservationRes.ok) {
        throw new Error(reservationData?.error || "Kunne ikke hente bookingforesporsler.");
      }

      setIncoming(Array.isArray(stayData?.incoming) ? stayData.incoming : []);
      setOutgoing(Array.isArray(stayData?.outgoing) ? stayData.outgoing : []);
      setIncomingReservations(
        (Array.isArray(reservationData?.reservations) ? reservationData.reservations : []).map((item) => ({
          ...item,
          request_source: "reservation",
        }))
      );
    } catch (requestError) {
      setError(requestError?.message || "Kunne ikke hente foresporsler.");
      setIncoming([]);
      setIncomingReservations([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function decideRequest(requestId, decision) {
    if (!requestId) return;

    setDecisionLoadingId(requestId);
    setNotice({ type: "", message: "" });

    try {
      const ownerResponse = String(ownerResponseById[requestId] || "").trim();
      const approvalDates = approvalDatesById[requestId] || {};
      const requestedStart = String(approvalDates.requested_start || "").trim();
      const requestedEnd = String(approvalDates.requested_end || "").trim();

      const res = await fetch("/api/cabin-stay-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId,
          decision,
          ownerResponse: ownerResponse || null,
          requested_start: requestedStart || null,
          requested_end: requestedEnd || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.detail ? `${data.error}: ${data.detail}` : (data?.error || "Kunne ikke oppdatere foresporsel.");
        throw new Error(msg);
      }

      setNotice({
        type: "success",
        message: `Foresporsel ${decision === "approve" ? "godkjent" : "avslatt"}.`,
      });

      await loadRequests();
      setOwnerResponseById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setApprovalDatesById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });

      window.dispatchEvent(new CustomEvent("ff-notifications-updated"));
    } catch (decideError) {
      setNotice({
        type: "error",
        message: decideError?.message || "Kunne ikke oppdatere foresporsel.",
      });
    } finally {
      setDecisionLoadingId(null);
    }
  }

  async function decideReservation(reservationId, decision) {
    if (!reservationId) return;

    setDecisionLoadingId(`reservation-${reservationId}`);
    setNotice({ type: "", message: "" });

    try {
      const ownerResponse = String(ownerResponseById[`reservation-${reservationId}`] || "").trim();

      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reservationId,
          decision,
          ownerResponse: ownerResponse || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke oppdatere bookingforesporsel.");
      }

      setNotice({
        type: "success",
        message: `Bookingforesporsel ${decision === "approve" ? "godkjent" : "avslatt"}.`,
      });

      await loadRequests();
      setOwnerResponseById((prev) => {
        const next = { ...prev };
        delete next[`reservation-${reservationId}`];
        return next;
      });

      window.dispatchEvent(new CustomEvent("ff-notifications-updated"));
    } catch (decideError) {
      setNotice({
        type: "error",
        message: decideError?.message || "Kunne ikke oppdatere bookingforesporsel.",
      });
    } finally {
      setDecisionLoadingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Overnattingsforesporsler</p>
          <h1>Administrer overnattinger</h1>
          <p>Hytteeiere mottar og godkjenner foresporsler. Turledere ser statusen på sine foresporsler.</p>
        </section>

        {notice.message && (
          <div className={`${styles.notice} ${styles[`notice${notice.type.charAt(0).toUpperCase()}${notice.type.slice(1)}`]}`}>
            {notice.message}
          </div>
        )}

        {loading ? (
          <section className={styles.card}>
            <p>Laster foresporsler...</p>
          </section>
        ) : error ? (
          <section className={styles.card}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.btnAlt} onClick={loadRequests}>Prøv igjen</button>
          </section>
        ) : (
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2>Innkommende bookinger (privat)</h2>
                <span className={styles.counter}>
                  {incomingReservations.filter((item) => item.status === "pending").length} venter
                </span>
              </div>

              {incomingReservations.length === 0 ? (
                <p className={styles.empty}>Ingen innkommende bookingforesporsler.</p>
              ) : (
                <div className={styles.list}>
                  {incomingReservations.map((item) => {
                    const isPending = item.status === "pending";
                    const key = `reservation-${item.id}`;
                    return (
                      <article key={key} className={styles.item}>
                        <div className={styles.itemTop}>
                          <h3>{item.cabin_name || "Hytte"}</h3>
                          <span className={`${styles.statusPill} ${statusClass(item.status === "active" ? "approved" : item.status)}`}>
                            {statusLabel(item.status === "active" ? "approved" : item.status)}
                          </span>
                        </div>

                        <p className={styles.meta}>
                          Gjest: {item.guest_name || item.guest_email || item.guest_user_id}
                        </p>
                        <p className={styles.meta}>Antall personer: {item.guests_count}</p>
                        <p className={styles.meta}>
                          Overnattingstid: {formatRequestedDates(item.start_date, item.end_date)}
                        </p>
                        {item.notes && <p className={styles.message}>&quot;{item.notes}&quot;</p>}
                        <p className={styles.dateText}>Sendt: {formatDateTime(item.created_at)}</p>

                        {isPending ? (
                          <div className={styles.actionBlock}>
                            <label htmlFor={`owner-response-${key}`}>Svar til gjest (valgfritt)</label>
                            <textarea
                              id={`owner-response-${key}`}
                              rows={2}
                              value={ownerResponseById[key] ?? ""}
                              onChange={(event) =>
                                setOwnerResponseById((prev) => ({
                                  ...prev,
                                  [key]: event.target.value,
                                }))
                              }
                              placeholder="Kort svar til gjest"
                            />
                            <div className={styles.buttons}>
                              <button
                                className={styles.btnApprove}
                                onClick={() => decideReservation(item.id, "approve")}
                                disabled={decisionLoadingId === key}
                              >
                                Godta
                              </button>
                              <button
                                className={styles.btnReject}
                                onClick={() => decideReservation(item.id, "reject")}
                                disabled={decisionLoadingId === key}
                              >
                                Avsla
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2>Innkommende bookinger (Fra TiU)</h2>
                <span className={styles.counter}>{pendingIncomingCount} venter</span>
              </div>

              {incoming.length === 0 ? (
                <p className={styles.empty}>Ingen innkommende foresporsler.</p>
              ) : (
                <div className={styles.list}>
                  {incoming.map((item) => {
                    const isPending = item.status === "pending";
                    const approvalDates = approvalDatesById[item.id] || {};
                    const approvalStart = approvalDates.requested_start ?? String(item.requested_start || "").slice(0, 10);
                    const approvalEnd = approvalDates.requested_end ?? String(item.requested_end || "").slice(0, 10);
                    const dateOptions = Array.isArray(item.trip_date_options) ? item.trip_date_options : [];
                    return (
                      <article key={item.id} className={styles.item}>
                        <div className={styles.itemTop}>
                          <h3>{item.cabin_name || "Hytte"}</h3>
                          <span className={`${styles.statusPill} ${statusClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <p className={styles.meta}>
                          Tur: <strong>{item.trip_name || `ID ${item.trip_id}`}</strong>
                        </p>
                        <p className={styles.meta}>
                          Turleder: {item.requester_name || item.requester_email || item.requester_user_id}
                        </p>
                        <p className={styles.meta}>
                          Ønsket sengeplasser: {item.requested_beds}
                          {Number.isFinite(Number(item.cabin_capacity))
                            ? ` / kapasitet ${Number(item.cabin_capacity)}`
                            : ""}
                        </p>

                        <p className={styles.meta}>
                          Overnattingstid: {formatRequestedDates(item.requested_start, item.requested_end)}
                        </p>

                        {dateOptions.length > 0 && (
                          <div className={styles.dateOptionList}>
                            <p className={styles.dateOptionHeading}>Turens datoalternativer:</p>
                            <ul className={styles.dateOptionBullets}>
                              {dateOptions
                                .map((option) => formatDateOption(option))
                                .filter(Boolean)
                                .map((label, index) => (
                                  <li key={`${item.id}-option-${index}`}>{label}</li>
                                ))}
                            </ul>
                          </div>
                        )}

                        {isPending && (
                          <div className={styles.actionBlock}>
                            <label htmlFor={`approval-start-${item.id}`}>Startdato ved godkjenning</label>
                            <input
                              id={`approval-start-${item.id}`}
                              type="date"
                              value={approvalStart}
                              onChange={(event) =>
                                setApprovalDatesById((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...(prev[item.id] || {}),
                                    requested_start: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Velg startdato"
                            />

                            <label htmlFor={`approval-end-${item.id}`}>Sluttdato ved godkjenning</label>
                            <input
                              id={`approval-end-${item.id}`}
                              type="date"
                              value={approvalEnd}
                              onChange={(event) =>
                                setApprovalDatesById((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...(prev[item.id] || {}),
                                    requested_end: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Velg sluttdato"
                            />
                          </div>
                        )}

                        {item.status === "approved" && (
                          <div className={styles.approvedBlock}>
                            <p className={styles.success}>
                              ✓ Reservasjon opprettet: {item.approved_beds || item.requested_beds} sengeplasser
                            </p>
                          </div>
                        )}

                        {item.message && <p className={styles.message}>&quot;{item.message}&quot;</p>}

                        <p className={styles.dateText}>Sendt: {formatDateTime(item.created_at)}</p>
                        {item.responded_at && (
                          <p className={styles.dateText}>Besvart: {formatDateTime(item.responded_at)}</p>
                        )}

                        {isPending ? (
                          <div className={styles.actionBlock}>
                            <label htmlFor={`owner-response-${item.id}`}>Svar til turleder (valgfritt)</label>
                            <textarea
                              id={`owner-response-${item.id}`}
                              rows={2}
                              value={ownerResponseById[item.id] ?? ""}
                              onChange={(event) =>
                                setOwnerResponseById((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Kort svar til turleder"
                            />
                            <div className={styles.buttons}>
                              <button
                                className={styles.btnApprove}
                                onClick={() => decideRequest(item.id, "approve")}
                                disabled={decisionLoadingId === item.id}
                              >
                                Godta
                              </button>
                              <button
                                className={styles.btnReject}
                                onClick={() => decideRequest(item.id, "reject")}
                                disabled={decisionLoadingId === item.id}
                              >
                                Avsla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={styles.ownerResponse}>
                            Svar: {item.owner_response || "Ingen kommentar"}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2>Utgaende (turleder)</h2>
                <span className={styles.counter}>{outgoing.length} totalt</span>
              </div>

              {outgoing.length === 0 ? (
                <p className={styles.empty}>Ingen utgaende foresporsler.</p>
              ) : (
                <div className={styles.list}>
                  {outgoing.map((item) => (
                    <article key={item.id} className={styles.item}>
                      <div className={styles.itemTop}>
                        <h3>{item.cabin_name || "Hytte"}</h3>
                        <span className={`${styles.statusPill} ${statusClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <p className={styles.meta}>
                        Tur: <strong>{item.trip_name || `ID ${item.trip_id}`}</strong>
                      </p>
                      <p className={styles.meta}>Ønsket sengeplasser: {item.requested_beds}</p>

                      <p className={styles.meta}>
                        Overnattingstid: {formatRequestedDates(item.requested_start, item.requested_end)}
                      </p>

                      {Array.isArray(item.trip_date_options) && item.trip_date_options.length > 0 && (
                        <div className={styles.dateOptionList}>
                          <p className={styles.dateOptionHeading}>Turens datoalternativer:</p>
                          <ul className={styles.dateOptionBullets}>
                            {item.trip_date_options
                              .map((option) => formatDateOption(option))
                              .filter(Boolean)
                              .map((label, index) => (
                                <li key={`${item.id}-out-option-${index}`}>{label}</li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {item.status === "approved" && (
                        <div className={styles.approvedBlock}>
                          <p className={styles.success}>
                            ✓ Reservasjon opprettet: {item.approved_beds || item.requested_beds} sengeplasser
                          </p>
                        </div>
                      )}

                      {item.message && <p className={styles.message}>&quot;{item.message}&quot;</p>}
                      {item.owner_response && (
                        <p className={styles.ownerResponse}>Hytteeier svar: {item.owner_response}</p>
                      )}

                      <p className={styles.dateText}>Sendt: {formatDateTime(item.created_at)}</p>
                      {item.responded_at && (
                        <p className={styles.dateText}>Besvart: {formatDateTime(item.responded_at)}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
