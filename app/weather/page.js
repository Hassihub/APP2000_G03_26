/**
 * app/weather/page.js
 *
 * Dette er værsiden til FrittFram-appen.
 * "use client" øverst betyr at dette er en React Client Component –
 * den kjører i nettleseren, ikke på serveren. Dette er nødvendig fordi
 * vi bruker hooks (useState, useEffect) og nettleser-APIer (geolocation, cookies).
 *
 * Siden gjør tre ting:
 *   1. Viser et interaktivt kart der brukeren kan klikke for å velge sted.
 *   2. Lar brukeren søke etter et sted med navn.
 *   3. Viser nåværende vær og ukesprognose for valgt sted.
 */
"use client";

// React-hooks vi bruker:
//   useState   → lagrer og oppdaterer tilstand (data som endres over tid)
//   useCallback → husker en funksjon mellom re-renders (ytelsesoptimalisering)
//   useEffect  → kjører kode som en bivirkning, f.eks. etter at komponenten er montert
import { useState, useCallback, useEffect } from "react";

// Oversettelseshook fra vår egen LanguageProvider-komponent.
// Returnerer et objekt med oversatte tekster basert på valgt språk.
import { useTranslations } from "../components/LanguageProvider";

// Kartet er sin egen komponent for å holde koden ryddig.
import WeatherMap from "./WeatherMap";

// --------------------------------------------------------------------------
// KONSTANTTABELL: værsymbol → emoji
// --------------------------------------------------------------------------
// Met.no bruker tekstkoder for værsymboler, f.eks. "clearsky_day".
// Vi mapper dem til emoji for visuell visning.
// Objektet bruker korte nøkler som vi sjekker mot (se symbolToEmoji under).
const SYMBOL_EMOJI = {
  clearsky:      "☀️",   // klarvær
  fair:          "🌤️",  // lettskyet
  partlycloudy:  "⛅",   // delvis skyet
  cloudy:        "☁️",   // overskyet
  fog:           "🌫️",  // tåke
  lightrain:     "🌦️",  // lett regn
  rain:          "🌧️",  // regn
  heavyrain:     "🌧️",  // kraftig regn
  sleet:         "🌨️",  // sludd
  snow:          "❄️",   // snø
  heavysnow:     "❄️",   // kraftig snø
  thunder:       "⛈️",   // torden
};

/**
 * symbolToEmoji
 *
 * Gjør om en met.no symbol-kode til en emoji.
 *
 * @param {string} code - F.eks. "partlycloudy_day" eller "heavyrain"
 * @returns {string} - En emoji, eller "🌡️" som standardverdi
 *
 * Eksempel:
 *   symbolToEmoji("partlycloudy_night")  → "⛅"
 *   symbolToEmoji("lightrain")           → "🌦️"
 *   symbolToEmoji(null)                  → "🌡️"
 */
function symbolToEmoji(code) {
  // Returner standardemoji hvis koden mangler
  if (!code) return "🌡️";

  // Fjern suffikser som _day, _night, _polartwilight fra koden.
  // Deretter fjern alle gjenværende understreker.
  // Eksempel: "partlycloudy_night" → "partlycloudy" → "partlycloudy"
  const base = code.replace(/_day|_night|_polartwilight/g, "").replace(/_/g, "");

  // Gå gjennom alle nøkler i SYMBOL_EMOJI og se om base inneholder nøkkelen.
  // Object.entries() gir oss [nøkkel, verdi]-par fra objektet.
  for (const [key, emoji] of Object.entries(SYMBOL_EMOJI)) {
    if (base.includes(key)) return emoji;
  }

  // Ingen treff → standardemoji
  return "🌡️";
}

// --------------------------------------------------------------------------
// HOVED-KOMPONENT
// --------------------------------------------------------------------------
/**
 * WeatherPage
 *
 * Standardeksport fra denne filen. Next.js bruker automatisk denne
 * komponenten når brukeren navigerer til /weather.
 */
