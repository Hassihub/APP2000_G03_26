"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./explore.module.css";
import { useTranslations } from "../components/LanguageProvider";

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const t = useTranslations("explorePage");
  const [trips, setTrips] = useState([]);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [type, setType] = useState(searchParams.get("type") || "alle");
  const [difficulty, setDifficulty] = useState(
    searchParams.get("difficulty") || "alle"
  );
  const [onlyTiu, setOnlyTiu] = useState(
    searchParams.get("onlyTiu") === "true"
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState({ loading: false, error: "" });

  const [newTrip, setNewTrip] = useState({
    navn: "",
    beskrivelse: "",
    lengde_km: "",
    type: "fottur",
    vanskelighetsgrad: "lett",
    start_lat: "",
    start_lng: "",
    end_lat: "",
    end_lng: "",
    bilde_url: "",
    isTiu: false,
    turleder_navn: "",
  });

  const fetchTrips = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search,
        type,
        difficulty,
        onlyTiu: onlyTiu ? "true" : "false",
      });
      const res = await fetch(`/api/trips?${params.toString()}`);
      if (!res.ok) throw new Error(t.fetchError);
      const data = await res.json();
      setTrips(data);
    } catch (err) {
      console.error(err);
      setTrips([]);
    }
  }, [difficulty, onlyTiu, search, t.fetchError, type]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setType(searchParams.get("type") || "alle");
    setDifficulty(searchParams.get("difficulty") || "alle");
    setOnlyTiu(searchParams.get("onlyTiu") === "true");
  }, [searchParams]);

  const openCreate = () => {
    setCreateStatus({ loading: false, error: "" });
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateStatus({ loading: false, error: "" });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateStatus({ loading: true, error: "" });
    try {
      const payload = {
        navn: newTrip.navn,
        beskrivelse: newTrip.beskrivelse || null,
        lengde_km: Number(newTrip.lengde_km),
        type: newTrip.type,
        vanskelighetsgrad: newTrip.vanskelighetsgrad,
        start_lat: newTrip.start_lat === "" ? null : Number(newTrip.start_lat),
        start_lng: newTrip.start_lng === "" ? null : Number(newTrip.start_lng),
        end_lat: newTrip.end_lat === "" ? null : Number(newTrip.end_lat),
        end_lng: newTrip.end_lng === "" ? null : Number(newTrip.end_lng),
        bilde_url: newTrip.bilde_url || null,
        isTiu: newTrip.isTiu,
        turleder_navn: newTrip.isTiu ? newTrip.turleder_navn : null,
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t.submitError);

      setNewTrip({
        navn: "",
        beskrivelse: "",
        lengde_km: "",
        type: "fottur",
        vanskelighetsgrad: "lett",
        start_lat: "",
        start_lng: "",
        end_lat: "",
        end_lng: "",
        bilde_url: "",
        isTiu: false,
        turleder_navn: "",
      });

      closeCreate();
      await fetchTrips();
    } catch (err) {
      setCreateStatus({ loading: false, error: err.message || t.genericError });
      return;
    }

    setCreateStatus({ loading: false, error: "" });
  };

  return (
    <main className={styles.container}>
      {/* Header, filters, results, modal ... */}
      {/* Lim inn resten av din eksisterende JSX */}
    </main>
  );
}

// TripCard komponenten lim inn som tidligere