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

function tiuStatusLabel(status) {
  if (status === "approved") return "Kapasitet registrert";
  if (status === "rejected") return "Kan ikke ta imot";
  return "Venter svar";
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
  const [approvedBedsById, setApprovedBedsById] = useState({});
  const [bindingBedsById, setBindingBedsById] = useState({});
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

  async function decideRequest(requestId, decision, options = {}) {
    if (!requestId) return;

    setDecisionLoadingId(requestId);
    setNotice({ type: "", message: "" });

    try {
      const ownerResponse = String(ownerResponseById[requestId] || "").trim();
      const approvalDates = approvalDatesById[requestId] || {};
      const requestedStart = String(approvalDates.requested_start || "").trim();
      const requestedEnd = String(approvalDates.requested_end || "").trim();
      const approvedBedsRaw = String(approvedBedsById[requestId] ?? "").trim();
      const approvedBeds = approvedBedsRaw === "" ? null : Number(approvedBedsRaw);
      const bindingBedsRaw = String(bindingBedsById[requestId] ?? "").trim();
      const bindingBeds = bindingBedsRaw === "" ? null : Number(bindingBedsRaw);
      const bindingDecision = options.bindingDecision || null;

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
          approved_beds: Number.isFinite(approvedBeds) ? approvedBeds : null,
          binding_beds: Number.isFinite(bindingBeds) ? bindingBeds : null,
          bindingDecision,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.detail ? `${data.error}: ${data.detail}` : (data?.error || "Kunne ikke oppdatere foresporsel.");
        throw new Error(msg);
      }

      setNotice({
        type: "success",
        message: bindingDecision === "confirm"
          ? "Bindende sengeplasser bekreftet."
          : bindingDecision === "withdraw"
            ? "Bindende sengeplasser trukket."
            : `${decision === "approve" ? "Kapasitet registrert (ikke-bindende)." : "Meldt at hytten ikke kan ta imot."}`,
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
      setApprovedBedsById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setBindingBedsById((prev) => {
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
          <p>Hytteeiere svarer først ikke-bindende på kapasitet, og bekrefter senere bindende sengeplasser når dato er valgt.</p>
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
                    const isBindingPhase = item.status === "approved" && item.trip_planning_status === "binding_open";
                    const bindingDecision = String(item.binding_decision || "pending").toLowerCase();
                    const isBindingPending = isBindingPhase && bindingDecision === "pending";
                    const approvedBedsValue = approvedBedsById[item.id] ?? String(item.requested_beds || "");
                    const bindingBedsValue = bindingBedsById[item.id] ?? String(item.binding_beds || item.approved_beds || item.requested_beds || "");
                    const dateOptions = Array.isArray(item.trip_date_options) ? item.trip_date_options : [];
                    return (
                      <article key={item.id} className={styles.item}>
                        <div className={styles.itemTop}>
                          <h3>{item.cabin_name || "Hytte"}</h3>
                          <span className={`${styles.statusPill} ${statusClass(item.status)}`}>
                            {tiuStatusLabel(item.status)}
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
                            <label htmlFor={`approved-beds-${item.id}`}>Antall sengeplasser du kan tilby (ikke-bindende)</label>
                            <input
                              id={`approved-beds-${item.id}`}
                              type="number"
                              min={1}
                              max={Number.isFinite(Number(item.cabin_capacity)) ? Number(item.cabin_capacity) : undefined}
                              value={approvedBedsValue}
                              onChange={(event) =>
                                setApprovedBedsById((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Antall sengeplasser"
                            />
                          </div>
                        )}

                        {item.status === "approved" && !isBindingPhase && (
                          <div className={styles.approvedBlock}>
                            <p className={styles.success}>
                              ✓ Ikke-bindende kapasitet registrert: {item.approved_beds || item.requested_beds} sengeplasser
                            </p>
                          </div>
                        )}

                        {isBindingPhase && (
                          <div className={styles.approvedBlock}>
                            <p className={styles.success}>
                              Turen er i bindende fase.
                            </p>
                            <p className={styles.meta}>
                              Bindende status: {bindingDecision === "confirmed" ? "Bekreftet" : bindingDecision === "withdrawn" ? "Trukket" : "Venter svar"}
                            </p>
                            {bindingDecision === "confirmed" && (
                              <p className={styles.meta}>Bindende sengeplasser: {item.binding_beds || item.approved_beds || item.requested_beds}</p>
                            )}
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
                                Meld kapasitet (ikke-bindende)
                              </button>
                              <button
                                className={styles.btnReject}
                                onClick={() => decideRequest(item.id, "reject")}
                                disabled={decisionLoadingId === item.id}
                              >
                                Kan ikke ta imot
                              </button>
                            </div>
                          </div>
                        ) : isBindingPending ? (
                          <div className={styles.actionBlock}>
                            <label htmlFor={`binding-beds-${item.id}`}>Bindende sengeplasser</label>
                            <input
                              id={`binding-beds-${item.id}`}
                              type="number"
                              min={1}
                              max={Number.isFinite(Number(item.cabin_capacity)) ? Number(item.cabin_capacity) : undefined}
                              value={bindingBedsValue}
                              onChange={(event) =>
                                setBindingBedsById((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Antall bindende plasser"
                            />

                            <label htmlFor={`owner-response-binding-${item.id}`}>Svar til turleder (valgfritt)</label>
                            <textarea
                              id={`owner-response-binding-${item.id}`}
                              rows={2}
                              value={ownerResponseById[item.id] ?? ""}
                              onChange={(event) =>
                                setOwnerResponseById((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Kort svar om bindende kapasitet"
                            />

                            <div className={styles.buttons}>
                              <button
                                className={styles.btnApprove}
                                onClick={() => decideRequest(item.id, "approve", { bindingDecision: "confirm" })}
                                disabled={decisionLoadingId === item.id}
                              >
                                Bekreft bindende
                              </button>
                              <button
                                className={styles.btnReject}
                                onClick={() => decideRequest(item.id, "approve", { bindingDecision: "withdraw" })}
                                disabled={decisionLoadingId === item.id}
                              >
                                Trekk bindende
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
                            ✓ Ikke-bindende kapasitet registrert: {item.approved_beds || item.requested_beds} sengeplasser
                          </p>
                          {String(item.trip_planning_status || "") === "binding_open" && (
                            <p className={styles.meta}>
                              Bindende status hos hytteeier: {String(item.binding_decision || "pending") === "confirmed" ? "Bekreftet" : String(item.binding_decision || "pending") === "withdrawn" ? "Trukket" : "Venter svar"}
                              {String(item.binding_decision || "pending") === "confirmed"
                                ? ` (${item.binding_beds || item.approved_beds || item.requested_beds} plasser)`
                                : ""}
                            </p>
                          )}
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
