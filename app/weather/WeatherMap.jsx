/**
 * app/weather/WeatherMap.jsx
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 *
 * En React-komponent som viser et interaktivt kart ved hjelp av Leaflet.js.
 * Brukeren kan klikke på kartet for å velge en posisjon og hente vær.
 *
 * Leaflet er et populært JavaScript-bibliotek for interaktive kart.
 * Det bruker OpenStreetMap-kartfliser som bakgrunnskart.
 *
 * Props (input fra foreldrekomponenten):
 *   onLocationSelect  → funksjon som kalles med { lat, lon, name } når
 *                       brukeren klikker på kartet
 *   externalLocation  → { lat, lon } fra søk/GPS, brukes til å flytte
 *                       kartet programmatisk (uten brukerinteraksjon)
 */
"use client"; // Nødvendig fordi vi bruker nettleser-APIer (DOM, Leaflet)

// useEffect → kjør kode som bivirkning (etter render)
// useRef    → lagre en referanse til et DOM-element eller en verdi
//             som ikke trigger re-render når den endres
import { useEffect, useRef } from "react";

/**
 * WeatherMap
 *
 * @param {Function} onLocationSelect - Callback fra parent; kalles med stedinfo
 * @param {{ lat: number, lon: number } | null} externalLocation - Sted fra søk/GPS
 */
