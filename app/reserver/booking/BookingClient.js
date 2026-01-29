"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Reserver.module.css";

export default function BookingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cabinId = searchParams.get("cabinId");

  const [cabin, setCabin] = useState(null);
  const [loadingCabin, setLoadingCabin] = useState(true);
  const [start_date, setStart] = useState("");
  const [end_date, setEnd] = useState("");
  const [guests_count, setGuests] = useState(1);
  const [guest_name, setName] = useState("");
  const [guest_email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // Hent hytteinfo, beregning av netter, pris, validering osv.
  // ... hele useEffect, useMemo osv. fra page.js

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabin_id: cabinId,
          start_date,
          end_date,
          guests_count: Number(guests_count),
          guest_name: String(guest_name).trim(),
          guest_email: String(guest_email).trim(),
          notes: notes ? String(notes).trim() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke opprette reservasjon.");
      setOk("✅ Reservasjon opprettet!");
      setTimeout(() => router.push("/reserver"), 900);
    } catch (e) {
      setError(e?.message || "Ukjent feil ved opprettelse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      {/* Hele JSX fra page.js */}
    </div>
  );
}