export default function WeatherPage() {
  // Hent oversatte tekster for "weatherPage"-seksjonen.
  // t.title, t.now, t.forecast osv. er definert i translations-filen.
  const t = useTranslations("weatherPage");

  // --------------------------------------------------------------------------
  // STATE-VARIABLER
  // --------------------------------------------------------------------------
  // useState(startverdi) returnerer [nåværendeVerdi, setterfunksjon].
  // Når setteren kalles, re-renderer React komponenten med ny verdi.

  const [query, setQuery]               = useState("");      // søketekst i inputfeltet
  const [results, setResults]           = useState([]);      // liste med steder fra søket
  const [weather, setWeather]           = useState(null);    // værdata (null = ikke hentet ennå)
  const [selectedName, setSelectedName] = useState("");      // navn på valgt sted
  const [mapLocation, setMapLocation]   = useState(null);    // koordinater for kartet
  const [locating, setLocating]         = useState(false);   // true mens GPS-søk pågår
  const [locError, setLocError]         = useState("");      // feilmelding fra GPS
  const [recentSearches, setRecentSearches] = useState([]); // siste søk (fra cookies)

  // --------------------------------------------------------------------------
  // EFFECT: Les nylige søk fra cookies
  // --------------------------------------------------------------------------
  // useEffect(fn, []) kjører fn én gang, etter at komponenten er montert
  // i nettleseren (aldri på server-side render). Dette er viktig fordi
  // document.cookie ikke finnes på serveren.
  //
  // Tom array [] som andre argument = "kjør bare én gang"
  useEffect(() => {
    try {
      // Regex for å finne cookie med navn "weather_recent".
      // document.cookie returnerer alle cookies som én streng: "a=1; b=2; ..."
      const match = document.cookie.match(/(?:^|; )weather_recent=([^;]*)/);
      if (match) {
        // match[1] inneholder den URL-kodede JSON-strengen.
        // decodeURIComponent() gjør om %5B%5D tilbake til [].
        // JSON.parse() gjør om JSON-tekst til et JavaScript-array.
        setRecentSearches(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch {
      // Ignorer korrupt eller ugyldig cookie
    }
  }, []);

  // --------------------------------------------------------------------------
  // EFFECT: Lagre nylige søk til cookies
  // --------------------------------------------------------------------------
  // Dette kjøres hver gang recentSearches endres.
  // [recentSearches] som andre argument = "kjør når recentSearches endres"
  useEffect(() => {
    // JSON.stringify() gjør array om til JSON-tekst.
    // encodeURIComponent() sikrer at spesialtegn ikke ødelegger cookie-syntaksen.
    const value = encodeURIComponent(JSON.stringify(recentSearches));

    // Sett cookie med:
    //   path=/        → tilgjengelig på hele domenet
    //   max-age       → levetid i sekunder (60*60*24*30 = 30 dager)
    //   SameSite=Lax  → sikkerhetspolicy (forhindrer CSRF-angrep)
    document.cookie = `weather_recent=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, [recentSearches]);

  // --------------------------------------------------------------------------
  // SØKEFUNKSJON
  // --------------------------------------------------------------------------
  /**
   * search
   *
   * Kalles når brukeren sender inn søkeskjemaet.
   * Henter stedsnavn fra vår interne søke-API (/api/search).
   *
   * @param {Event} e - Skjema-submit-hendelsen
   */
  const search = async (e) => {
    // Forhindrer standard skjema-oppførsel (reload av siden)
    e.preventDefault();

    // Kall vår interne søke-API med søkestrengen som query-parameter.
    // Template literal setter inn query-variabelen i URL-en.
    const res = await fetch(`/api/search?q=${query}`);

    // Parse JSON-svaret
    const data = await res.json();

    // API-et kan returnere enten en direkte array eller { locations: [...] }.
    // Vi håndterer begge formater med en ternær operator.
    setResults(Array.isArray(data) ? data : data.locations || []);
  };

  // --------------------------------------------------------------------------
  // HENT VÆRET FOR ET STED
  // --------------------------------------------------------------------------
  /**
   * getWeather
   *
   * Henter værdata fra vår interne API (/api/weather) for gitte koordinater.
   * Oppdaterer state medværdata, valgt stednavn, og kart-posisjon.
   *
   * @param {{ lat: number, lon: number, name?: string }} loc - Koordinater og valgfritt navn
   */
  const getWeather = async (loc) => {
    // Kall vår interne vær-API med koordinater
    const res = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`);

    // Lagre værdata i state (dette trigger en re-render som viser været)
    setWeather(await res.json());

    // Oppdater siste søk og valgt stednavn, men bare hvis stedet har et navn
    if (loc.name) {
      setSelectedName(loc.name);

      // Oppdater historikken (recent searches):
      //   1. Fjern stedet hvis det allerede er i listen (unngå duplikater)
      //   2. Legg stedet øverst
      //   3. Behold maks 8 siste søk
      setRecentSearches((prev) => {
        const filtered = prev.filter((r) => r.name !== loc.name);
        return [{ name: loc.name, lat: loc.lat, lon: loc.lon }, ...filtered].slice(0, 8);
      });
    }

    // Fortell kartet hvilken posisjon det skal vise
    setMapLocation({ lat: loc.lat, lon: loc.lon });
  };

  // --------------------------------------------------------------------------
  // GPS: FINN MIN POSISJON
  // --------------------------------------------------------------------------
  /**
   * locateMe
   *
   * Bruker nettleserens Geolocation API til å finne brukerens posisjon.
   * Deretter bruker vi Nominatim (OpenStreetMap) til å finne stedsnavn
   * fra koordinatene (reverse geocoding).
   */
  const locateMe = () => {
    // Sjekk at nettleseren støtter geolocation
    if (!navigator.geolocation) {
      setLocError("Nettleseren din støtter ikke posisjon.");
      return;
    }

    // Sett loading-tilstand og nullstill ev. gamle feilmeldinger
    setLocating(true);
    setLocError("");

    // getCurrentPosition er asynkron: den kaller success-callback
    // når posisjonen er funnet, eller error-callback ved feil.
    navigator.geolocation.getCurrentPosition(
      // SUCCESS-CALLBACK
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // Start med koordinater som stedsnavn (fallback)
        let name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

        // Prøv å finne et menneskelig lesbart stedsnavn via Nominatim.
        // Dette kalles "reverse geocoding" – fra koordinater til adresse.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)" } }
          );
          const data = await res.json();

          // Prøv ulike adressenivåer i prioritert rekkefølge:
          // by > tettsted > landsby > kommune > display_name > koordinater
          if (data?.address) {
            name =
              data.address.city        ||  // f.eks. "Oslo"
              data.address.town        ||  // f.eks. "Notodden"
              data.address.village     ||  // f.eks. "Hvittingfoss"
              data.address.municipality||  // f.eks. "Kongsberg kommune"
              data.display_name?.split(",")[0] || // første del av full adresse
              name;                        // fallback til koordinater
          }
        } catch {
          // Behold koordinat-navn hvis Nominatim feiler
        }

        // Hent været for den funne posisjonen
        await getWeather({ lat, lon, name });
        setLocating(false);
      },
      // ERROR-CALLBACK (brukeren nektet tilgang, timeout osv.)
      () => {
        setLocError("Kunne ikke hente posisjon. Sjekk at du har gitt tillatelse.");
        setLocating(false);
      }
    );
  };

  // --------------------------------------------------------------------------
  // HÅNDTER KLIKK PÅ KARTET
  // --------------------------------------------------------------------------
  /**
   * handleMapClick
   *
   * Kalles av WeatherMap-komponenten når brukeren klikker på kartet.
   * useCallback husker denne funksjonen mellom re-renders, slik at
   * WeatherMap ikke re-rendres unødvendig når andre state-variabler endres.
   * (WeatherMap mottar handleMapClick som prop, og React sjekker om
   *  referansen er endret for å bestemme om barnet skal re-rendres.)
   *
   * @param {{ lat: number, lon: number, name: string }} loc - Klikket posisjon
   */
  const handleMapClick = useCallback((loc) => {
    getWeather(loc);   // Hent vær for klikket posisjon
    setResults([]);    // Skjul søkeresultater
    setQuery("");      // Tøm søkeinputtet
  }, []); // Tom dependency array: funksjonen endres aldri

  // --------------------------------------------------------------------------
  // DATOFORMATERING
  // --------------------------------------------------------------------------
  /**
   * formatDate
   *
   * Gjør om en ISO-datostreng til et lesbart format tilpasset valgt språk.
   *
   * @param {string} dateStr - F.eks. "2026-03-25"
  * @returns {string} - F.eks. "tirsdag 25. mars" (utopisk) eller "Tuesday 25 March" (engelsk)
   *
   * toLocaleDateString() er et innebygd JS-API for lokalisert datovisning.
   * Locale-strengen bestemmer språk og format:
  *   "nb-NO" → utopisk bokmål
   *   "en-GB" → britisk engelsk (dag-måneds-rekkefølge)
   */
  const formatDate = (dateStr) => {
    const locale = t.title === "Værsøk" ? "nb-NO" : "en-GB";

    return new Date(dateStr).toLocaleDateString(locale, {
      weekday: "long",  // f.eks. "tirsdag"
      day: "numeric",   // f.eks. "25"
      month: "long",    // f.eks. "mars"
    });
  };

  // --------------------------------------------------------------------------
  // RENDER / JSX
  // --------------------------------------------------------------------------
  // JSX er en syntaksutvidelse som lar oss skrive HTML-lignende kode i JS.
  // Nettleseren forstår ikke JSX direkte – det kompileres av Next.js til
  // vanlige React.createElement()-kall.
  return (
    // Ytre wrapper-div som setter grunnleggende styling for hele siden.
    // CSS-variabler (--bg, --text) er definert globalt og støtter mørk/lys modus.
    <div style={{ padding: "2rem", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter','Poppins',sans-serif" }}>

      {/* Sentrert innholdskolonne med maks 800px bredde */}
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Merkevare-label */}
        <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#6675ff" }}>FrittFram</p>

        {/* Sidetittel – teksten hentes fra oversettelser */}
        <h1 style={{ margin: "0 0 1.5rem", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em" }}>{t.title}</h1>

        {/*
          WeatherMap-komponenten.
          Props:
            onLocationSelect → callback-funksjon, kalles når bruker klikker på kart
            externalLocation → koordinater fra søk/GPS, brukes til å flytte kartet
        */}
        <WeatherMap onLocationSelect={handleMapClick} externalLocation={mapLocation} />

        {/* ---------------------------------------------------------------- */}
        {/* VERKTØYLINJE: Min posisjon + nylige søk                          */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", overflow: "hidden", minWidth: 0 }}>

          {/* GPS-knapp */}
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}  // Deaktiver knappen mens vi venter på GPS
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 1rem",
              background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--text)", fontWeight: 700, fontSize: "0.82rem",
              cursor: locating ? "not-allowed" : "pointer",  // Endre musepeker basert på tilstand
              fontFamily: "inherit",
              opacity: locating ? 0.7 : 1,  // Gjør knappen halvgjennomsiktig mens den laster
              whiteSpace: "nowrap"
            }}
          >
            📍 {locating ? "Henter..." : "Min posisjon"}
          </button>

          {/* Vis feilmelding fra GPS (bare hvis locError ikke er tom streng) */}
          {locError && <span style={{ flexShrink: 0, fontSize: "0.78rem", color: "#b91c1c", whiteSpace: "nowrap" }}>{locError}</span>}

          {/*
            Nylige søk som klikkbare snarveisknapper.
            .map() går gjennom arrayet og returnerer en knapp per sted.
            key={r.name} er påkrevd av React for å holde styr på liste-elementer.
          */}
          {recentSearches.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => getWeather(r)}  // Klikk henter vær for dette stedet
              style={{
                flexShrink: 1, minWidth: 0,
                padding: "0.5rem 0.85rem",
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
                color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem",
                cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"  // Klipp av langt tekst med "..."
              }}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SØKESKJEMA                                                        */}
        {/* ---------------------------------------------------------------- */}
        {/*
          onSubmit={search} → kall search-funksjonen når skjemaet sendes.
          Dette skjer når brukeren klikker "Søk"-knappen eller trykker Enter.
        */}
        <form onSubmit={search} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <input
            value={query}                          // Kontrollert input: React styrer verdien
            onChange={(e) => setQuery(e.target.value)}  // Oppdater state ved hver tastetrykk
            placeholder={t.inputPlaceholder}       // Plassholdertekst fra oversettelser
            style={{ flex: 1, padding: "0.75rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "1rem", outline: "none" }}
          />
          <button type="submit" style={{ padding: "0.75rem 1.5rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, fontWeight: 800, cursor: "pointer" }}>
            {t.submit}
          </button>
        </form>

        {/* ---------------------------------------------------------------- */}
        {/* SØKERESULTATER                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>

          {/* Vis "Ingen resultater"-melding bare hvis søk er gjort men ingenting ble funnet */}
          {!results.length && query ? <p style={{ color: "var(--text-muted)" }}>{t.noResults}</p> : null}

          {/* Vis hvert søkeresultat som en klikkbar rad */}
          {results.map((loc, i) => (
            <div
              key={i}
              onClick={() => getWeather(loc)}  // Klikk henter vær for dette stedet
              style={{ cursor: "pointer", padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-panel)", color: "var(--text)", fontWeight: 600, transition: "border-color 0.15s" }}
              // onMouseEnter/Leave gir visuell feedback: kantlinjen endrer farge ved hover
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              {loc.name}
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* VÆRVISNING (vises bare når weather ikke er null)                 */}
        {/* ---------------------------------------------------------------- */}
        {/*
          {weather && ( ... )} er et betinget render-mønster i React.
          Siden weather starter som null, vises ingenting før brukeren
          har valgt et sted.
        */}
        {weather && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* -------------------------------------------------------------- */}
            {/* NÅVÆRENDE VÆR-KORT                                              */}
            {/* -------------------------------------------------------------- */}
            <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: 4, background: "var(--bg-panel)" }}>

              {/* Topplinje: emoji + overskrift */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>
                  {symbolToEmoji(weather.current.symbol)}
                </span>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                  {/* Vis stedsnavn i tittelen hvis vi har det */}
                  {selectedName ? `${t.now} — ${selectedName}` : t.now}
                </h2>
              </div>

              {/*
                Et grid av målekort: temperatur, vind, fuktighet, nedbør.
                Vi bruker .map() over en array av dataobjekter for å unngå
                å gjenta den samme div-strukturen fire ganger.
                repeat(auto-fill, minmax(160px, 1fr)) lager et responsivt
                grid som tilpasser antall kolonner etter tilgjengelig plass.
              */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.75rem" }}>
                {[
                  { label: t.temperature,  value: `${weather.current.temperature}°C`, emoji: "🌡️" },
                  { label: t.wind,         value: `${weather.current.windSpeed} m/s`,  emoji: "💨" },
                  { label: t.humidity,     value: `${weather.current.humidity}%`,      emoji: "💧" },
                  { label: t.precipitation,value: `${weather.current.precipitation} mm`, emoji: "🌧️" },
                ].map(({ label, value, emoji }) => (
                  // key={label} er påkrevd av React for å identifisere hvert listeelement
                  <div key={label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.75rem 1rem" }}>
                    {/* Liten etikettlinje */}
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                      {emoji} {label}
                    </div>
                    {/* Stor verdivis */}
                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* UKESPROGNOSE                                                     */}
            {/* -------------------------------------------------------------- */}
            <div>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: 800 }}>
                {t.forecast}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {/*
                  weather.daily er et array med én oppføring per dag.
                  Vi mapper over det og lager én rad per dag.
                  key={day.date} bruker datostrengen som unik nøkkel.
                */}
                {weather.daily.map((day) => (
                  <div
                    key={day.date}
                    style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", padding: "0.85rem 1rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-panel)" }}
                  >
                    {/* Dag-navn og emoji */}
                    <span style={{ minWidth: "180px", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.2rem" }}>{symbolToEmoji(day.symbol)}</span>
                      {formatDate(day.date)}
                    </span>

                    {/* Min/maks temperatur */}
                    <span style={{ color: "var(--text-muted)" }}>
                      🌡️ {day.tempMin}° / {day.tempMax}°C
                    </span>

                    {/* Gjennomsnittlig vind */}
                    <span style={{ color: "var(--text-muted)" }}>
                      💨 {day.avgWindSpeed} m/s
                    </span>

                    {/* Total nedbør */}
                    <span style={{ color: "var(--text-muted)" }}>
                      🌧️ {day.totalPrecipitation} mm
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