export default function WeatherMap({ onLocationSelect, externalLocation }) {
  // --------------------------------------------------------------------------
  // REFS – "husker" verdier mellom re-renders uten å trigge ny render
  // --------------------------------------------------------------------------

  // containerRef peker på <div>-elementet som Leaflet-kartet injiseres i.
  // Leaflet trenger en ekte DOM-node (ikke virtuell React-DOM) å jobbe med.
  const containerRef = useRef(null);

  // mapRef lagrer Leaflet-kartobjektet så vi kan kalle metoder på det
  // (f.eks. setView, remove) fra ulike useEffect-hooks.
  const mapRef = useRef(null);

  // markerRef lagrer markør-objektet slik at vi kan flytte den
  // i stedet for å opprette en ny markør hver gang posisjonen endres.
  const markerRef = useRef(null);

  // leafletRef lagrer Leaflet-biblioteket etter det er lastet dynamisk.
  // Vi bruker det i den første useEffect for å flytte markøren.
  const leafletRef = useRef(null);

  // --------------------------------------------------------------------------
  // EFFECT 1: Reagér på ekstern posisjon (fra søk eller GPS)
  // --------------------------------------------------------------------------
  // Kjøres hver gang externalLocation endres.
  useEffect(() => {
    // Gjør ingenting hvis vi ikke har nødvendig data ennå
    if (!externalLocation || !mapRef.current || !leafletRef.current) return;

    const { lat, lon } = externalLocation;
    const Leaflet = leafletRef.current;

    if (markerRef.current) {
      // Markøren finnes allerede → flytt den til ny posisjon
      markerRef.current.setLatLng([lat, lon]);
    } else {
      // Markøren finnes ikke ennå → opprett en egendefinert markør.
      // divIcon() lar oss bruke HTML/CSS i stedet for et standardbilde.
      const icon = Leaflet.divIcon({
        className: "", // Tom string fjerner Leaflets standard CSS-klasser
        html: `<div style="width:14px;height:14px;background:var(--accent,#6675ff);border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7], // Midtpunktet av ikonet (halv bredde og høyde)
      });
      markerRef.current = Leaflet.marker([lat, lon], { icon }).addTo(
        mapRef.current,
      );
    }

    // Flytt kartvisningen til den nye posisjonen med zoom-nivå 11.
    // setView([lat, lon], zoomNivå) er en Leaflet-metode.
    mapRef.current.setView([lat, lon], 11);
  }, [externalLocation]); // Kjør på nytt når externalLocation endres

  // --------------------------------------------------------------------------
  // EFFECT 2: Initialiser Leaflet-kartet
  // --------------------------------------------------------------------------
  // Kjøres én gang etter at komponenten er montert i DOM.
  // [onLocationSelect] i dependency array betyr at effekten kjøres på nytt
  // hvis callback-funksjonen endres (vanligvis ikke, pga. useCallback i parent).
  useEffect(() => {
    // cancelled-flagg brukes for å unngå memory leaks:
    // Hvis komponenten fjernes fra DOM mens vi venter på import(),
    // setter cleanup-funksjonen cancelled = true slik at vi avbryter.
    let cancelled = false;

    // Leaflet brukes kun i nettleseren og kan ikke importeres på server.
    // import() er dynamisk import (lazy loading) – biblioteket lastes først
    // når denne koden kjøres i nettleseren, ikke ved server-side rendering.
    import("leaflet").then(async (L) => {
      // Avbryt hvis komponenten er fjernet, eller kartet allerede er initialisert.
      // containerRef.current._leaflet_id er et internt Leaflet-felt som settes
      // når et kart er knyttet til et element – unngår dobbel-init.
      if (
        cancelled ||
        !containerRef.current ||
        containerRef.current._leaflet_id
      )
        return;

      // L.default ?? L håndterer forskjellen mellom ES modules og CommonJS
      const Leaflet = L.default ?? L;

      // Leaflet krever sin CSS for å vise kartet korrekt.
      // Vi laster den dynamisk via en <link>-tag i <head>.
      // Sjekker om den allerede er lagt til for å unngå duplikater.
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // --------------------------------------------------------------------------
      // OPPRETT KARTET
      // --------------------------------------------------------------------------
      // Leaflet.map() initialiserer kartet i containerRef-elementet.
      const map = Leaflet.map(containerRef.current, {
        center: [63.2, 15], // Startposisjon: Midt-Utopia (bredde, lengde)
        zoom: 5, // Startzoom: viser hele Utopia
        zoomControl: true, // Vis +/- zoom-knapper
        scrollWheelZoom: true, // Tillat zoom med mushjul
        attributionControl: false, // Skjul "Leaflet"-attribusjon i hjørnet
      });

      // Legg til kartfliser fra OpenStreetMap.
      // {s} = underdomene (a/b/c for lastbalansering)
      // {z} = zoom-nivå, {x}/{y} = kartrutens koordinater
      Leaflet.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ).addTo(map);

      // Legg til et masklag (grå overlay utenfor Utopia) fra en delt hjelp-modul.
      // addMaskLayer er asynkron fordi den kan laste GeoJSON-data.
      const { addMaskLayer } = await import("../components/map/maskLayer");
      await addMaskLayer(map, Leaflet);

      // Definer markør-ikonet som brukes ved klikk på kartet.
      // Samme stil som i Effect 1, men definert her for gjenbruk i klikk-handler.
      const markerIcon = Leaflet.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:var(--accent,#6675ff);border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      });

      // --------------------------------------------------------------------------
      // KLIKK-HANDLER
      // --------------------------------------------------------------------------
      // map.on("click", ...) registrerer en hendelseslytter.
      // Leaflet kaller callback med et event-objekt (e) som inneholder
      // e.latlng.lat og e.latlng.lng (koordinatene som ble klikket).
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;

        // Flytt eksisterende markør, eller opprett ny
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Leaflet.marker([lat, lng], {
            icon: markerIcon,
          }).addTo(map);
        }

        // Reverse geocoding: finn stedsnavn fra koordinater via Nominatim.
        // Nominatim er OpenStreetMaps gratis geocoding-tjeneste.
        let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // fallback til koordinater
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            {
              headers: { "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)" },
            },
          );
          const data = await res.json();

          // Hent stedsnavn fra mest spesifikt til minst spesifikt adressenivå
          if (data?.address) {
            name =
              data.address.city || // storby
              data.address.town || // by/tettsted
              data.address.village || // landsby/grend
              data.address.municipality || // kommune
              data.display_name?.split(",")[0] || // første del av full adresse
              name; // fallback til koordinater
          }
        } catch {
          // Behold koordinat-navn som fallback hvis Nominatim er utilgjengelig
        }

        // Kall callback fra parent-komponenten med stedinformasjon.
        // Parent (page.js) bruker dette til å hente vær for posisjonen.
        // Merk: Leaflet bruker "lng" (longitude), men vi sender "lon" til API-et.
        onLocationSelect({ lat, lon: lng, name });
      });

      // Lagre referanser så de er tilgjengelige i Effect 1 og cleanup
      mapRef.current = map;
      leafletRef.current = Leaflet;
    });

    // --------------------------------------------------------------------------
    // CLEANUP-FUNKSJON
    // --------------------------------------------------------------------------
    // Returnering av en funksjon fra useEffect er React sin måte å registrere
    // opprydding på. Den kjøres når komponenten fjernes fra DOM (unmount),
    // eller rett før effekten kjøres på nytt.
    return () => {
      cancelled = true; // Stopp async-koden hvis den ikke er ferdig

      // Fjern Leaflet-kartet fra DOM og rydd opp minne.
      // map.remove() er viktig for å unngå memory leaks og feil ved remount.
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, [onLocationSelect]); // Kjør på nytt hvis callback-funksjonen endres

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  // Vi returnerer bare en tom div med en ref.
  // Leaflet fyller denne div-en med kartinnhold etter montering.
  // cursor: crosshair gir brukeren visuell feedback om at de kan klikke.
  return (
    <div
      ref={containerRef} // React kobler denne til containerRef.current
      style={{
        height: 280,
        borderRadius: 8,
        overflow: "hidden", // Skjul Leaflet-innhold utenfor avrundede hjørner
        border: "1px solid var(--border)",
        marginBottom: "1.5rem",
        cursor: "crosshair", // Musepeker som viser at kartet er klikkbart
      }}
    />
  );
}
