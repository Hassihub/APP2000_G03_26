/**
 * app/api/weather/route.js
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 *
 * Dette er en Next.js API Route (App Router).
 * Filen eksporterer en asynkron GET-funksjon som Next.js kaller
 * automatisk når noen gjør en HTTP GET-forespørsel til /api/weather.
 *
 * Formål: Ta imot koordinater (bredde- og lengdegrad) fra klienten,
 * hente rådata fra Yr / met.no sitt API, behandle dataene, og
 * returnere et forenklet JSON-objekt med:
 *   - current  → nåværende vær
 *   - hourly   → timeprognose for neste 48 timer
 *   - daily    → daglig prognose for neste 7 dager
 */

/**
 * GET /api/weather?lat=<tall>&lon=<tall>
 *
 * @param {Request} request - Det innkommende HTTP-requestobjektet fra Next.js.
 *   Vi bruker dette til å lese URL-parametere (lat og lon).
 *
 * @returns {Response} - Et JSON-svar med værdata, eller en feilmelding.
 */
export async function GET(request) {
  // --------------------------------------------------------------------------
  // 1. LES URL-PARAMETERE
  // --------------------------------------------------------------------------
  // new URL(request.url) gjør om URL-strengen til et URL-objekt slik at vi
  // kan lese individuelle query-parametere enkelt.
  // Eksempel-URL: /api/weather?lat=59.91&lon=10.75
  const { searchParams } = new URL(request.url);

  // searchParams.get() henter verdien til et navngitt parameter, eller null.
  const lat = searchParams.get("lat"); // breddegrad, f.eks. "59.91"
  const lon = searchParams.get("lon"); // lengdegrad, f.eks. "10.75"

  // --------------------------------------------------------------------------
  // 2. VALIDER INPUT
  // --------------------------------------------------------------------------
  // Hvis koordinatene mangler, returner en 400 Bad Request med en feilmelding.
  // Response.json() er en Next.js/Web-API-hjelpemetode som lager en
  // JSON-response med riktige Content-Type-headere automatisk.
  if (!lat || !lon) {
    return Response.json({ error: "Missing lat/lon" }, { status: 400 });
  }

  // --------------------------------------------------------------------------
  // 3. HENT DATA FRA YR / MET.NO
  // --------------------------------------------------------------------------
  // Vi pakker alt i try/catch slik at eventuelle nettverksfeil eller
  // API-feil ikke krasjer serveren, men gir klienten en pen feilmelding.
  try {
    // fetch() er den innebygde HTTP-klienten i Node.js 18+ og nettlesere.
    // Vi bruker template literals (backticks + ${}) for å sette inn lat/lon.
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      {
        headers: {
          // Met.no krever at vi oppgir hvem vi er i User-Agent-headeren.
          // Uten denne kan forespørselen bli blokkert.
          "User-Agent": "APP2000-WeatherApp/1.0 (student@usn.no)",
        },
        // next.revalidate er en Next.js-spesifikk cache-innstilling.
        // 3600 sekunder = 1 time. Next.js vil gjenbruke det cachede
        // svaret i opptil 1 time før det henter nye data fra met.no.
        // Dette er viktig for å unngå å hammre ekstern API.
        next: { revalidate: 3600 },
      },
    );

    // Hvis met.no svarer med en HTTP-feilkode (f.eks. 429 Too Many Requests
    // eller 500 Internal Server Error), kaster vi en feil manuelt.
    // response.ok er true bare for statuskoder 200-299.
    if (!response.ok) {
      throw new Error(`YR API error: ${response.status}`);
    }

    // response.json() leser responskroppen og parser den som JSON.
    // await venter på at dette async-kallet er ferdig.
    const data = await response.json();

    // met.no returnerer en stor struktur. Alle tidspunkter ligger i:
    //   data.properties.timeseries  →  en array av objekter, ett per time
    const timeseries = data.properties.timeseries;

    // --------------------------------------------------------------------------
    // 4. NÅVÆRENDE VÆR (første datapunkt = nå)
    // --------------------------------------------------------------------------
    // Det første elementet i timeseries er det tidspunktet nærmest nå.
    const current = timeseries[0];

    // data.instant.details inneholder øyeblikksdata: temp, vind, fuktighet osv.
    const details = current.data.instant.details;

    // data.next_1_hours inneholder prognose for de neste 60 minuttene,
    // inkludert nedbørmengde og et værsymbol (f.eks. "clearsky_day").
    // Vi bruker ?. (optional chaining) fordi next_1_hours kan mangle
    // noen ganger (f.eks. de siste datapunktene i serien).
    const next1h = current.data.next_1_hours;

    // Vi bygger et eget, forenklet objekt med bare det vi trenger.
    // || 0 er en fallback: hvis precipitation_amount er null/undefined, bruk 0.
    const currentWeather = {
      time: current.time, // ISO 8601 tidsstempel
      temperature: details.air_temperature, // grader Celsius
      windSpeed: details.wind_speed, // meter per sekund
      windDirection: details.wind_from_direction, // grader (0-360)
      humidity: details.relative_humidity, // prosent (0-100)
      pressure: details.air_pressure_at_sea_level, // hPa
      cloudCover: details.cloud_area_fraction, // prosent (0-100)
      precipitation: next1h?.details?.precipitation_amount || 0, // mm i neste time
      symbol: next1h?.summary?.symbol_code || "unknown", // værsymbol-kode
    };

    // --------------------------------------------------------------------------
    // 5. TIMEPROGNOSE (neste 48 timer)
    // --------------------------------------------------------------------------
    // .slice(0, 48) tar de første 48 elementene fra arrayen (0 til 47).
    // .map() lager et nytt array der hvert element er transformert.
    // Vi plukker bare ut feltene vi faktisk viser på siden.
    const hourlyForecast = timeseries.slice(0, 48).map((entry) => ({
      time: entry.time,
      temperature: entry.data.instant.details.air_temperature,
      windSpeed: entry.data.instant.details.wind_speed,
      symbol: entry.data.next_1_hours?.summary?.symbol_code || "unknown",
      precipitation:
        entry.data.next_1_hours?.details?.precipitation_amount || 0,
    }));

    // --------------------------------------------------------------------------
    // 6. DAGLIG PROGNOSE (neste 7 dager)
    // --------------------------------------------------------------------------
    // Met.no gir oss timedata, ikke dagdata. Vi må derfor selv gruppere
    // alle timene per kalenderdag og beregne min/max/gjennomsnitt.

    // byDay blir et objekt der nøkkelen er datostrengen "YYYY-MM-DD"
    // og verdien er en array med alle datapunkter den dagen.
    // Eksempel: { "2026-04-22": [entry, entry, ...], "2026-04-23": [...] }
    const byDay = {};
    for (const entry of timeseries) {
      // entry.time ser slik ut: "2026-04-22T14:00:00Z"
      // .slice(0, 10) kutter ut bare de første 10 tegnene → "2026-04-22"
      const date = entry.time.slice(0, 10);

      // Hvis denne datoen ikke finnes som nøkkel ennå, initialiser med tom array.
      if (!byDay[date]) byDay[date] = [];

      // Legg datapunktet til riktig dag.
      byDay[date].push(entry);
    }

    // Object.entries(byDay) gjør om objektet til en array av [dato, entries]-par.
    // .slice(0, 7) beholder bare de 7 første dagene.
    // .map() transformerer hvert [dato, entries]-par til et prognose-objekt.
    const dailyForecast = Object.entries(byDay)
      .slice(0, 7)
      .map(([date, entries]) => {
        // Hent alle temperaturer for dagen som en ren tallarray.
        const temps = entries.map(
          (e) => e.data.instant.details.air_temperature,
        );

        // Hent alle vindhastigheter for dagen.
        const winds = entries.map((e) => e.data.instant.details.wind_speed);

        // Summer opp nedbør fra alle 1-times-intervaller den dagen.
        // .reduce() starter med 0 og legger til verdien fra hvert element.
        const totalPrecipitation = entries.reduce((sum, e) => {
          return (
            sum + (e.data.next_1_hours?.details?.precipitation_amount || 0)
          );
        }, 0);

        // Velg et representativt værsymbol for dagen.
        // Midtdagssymbolet (kl. 12:00) er mest representativt visuelt.
        // Fallback: midterste datapunkt i arrayen.
        const noonEntry =
          entries.find((e) => e.time.includes("T12:00")) ||
          entries[Math.floor(entries.length / 2)];

        // Vi prøver 6-timers-symbolet først (mer stabilt), deretter 1-timers.
        const symbol =
          noonEntry?.data.next_6_hours?.summary?.symbol_code ||
          noonEntry?.data.next_1_hours?.summary?.symbol_code ||
          "unknown";

        return {
          date, // "YYYY-MM-DD"
          tempMin: Math.round(Math.min(...temps)), // laveste temp
          tempMax: Math.round(Math.max(...temps)), // høyeste temp
          avgWindSpeed: Math.round(
            winds.reduce((a, b) => a + b, 0) / winds.length, // gjennomsnittlig vind
          ),
          // Runder nedbør til én desimal: Math.round(x * 10) / 10
          totalPrecipitation: Math.round(totalPrecipitation * 10) / 10,
          symbol,
        };
      });

    // --------------------------------------------------------------------------
    // 7. RETURNER FERDIG BEHANDLET DATA
    // --------------------------------------------------------------------------
    // Vi sender tilbake ett samlet objekt med tre seksjoner.
    // Klienten (page.js) bruker alle tre.
    return Response.json({
      current: currentWeather,
      hourly: hourlyForecast,
      daily: dailyForecast,
    });
  } catch (error) {
    // Hvis noe gikk galt (nettverksfeil, JSON-parse-feil osv.),
    // logg feilen (vises bare i server-terminalen, ikke til brukeren)
    // og returner en generisk 500-feil til klienten.
    console.error("Weather API error:", error);
    return Response.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
