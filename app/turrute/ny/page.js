"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SimpleFileUpload } from "simple-file-upload-react";
import styles from "./page.module.css";
import { ROLE_ADMIN, ROLE_TURLEDER, ROLE_UTLEIER } from "../../../lib/roles";

const typeOptions = [
  { value: "fottur", label: "Fottur" },
  { value: "skitur", label: "Skitur" },
  { value: "sykkel", label: "Sykkel" },
];

const difficultyOptions = [
  { value: "lett", label: "Lett" },
  { value: "middels", label: "Middels" },
  { value: "krevende", label: "Krevende" },
];

const TIU_DATE_OPTION_MIN = 3;
const TIU_DATE_OPTION_MAX = 5;

function createDateOption() {
  return {
    start_time: "",
    end_time: "",
  };
}

function createInitialDateOptions() {
  return Array.from({ length: TIU_DATE_OPTION_MIN }, () => createDateOption());
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function pointsToDistanceKm(points = []) {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }

  return total;
}

function pointsAlmostEqual(a, b, epsilon = 0.00001) {
  if (!a || !b) return false;
  return (
    Math.abs(Number(a.lat) - Number(b.lat)) <= epsilon &&
    Math.abs(Number(a.lon) - Number(b.lon)) <= epsilon
  );
}

async function fetchRoutedSegment(startPoint, endPoint, profile) {
  const startLon = Number(startPoint.lon);
  const startLat = Number(startPoint.lat);
  const endLon = Number(endPoint.lon);
  const endLat = Number(endPoint.lat);

  const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Ruteberegning feilet.");
  }

  const data = await res.json();
  const coordinates = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Fant ingen sti/vei mellom punktene.");
  }

  return coordinates
    .map(([lon, lat]) => ({ lat: Number(lat), lon: Number(lon) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

export default function NewTripRoutePage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [creationMode, setCreationMode] = useState("custom");

  const [form, setForm] = useState({
    navn: "",
    beskrivelse: "",
    type: "fottur",
    vanskelighetsgrad: "middels",
    turleder_navn: "",
    bilde_urls: [],
  });
  const [uploadStatus, setUploadStatus] = useState("");

  const [dateOptions, setDateOptions] = useState(() => createInitialDateOptions());

  const [cabins, setCabins] = useState([]);
  const [loadingCabins, setLoadingCabins] = useState(true);
  const [selectedCabinIds, setSelectedCabinIds] = useState([]);
  const [requestedBedsByCabinId, setRequestedBedsByCabinId] = useState({});
  const [stayRequestMessage, setStayRequestMessage] = useState("");

  const [routeMode, setRouteMode] = useState("straight"); // straight | path
  const routeModeRef = useRef("straight");
  const [anchorPoints, setAnchorPoints] = useState([]);
  const anchorPointsRef = useRef([]);
  const [segmentModes, setSegmentModes] = useState([]); // one mode per segment between anchor points
  const [routePoints, setRoutePoints] = useState([]);
  const [isRoutingPath, setIsRoutingPath] = useState(false);
  const [routeModeMessage, setRouteModeMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [gpxFileName, setGpxFileName] = useState("");
  const [uploadPublicKey, setUploadPublicKey] = useState("");

  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const selectedCabinLayerRef = useRef(null);
  const lineRef = useRef(null);

  const routeLengthKm = useMemo(() => pointsToDistanceKm(routePoints), [routePoints]);

  const canManageCabins =
    user?.role === ROLE_UTLEIER ||
    user?.role === ROLE_ADMIN;

  const canCreateTiu =
    user?.role === ROLE_ADMIN ||
    user?.role === ROLE_TURLEDER;

  const isTiuMode = creationMode === "tiu";
  const showCabinSelectionPanel = isTiuMode && canCreateTiu;

  function setRouteModeImmediate(nextMode) {
    routeModeRef.current = nextMode;
    setRouteMode(nextMode);
  }

  useEffect(() => {
    routeModeRef.current = routeMode;
  }, [routeMode]);

  useEffect(() => {
    anchorPointsRef.current = anchorPoints;
  }, [anchorPoints]);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setUser(null);
          return;
        }

        const data = await res.json().catch(() => ({}));
        setUser(data?.user || null);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadUser();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadCabins() {
      setLoadingCabins(true);
      try {
        const res = await fetch("/api/cabins", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.cabins) ? data.cabins : [];
        setCabins(list);
      } catch {
        if (alive) setCabins([]);
      } finally {
        if (alive) setLoadingCabins(false);
      }
    }

    loadCabins();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadUploadPublicKey() {
      try {
        const res = await fetch("/api/simple-file-upload/public-key", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok || !alive) return;

        const data = await res.json().catch(() => ({}));
        const key = typeof data?.publicKey === "string" ? data.publicKey.trim() : "";
        if (key && alive) {
          setUploadPublicKey(key);
        }
      } catch {
        if (alive) setUploadPublicKey("");
      }
    }

    loadUploadPublicKey();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let map;

    async function initMap() {
      if (authLoading) return;
      if (!user) return;
      if (typeof window === "undefined") return;

      const mapContainer = document.getElementById("new-trip-route-map");
      if (!mapContainer) return;

      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (!mounted) return;

      map = L.map(mapContainer, {
        center: [63.3, 10.4],
        zoom: 5,
        minZoom: 4,
      });

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      selectedCabinLayerRef.current = L.layerGroup().addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);

      import("../../components/map/maskLayer").then(({ addMaskLayer }) => {
        try {
          addMaskLayer(map, L);
        } catch (error) {
          console.error("Kunne ikke legge til maske for Norge:", error);
        }
      });

      map.on("click", (evt) => {
        const nextPoint = { lat: evt.latlng.lat, lon: evt.latlng.lng };
        const hasPreviousPoint = anchorPointsRef.current.length >= 1;

        setAnchorPoints((prev) => [...prev, nextPoint]);
        if (hasPreviousPoint) {
          setSegmentModes((prevModes) => [...prevModes, routeModeRef.current]);
        }
      });
    }

    initMap();

    return () => {
      mounted = false;
      if (map) {
        map.off();
        map.remove();
      }
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      selectedCabinLayerRef.current = null;
      lineRef.current = null;
    };
  }, [authLoading, user]);

  useEffect(() => {
    let cancelled = false;

    async function rebuildRouteFromAnchors() {
      if (anchorPoints.length < 2) {
        setRoutePoints(anchorPoints);
        setRouteModeMessage("");
        setIsRoutingPath(false);
        return;
      }

      const activeModes = segmentModes.slice(0, anchorPoints.length - 1);
      const hasPathSegments = activeModes.includes("path");

      setIsRoutingPath(hasPathSegments);
      setRouteModeMessage("");

      if (!hasPathSegments) {
        setRoutePoints(anchorPoints);
        return;
      }

      const profile = form.type === "sykkel" ? "cycling" : "walking";

      try {
        let merged = [anchorPoints[0]];
        let hadFallback = false;

        for (let i = 1; i < anchorPoints.length; i += 1) {
          const segmentMode = activeModes[i - 1] ?? "straight";

          if (segmentMode === "path") {
            try {
              const segment = await fetchRoutedSegment(anchorPoints[i - 1], anchorPoints[i], profile);
              if (!segment.length) {
                hadFallback = true;
                merged = merged.concat(anchorPoints[i]);
              } else {
                merged = merged.concat(segment.slice(1));
              }
            } catch {
              hadFallback = true;
              merged = merged.concat(anchorPoints[i]);
            }
          } else {
            merged = merged.concat(anchorPoints[i]);
          }
        }

        if (!cancelled) {
          setRoutePoints(merged);
          if (hadFallback) {
            setRouteModeMessage(
              "Noen delstrekninger kunne ikke følge sti/vei og vises som rette linjer."
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsRoutingPath(false);
        }
      }
    }

    rebuildRouteFromAnchors();

    return () => {
      cancelled = true;
    };
  }, [anchorPoints, segmentModes, form.type]);

  useEffect(() => {
    async function redrawSelectedCabins() {
      const map = mapInstanceRef.current;
      const selectedCabinLayer = selectedCabinLayerRef.current;
      if (!map || !selectedCabinLayer) return;

      const L = await import("leaflet");
      selectedCabinLayer.clearLayers();

      if (!isTiuMode) return;

      const selectedCabins = cabins
        .filter((cabin) => selectedCabinIds.includes(String(cabin.id)))
        .map((cabin) => {
          const lat = Number(cabin.latitude);
          const lon = Number(cabin.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return {
            id: String(cabin.id),
            name: cabin.name || "Hytte",
            lat,
            lon,
          };
        })
        .filter(Boolean);

      selectedCabins.forEach((cabin) => {
        const marker = L.circleMarker([cabin.lat, cabin.lon], {
          radius: 8,
          color: "#7c2d12",
          fillColor: "#ea580c",
          fillOpacity: 0.95,
          weight: 2,
        })
          .bindPopup(`<strong>${cabin.name}</strong><br/>Valgt hytte<br/><small>Klikk for å legge til som rutepunkt</small>`)
          .addTo(selectedCabinLayer);

        marker.on("click", () => {
          const fullCabin = cabins.find((item) => String(item.id) === cabin.id);
          if (fullCabin) {
            addCabinPointToRoute(fullCabin);
          }
        });
      });

      if (selectedCabins.length === 1) {
        map.setView([selectedCabins[0].lat, selectedCabins[0].lon], Math.max(map.getZoom(), 10));
      }

      if (selectedCabins.length > 1) {
        map.fitBounds(
          selectedCabins.map((cabin) => [cabin.lat, cabin.lon]),
          { padding: [28, 28] }
        );
      }
    }

    redrawSelectedCabins();
  }, [cabins, selectedCabinIds, isTiuMode, addCabinPointToRoute]);

  useEffect(() => {
    async function redraw() {
      const map = mapInstanceRef.current;
      const markerLayer = markersLayerRef.current;
      if (!map || !markerLayer) return;

      const L = await import("leaflet");

      markerLayer.clearLayers();
      const maxRenderedMarkers = 120;
      const markerSource = anchorPoints.length > maxRenderedMarkers
        ? [anchorPoints[0], anchorPoints[anchorPoints.length - 1]].filter(Boolean)
        : anchorPoints;

      markerSource.forEach((point, index) => {
        const isStart = index === 0;
        const isEnd = markerSource.length > 1 && index === markerSource.length - 1;
        L.circleMarker([point.lat, point.lon], {
          radius: isStart || isEnd ? 7 : 6,
          color: isStart ? "#0a7f5f" : isEnd ? "#9a3412" : "#2f6ed6",
          fillColor: isStart ? "#0a7f5f" : isEnd ? "#9a3412" : "#2f6ed6",
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(isStart ? "Start" : isEnd ? "Slutt" : `Punkt ${index + 1}`)
          .addTo(markerLayer);
      });

      if (lineRef.current) {
        map.removeLayer(lineRef.current);
        lineRef.current = null;
      }

      if (routePoints.length >= 2) {
        lineRef.current = L.polyline(
          routePoints.map((p) => [p.lat, p.lon]),
          {
            color: "#10523f",
            weight: 4,
            opacity: 0.9,
          }
        ).addTo(map);
      }
    }

    redraw();
  }, [anchorPoints, routePoints]);

  function toggleCabin(id) {
    const cabinId = String(id);
    setSelectedCabinIds((prev) => {
      const wasSelected = prev.includes(cabinId);

      if (wasSelected) {
        setRequestedBedsByCabinId((current) => {
          const next = { ...current };
          delete next[cabinId];
          return next;
        });
        return prev.filter((item) => item !== cabinId);
      }

      return [...prev, cabinId];
    });
  }

  function handleCreationModeChange(nextMode) {
    setCreationMode(nextMode);
    setStatus({ type: "idle", message: "" });
    setRouteModeMessage("");

    if (nextMode !== "tiu") {
      setSelectedCabinIds([]);
      setRequestedBedsByCabinId({});
      setStayRequestMessage("");
      resetTiuFields();
    }
  }

  function updateDateOption(index, field, value) {
    setDateOptions((prev) =>
      prev.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option
      )
    );
  }

  function addDateOption() {
    setDateOptions((prev) => {
      if (prev.length >= TIU_DATE_OPTION_MAX) return prev;
      return [...prev, createDateOption()];
    });
  }

  function removeDateOption(index) {
    setDateOptions((prev) => {
      if (prev.length <= TIU_DATE_OPTION_MIN) return prev;
      return prev.filter((_, optionIndex) => optionIndex !== index);
    });
  }

  function resetTiuFields() {
    setDateOptions(createInitialDateOptions());
    setForm((prev) => ({ ...prev, turleder_navn: "" }));
  }

  function addCabinPointToRoute(cabin) {
    if (!isTiuMode) return;
    if (!cabin) return;

    const lat = Number(cabin.latitude);
    const lon = Number(cabin.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setStatus({ type: "error", message: "Hytten mangler gyldige koordinater." });
      return;
    }

    const point = { lat, lon };
    const alreadyInRoute = anchorPointsRef.current.some((existing) =>
      pointsAlmostEqual(existing, point)
    );

    if (alreadyInRoute) {
      setRouteModeMessage(`${cabin.name || "Hytte"} er allerede et punkt i ruten.`);
      return;
    }

    const hasPreviousPoint = anchorPointsRef.current.length >= 1;
    setAnchorPoints((prev) => [...prev, point]);
    if (hasPreviousPoint) {
      setSegmentModes((prev) => [...prev, routeModeRef.current]);
    }

    setRouteModeMessage(`${cabin.name || "Hytte"} er lagt til som punkt i ruten.`);
  }

  function clearRoute() {
    if (isTiuMode) {
      setSelectedCabinIds([]);
      setRequestedBedsByCabinId({});
      setStayRequestMessage("");
    }
    setAnchorPoints([]);
    setSegmentModes([]);
    setRoutePoints([]);
    setRouteModeMessage("");
  }

  function updateRequestedBeds(cabinId, value) {
    const key = String(cabinId);
    setRequestedBedsByCabinId((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function undoLastPoint() {
    setAnchorPoints((prev) => prev.slice(0, -1));
    setSegmentModes((prev) => prev.slice(0, -1));
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleImageUploadChange(event) {
    const files = Array.isArray(event?.allFiles) ? event.allFiles : [];
    const newUrls = files
      .map((file) => file.cdnUrl)
      .filter((url) => url && !form.bilde_urls.includes(url));
    if (newUrls.length === 0) return;
    setForm((prev) => ({
      ...prev,
      bilde_urls: [...prev.bilde_urls, ...newUrls],
    }));
    setUploadStatus("Bilde(r) lastet opp.");
  }

  function handleGpxUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setStatus({ type: "error", message: "Velg en gyldig GPX-fil (.gpx)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");

        const parseError = xml.getElementsByTagName("parsererror")[0];
        if (parseError) {
          throw new Error("GPX-filen kunne ikke leses.");
        }

        const trkpts = xml.getElementsByTagName("trkpt");
        const rtepts = xml.getElementsByTagName("rtept");
        const sourceNodes = trkpts.length > 0 ? trkpts : rtepts;

        const importedPoints = Array.from(sourceNodes)
          .map((node) => ({
            lat: Number.parseFloat(node.getAttribute("lat")),
            lon: Number.parseFloat(node.getAttribute("lon")),
          }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));

        if (importedPoints.length < 2) {
          throw new Error("Fant ikke en gyldig rute i GPX-filen.");
        }

        setRoutePoints(importedPoints);
        setAnchorPoints(importedPoints);
        setSegmentModes(Array.from({ length: Math.max(0, importedPoints.length - 1) }, () => "straight"));
        setGpxFileName(file.name);
        setRouteMode("straight");
        routeModeRef.current = "straight";
        setRouteModeMessage("GPX-import bruker eksisterende punkter som rette linjer.");
        setStatus({
          type: "success",
          message: `Importerte GPX-rute med ${importedPoints.length} punkter.`,
        });

        const map = mapInstanceRef.current;
        if (map) {
          map.fitBounds(
            importedPoints.map((point) => [point.lat, point.lon]),
            { padding: [24, 24] }
          );
        }
      } catch (error) {
        setStatus({
          type: "error",
          message: error?.message || "Kunne ikke importere GPX-filen.",
        });
      }
    };

    reader.onerror = () => {
      setStatus({ type: "error", message: "Kunne ikke lese GPX-filen." });
    };

    reader.readAsText(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    if (!form.navn.trim()) {
      setStatus({ type: "error", message: "Du må fylle inn navn på turruten." });
      return;
    }

    if (routePoints.length < 2) {
      setStatus({ type: "error", message: "Legg inn minst to punkter i kartet." });
      return;
    }

    const isTiu = isTiuMode;

    if (isTiu && !canCreateTiu) {
      setStatus({
        type: "error",
        message: "Kun turleder og admin kan lage TiU-turer.",
      });
      return;
    }

    if (isTiu && !form.turleder_navn.trim()) {
      setStatus({ type: "error", message: "Du må fylle inn navn på turleder." });
      return;
    }

    if (isTiu) {
      if (dateOptions.length < TIU_DATE_OPTION_MIN || dateOptions.length > TIU_DATE_OPTION_MAX) {
        setStatus({
          type: "error",
          message: `TiU-turer må ha ${TIU_DATE_OPTION_MIN}-${TIU_DATE_OPTION_MAX} startalternativer.`,
        });
        return;
      }

      for (const option of dateOptions) {
        if (!option.start_time || !option.end_time) {
          setStatus({
            type: "error",
            message: "Alle datoalternativer må ha både start- og sluttid.",
          });
          return;
        }

        if (new Date(option.end_time) <= new Date(option.start_time)) {
          setStatus({
            type: "error",
            message: "Sluttidspunkt må være etter starttidspunkt.",
          });
          return;
        }
      }
    }

    const geometry = {
      type: "LineString",
      coordinates: routePoints.map((p) => [p.lon, p.lat]),
    };

    const stayRequests = [];
    if (isTiu && selectedCabinIds.length > 0) {
      for (const cabinId of selectedCabinIds) {
        const selectedCabin = cabins.find((item) => String(item.id) === String(cabinId));
        const capacity = Number(selectedCabin?.capacity);
        const requestedBedsRaw = requestedBedsByCabinId[String(cabinId)];
        const requestedBeds = Number(requestedBedsRaw);

        if (!Number.isInteger(requestedBeds) || requestedBeds <= 0) {
          setStatus({
            type: "error",
            message: `Velg gyldig antall sengeplasser for ${selectedCabin?.name || "valgt hytte"}.`,
          });
          return;
        }

        if (Number.isFinite(capacity) && requestedBeds > capacity) {
          setStatus({
            type: "error",
            message: `Antall sengeplasser for ${selectedCabin?.name || "hytte"} kan ikke overstige kapasitet (${capacity}).`,
          });
          return;
        }

        stayRequests.push({
          cabin_id: String(cabinId),
          requested_beds: requestedBeds,
        });
      }
    }

    const payload = isTiu
      ? {
          navn: form.navn.trim(),
          beskrivelse: form.beskrivelse.trim() || null,
          lengde_km: Number(routeLengthKm.toFixed(2)),
          type: form.type,
          vanskelighetsgrad: form.vanskelighetsgrad,
          geometry,
          isTiu: true,
          isFlexible: true,
          turleder_navn: form.turleder_navn.trim(),
          dateOptions: dateOptions.map((option) => ({
            start_time: option.start_time,
            end_time: option.end_time,
          })),
          cabin_ids: selectedCabinIds,
          bilde_urls: form.bilde_urls,
        }
      : {
          navn: form.navn.trim(),
          beskrivelse: form.beskrivelse.trim() || null,
          lengde_km: Number(routeLengthKm.toFixed(2)),
          type: form.type,
          vanskelighetsgrad: form.vanskelighetsgrad,
          geometry,
          bilde_urls: form.bilde_urls,
        };

    const endpoint = isTiu ? "/api/trips" : "/api/trips/custom-route";

    setSubmitting(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke lagre turruten.");
      }

      let statusType = "success";
      let statusMessage = isTiu
        ? `TiU-turen ble sendt til admin for godkjenning med ID ${data?.id}.`
        : `Turruten ble sendt til verifisering med ID ${data?.verification_route_id}.`;

      if (isTiu && stayRequests.length > 0 && Number.isInteger(Number(data?.id))) {
        const stayRes = await fetch("/api/cabin-stay-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            trip_id: Number(data.id),
            requests: stayRequests,
            message: stayRequestMessage.trim() || null,
          }),
        });

        const stayData = await stayRes.json().catch(() => ({}));

        if (!stayRes.ok) {
          statusType = "error";
          const detailText = typeof stayData?.details === "string" && stayData.details.trim()
            ? ` Detaljer: ${stayData.details.trim()}`
            : "";
          statusMessage = `Turen ble opprettet (ID ${data?.id}), men kunne ikke sende hytteforesporsler: ${stayData?.error || "ukjent feil"}.${detailText}`;
        } else {
          statusMessage += ` ${stayRequests.length} foresporsel${stayRequests.length === 1 ? "" : "er"} sendt til hytteeier.`;
        }
      }

      setStatus({
        type: statusType,
        message: statusMessage,
      });

      setForm((prev) => ({
        ...prev,
        navn: "",
        beskrivelse: "",
        turleder_navn: "",
        bilde_urls: [],
      }));
      setUploadStatus("");
      setSelectedCabinIds([]);
      setRequestedBedsByCabinId({});
      setStayRequestMessage("");
      setStayRequestStartDate("");
      setStayRequestEndDate("");
      setAnchorPoints([]);
      setSegmentModes([]);
      setRoutePoints([]);
      setGpxFileName("");
      setRouteModeMessage("");
      resetTiuFields();
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Ukjent feil oppstod." });
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            Laster brukerdata...
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <h2>Du må være innlogget</h2>
            <p>Logg inn for å lage din egen turrute og legge til hytter.</p>
            <Link href="/login" className={styles.btn}>
              Gå til innlogging
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Turruteverktøy</p>
          <h1>Lag en turrute, eller opprett en TiU-tur</h1>
          <p>
            Tegn ruten i kartet, velg mellom vanlig turrute og TiU-tur, og legg inn fleksible startdatoer når turen skal godkjennes av admin.
          </p>
        </section>

        <form className={styles.grid} onSubmit={handleSubmit}>
          <section className={`${styles.card} ${styles.main} ${!isTiuMode ? styles.mainFull : ""}`}>
            <div className={styles.modeRow}>
              <span className={styles.modeLabel}>Opprettelsestype</span>
              <div className={styles.modeButtons}>
                <button
                  type="button"
                  className={creationMode === "custom" ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => handleCreationModeChange("custom")}
                >
                  Vanlig turrute
                </button>
                <button
                  type="button"
                  className={creationMode === "tiu" ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => {
                    if (!canCreateTiu) {
                      setStatus({
                        type: "error",
                        message: "Kun turleder og admin kan lage TiU-turer.",
                      });
                      return;
                    }

                    handleCreationModeChange("tiu");
                  }}
                >
                  TiU-tur
                </button>
              </div>
            </div>

            {isTiuMode && !canCreateTiu && (
              <p className={styles.modeNotice}>
                Kun turleder og admin kan lage TiU-turer.
              </p>
            )}

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="navn">Rutenavn</label>
                <input
                  id="navn"
                  name="navn"
                  value={form.navn}
                  onChange={handleFieldChange}
                  placeholder="For eksempel Rondane helgetur"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="type">Type</label>
                <select id="type" name="type" value={form.type} onChange={handleFieldChange}>
                  {typeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="vanskelighetsgrad">Vanskelighetsgrad</label>
                <select
                  id="vanskelighetsgrad"
                  name="vanskelighetsgrad"
                  value={form.vanskelighetsgrad}
                  onChange={handleFieldChange}
                >
                  {difficultyOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {isTiuMode && (
                <div className={styles.field}>
                  <label htmlFor="turleder_navn">Turleder</label>
                  <input
                    id="turleder_navn"
                    name="turleder_navn"
                    value={form.turleder_navn}
                    onChange={handleFieldChange}
                    placeholder="Navn på turleder"
                  />
                </div>
              )}

              <div className={styles.field}>
                <label>Estimert lengde</label>
                <input value={`${routeLengthKm.toFixed(2)} km`} readOnly />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="beskrivelse">Beskrivelse</label>
              <textarea
                id="beskrivelse"
                name="beskrivelse"
                rows={4}
                value={form.beskrivelse}
                onChange={handleFieldChange}
                placeholder="Beskriv turen, terreng, forslag til pauser eller sikkerhetstips."
              />
            </div>

            <div className={styles.field}>
              <label>Bilde(r) (valgfritt)</label>
              {uploadPublicKey ? (
                <SimpleFileUpload
                  publicKey={uploadPublicKey}
                  multiple={true}
                  maxFileSize={5 * 1024 * 1024}
                  onChange={handleImageUploadChange}
                />
              ) : (
                <p className={styles.help}>
                  Mangler nøkkel for Simple File Upload i miljøvariabler.
                </p>
              )}

              {uploadStatus && <p className={styles.help}>{uploadStatus}</p>}

              {form.bilde_urls && form.bilde_urls.length > 0 && (
                <div className={styles.previewWrap}>
                  {form.bilde_urls.map((url, idx) => (
                    <div key={url + idx} style={{ display: "inline-block", marginRight: 8 }}>
                      <Image
                        src={url}
                        alt={`Forhåndsvisning bilde ${idx + 1}`}
                        className={styles.previewImage}
                        width={120}
                        height={120}
                      />
                      <button
                        type="button"
                        className={styles.btnAlt}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            bilde_urls: prev.bilde_urls.filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        Fjern
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className={styles.help}>
              Kart: Venstreklikk for å legge til punkt, eller importer en GPX-rute. Du trenger minst to punkter.
            </p>

            {isTiuMode && (
              <section className={styles.tiuPanel}>
                <div className={styles.tiuPanelHeader}>
                  <div>
                    <h3>Fleksible startdatoer</h3>
                    <p className={styles.help}>
                      Legg inn 3-5 alternative starttidspunkt. Admin må godkjenne TiU-turen før den blir åpen.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.btnAlt}
                    onClick={addDateOption}
                    disabled={dateOptions.length >= TIU_DATE_OPTION_MAX}
                  >
                    Legg til dato
                  </button>
                </div>

                <div className={styles.dateOptionList}>
                  {dateOptions.map((option, index) => (
                    <div key={`${index}-${option.start_time}-${option.end_time}`} className={styles.dateOptionRow}>
                      <div className={styles.dateOptionInputs}>
                        <div className={styles.field}>
                          <label htmlFor={`date-option-start-${index}`}>Start</label>
                          <input
                            id={`date-option-start-${index}`}
                            type="datetime-local"
                            value={option.start_time}
                            onChange={(event) => updateDateOption(index, "start_time", event.target.value)}
                          />
                        </div>

                        <div className={styles.field}>
                          <label htmlFor={`date-option-end-${index}`}>Slutt</label>
                          <input
                            id={`date-option-end-${index}`}
                            type="datetime-local"
                            value={option.end_time}
                            onChange={(event) => updateDateOption(index, "end_time", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.dateOptionActions}>
                        <span className={styles.ownerNote}>Alternativ {index + 1}</span>
                        <button
                          type="button"
                          className={styles.btnAlt}
                          onClick={() => removeDateOption(index)}
                          disabled={dateOptions.length <= TIU_DATE_OPTION_MIN}
                        >
                          Fjern
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isRoutingPath && (
              <p className={styles.help}>Beregner sti/vei mellom punktene...</p>
            )}
            {routeModeMessage && (
              <p className={styles.modeNotice}>{routeModeMessage}</p>
            )}

            <div className={styles.gpxBox}>
              <label className={styles.gpxLabel} htmlFor="gpx-upload">
                Importer GPX-rute
              </label>
              <input
                id="gpx-upload"
                type="file"
                accept=".gpx,application/gpx+xml"
                onChange={handleGpxUpload}
              />
              {gpxFileName && (
                <p className={styles.gpxMeta}>Valgt GPX-fil: {gpxFileName}</p>
              )}
            </div>

            <div className={`${styles.mapWrap} ${!isTiuMode ? styles.mapWrapLegacy : ""}`}>
              <div className={styles.modeOverlay}>
                <div className={styles.modeButtons}>
                  <button
                    type="button"
                    className={routeMode === "straight" ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setRouteModeImmediate("straight")}
                  >
                    Rette linjer
                  </button>
                  <button
                    type="button"
                    className={routeMode === "path" ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setRouteModeImmediate("path")}
                  >
                    Følg sti/vei
                  </button>
                </div>
              </div>

              <div id="new-trip-route-map" className={styles.map} />
            </div>

            <div className={styles.actions}>
              <button className={styles.btnAlt} type="button" onClick={undoLastPoint}>
                Fjern siste punkt
              </button>
              <button className={styles.btnAlt} type="button" onClick={clearRoute}>
                Nullstill rute
              </button>
              <button className={styles.btn} type="submit" disabled={submitting}>
                {submitting ? "Lagrer..." : "Lagre turrute"}
              </button>
            </div>

            {status.type === "success" && (
              <div className={`${styles.status} ${styles.success}`}>{status.message}</div>
            )}
            {status.type === "error" && (
              <div className={`${styles.status} ${styles.error}`}>{status.message}</div>
            )}
          </section>

          {isTiuMode && (
            <aside className={`${styles.card} ${styles.side}`}>
              <h2>TiU-oppsummering</h2>
              <div className={`${styles.status} ${styles.warn}`}>
                Ruten blir synlig i explore, men kan ikke brukes til interessemelding før godkjenning.
              </div>

              {showCabinSelectionPanel && (
                <>
                  <h2>Velg hytter i ruten</h2>

                  <div className={styles.ownerActions}>
                    <Link href="/reserver/foresporsler" className={styles.btnAlt}>
                      Se overnattingsforesporsler
                    </Link>
                  </div>

                  {canManageCabins && (
                    <div className={styles.ownerActions}>
                      <Link href="/reserver/ny?next=/turrute/ny" className={styles.btn}>
                        Legg til egen hytte
                      </Link>
                      <p className={styles.ownerNote}>
                        Etter at hytten er opprettet kan du lage adkomstrute hit fra denne siden.
                      </p>
                    </div>
                  )}

                  {loadingCabins ? (
                    <div className={`${styles.status} ${styles.warn}`}>Laster hytter...</div>
                  ) : cabins.length === 0 ? (
                    <div className={`${styles.status} ${styles.warn}`}>Fant ingen hytter.</div>
                  ) : (
                    <div className={styles.cabinList}>
                      {cabins.map((cabin) => {
                        const cabinId = String(cabin.id);
                        const checked = selectedCabinIds.includes(cabinId);
                        const capacity = Number(cabin.capacity);

                        return (
                          <label key={cabinId} className={styles.cabinItem}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCabin(cabinId)}
                            />
                            <div className={styles.cabinInfo}>
                              <span className={styles.cabinName}>{cabin.name || "Uten navn"}</span>
                              <span className={styles.cabinMeta}>
                                {cabin.location || "Ukjent sted"}
                                {Number.isFinite(capacity)
                                  ? ` | Kapasitet: ${capacity} pers`
                                  : ""}
                                {Number.isFinite(Number(cabin.price_per_night))
                                  ? ` | ${cabin.price_per_night} kr/natt`
                                  : ""}
                              </span>

                              {checked && (
                                <div className={styles.requestInputRow}>
                                  <label htmlFor={`requested-beds-${cabinId}`}>Sengeplasser i foresporsel</label>
                                  <input
                                    id={`requested-beds-${cabinId}`}
                                    type="number"
                                    min={1}
                                    max={Number.isFinite(capacity) ? capacity : undefined}
                                    value={requestedBedsByCabinId[cabinId] ?? ""}
                                    onChange={(event) => updateRequestedBeds(cabinId, event.target.value)}
                                    placeholder={Number.isFinite(capacity) ? `1-${capacity}` : "Antall"}
                                  />
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {selectedCabinIds.length > 0 && (
                    <div className={styles.field}>
                      <label htmlFor="stay-request-message">Melding til hytteeier (valgfritt)</label>
                      <textarea
                        id="stay-request-message"
                        rows={3}
                        value={stayRequestMessage}
                        onChange={(event) => setStayRequestMessage(event.target.value)}
                        placeholder="Skriv kort om gruppen, tidspunkt og behov for overnatting."
                      />
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
        </form>
      </div>
    </main>
  );
}