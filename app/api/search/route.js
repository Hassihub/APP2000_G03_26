/**
 * app/api/search/route.js
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 *
 * Dette er en Next.js API Route for global søk i FrittFram-appen.
 * Filen eksporterer en GET-funksjon som Next.js kaller automatisk
 * når noen sender en HTTP GET til /api/search?q=<søketekst>.
 *
 * Søket er delt i tre parallelle deler:
 *   1. Steder      → Nominatim (OpenStreetMap) geocoding-API
 *   2. Hytter      → PostgreSQL-spørring mot vår cabins-tabell
 *   3. Turruter    → PostgreSQL-spørring mot vår trips-tabell
 *
 * Alle tre hentes samtidig (parallelt) ved hjelp av Promise.allSettled().
 */

// NextResponse er Next.js sin hjelperklasse for å lage HTTP-responser.
// Den ligner på Response, men har ekstra hjelpemetoder som .json().
import { NextResponse } from "next/server";

// db er databasetilkoblingen vår (PostgreSQL via CockroachDB).
// Den er definert i lib/db.js og eksponerer en .query()-metode.
import db from "../../../lib/db";

/**
 * GET /api/search?q=<søketekst>
 *
 * @param {Request} request - Det innkommende HTTP-requestobjektet fra Next.js
 * @returns {NextResponse} - JSON med feltene: locations, cabins, trips, query
 */
export async function GET(request) {
  // --------------------------------------------------------------------------
  // 1. LES OG VALIDER SØKEPARAMETER
  // --------------------------------------------------------------------------
  // new URL() gjør URL-strengen om til et objekt vi kan hente parametere fra.
  const { searchParams } = new URL(request.url);

  // searchParams.get("q") henter query-parameteren, f.eks. "Oslo" fra ?q=Oslo
  // ?? "" er nullish coalescing: bruk tom streng hvis verdien er null/undefined
  // String() sikrer at vi alltid jobber med en tekstreng
  // .trim() fjerner mellomrom på starten og slutten (f.eks. "  Oslo  " → "Oslo")
  const query = String(searchParams.get("q") ?? "").trim();

  // Hvis søketeksten er tom, returner tomme resultater med en gang.
  // Dette unngår unødvendige API-kall og database-spørringer.
  if (!query) {
    return NextResponse.json(
      { locations: [], cabins: [], trips: [], query: "" },
      { status: 200 }
    );
  }

  // --------------------------------------------------------------------------
  // 2. BYGG SØKEMØNSTRE FOR SQL
  // --------------------------------------------------------------------------
  // I PostgreSQL betyr % "null eller flere vilkårlige tegn" (wildcard).
  // ILIKE er case-insensitiv LIKE (skiller ikke mellom store/små bokstaver).
  //
  // containsTerm: "%oslo%" → matcher "oslo", "Oslo i Vestfold", "moslo" osv.
  // startsWithTerm: "oslo%" → matcher "oslo", "Oslo kommune" – men IKKE "moslo"
  // Vi bruker begge i ORDER BY for å sortere treff som starter med søkeordet øverst.
  const containsTerm  = `%${query}%`; // brukes i WHERE
  const startsWithTerm = `${query}%`; // brukes i ORDER BY (prioritering)

  try {
    // --------------------------------------------------------------------------
    // 3. PARALLELLE SPØRRINGER MED Promise.allSettled()
    // --------------------------------------------------------------------------
    // Vi starter alle tre spørringene samtidig. Dette er mye raskere enn å
    // vente på én om gangen – totaltiden blir lik den tregeste, ikke summen.
    //
    // Promise.allSettled() (i motsetning til Promise.all()) venter på ALLE,
    // selv om noen feiler. Hvert resultat har:
    //   { status: "fulfilled", value: ... }  → lyktes
    //   { status: "rejected",  reason: ... } → feilet
    //
    // Dette betyr at søket fortsetter selv om f.eks. Nominatim er nede.
    const [locationResult, cabinResult, tripResult] = await Promise.allSettled([

      // ── DEL A: Steder via Nominatim (OpenStreetMap geocoding) ────────────
      // encodeURIComponent() gjør søketeksten URL-sikker: "Bø i Telemark" →
      // "B%C3%B8%20i%20Telemark" (norske tegn og mellomrom kodes)
      // limit=5 begrenser antall resultater fra Nominatim
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        {
          headers: {
            "User-Agent": "APP2000_G03_26/1.0 (student@usn.no)", // påkrevd av Nominatim
            Accept: "application/json",
            "Accept-Language": "nb-NO,en;q=0.8", // preferanse: norsk, deretter engelsk
          },
          // next.revalidate er Next.js-spesifikk caching.
          // 3600 sekunder = 1 time. Samme søk innen 1 time gir samme svar
          // uten at vi kontakter Nominatim på nytt.
          next: { revalidate: 3600 },
        }
      ),

      // ── DEL B: Hytter fra databasen ──────────────────────────────────────
      // $1 og $2 er parameterplassholdere (beskytter mot SQL-injection).
      // ILIKE er case-insensitiv (skiller ikke mellom store/små bokstaver).
      // COALESCE(description, '') behandler NULL som tom streng, slik at
      // vi ikke får feil når description er NULL i databasen.
      // amenities::text caster JSONB/array til tekst for ILIKE-søk.
      //
      // ORDER BY CASE WHEN ... THEN 0 ELSE 1 END sorterer treff som
      // starter med søkeordet (startsWithTerm) øverst – de er mest relevante.
      // Deretter sorteres etter created_at DESC (nyeste øverst).
      db.query(
        `
          SELECT id, name, description, location, price_per_night, capacity, amenities, created_at
          FROM public.cabins
          WHERE name ILIKE $1
             OR COALESCE(description, '') ILIKE $1
             OR location ILIKE $1
             OR COALESCE(amenities::text, '') ILIKE $1
          ORDER BY
            CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 30
        `,
        [containsTerm, startsWithTerm]
      ),

      // ── DEL C: Turruter fra databasen ────────────────────────────────────
      // Tilsvarende som hytter, men mot trips-tabellen.
      // Norske kolonnenavn (navn, beskrivelse, lengde_km osv.) er slik de
      // er definert i databasen vår.
      // NULLS LAST i ORDER BY sørger for at rader uten opprettet-dato
      // havner sist, ikke øverst (NULL er ellers "størst" i PostgreSQL).
      db.query(
        `
          SELECT id, navn, beskrivelse, lengde_km, type, vanskelighetsgrad, opprettet
          FROM public.trips
          WHERE navn ILIKE $1
             OR COALESCE(beskrivelse, '') ILIKE $1
             OR type ILIKE $1
             OR vanskelighetsgrad ILIKE $1
          ORDER BY
            CASE WHEN navn ILIKE $2 THEN 0 ELSE 1 END,
            opprettet DESC NULLS LAST,
            id DESC
          LIMIT 30
        `,
        [containsTerm, startsWithTerm]
      ),
    ]);

    // --------------------------------------------------------------------------
    // 4. BEHANDLE RESULTATER FRA NOMINATIM (steder)
    // --------------------------------------------------------------------------
    // Hent det faktiske svaret fra Nominatim, men bare hvis kallet lyktes.
    // .catch(() => []) er en ekstra sikkerhet: hvis JSON-parsing feiler,
    // bruk tom array i stedet for å krasje.
    const locations =
      locationResult.status === "fulfilled" && locationResult.value.ok
        ? await locationResult.value.json().catch(() => [])
        : []; // tomt array hvis Nominatim feilet

    // Nominatim returnerer steder i sitt eget format. Vi normaliserer dem
    // til et enklere format som resten av appen forstår.
    // Array.isArray() sjekker at vi faktisk fikk en array (og ikke f.eks. null).
    // Number.parseFloat() konverterer "59.91" (streng) til 59.91 (tall).
    const normalizedLocations = Array.isArray(locations)
      ? locations.map((loc) => ({
          name: loc.display_name,               // fullt lesbart navn, f.eks. "Oslo, Utopia"
          lat:  Number.parseFloat(loc.lat),     // breddegrad som tall
          lon:  Number.parseFloat(loc.lon),     // lengdegrad som tall
          type: loc.type,                       // "city", "village" osv.
        }))
      : [];

    // --------------------------------------------------------------------------
    // 5. BEHANDLE DATABASERESULTATER (hytter og turer)
    // --------------------------------------------------------------------------
    // Hent radene fra PostgreSQL-resultatet, eller tom array ved feil.
    // db.query() returnerer et objekt med en .rows-egenskap som er en array.
    const cabins = cabinResult.status === "fulfilled" ? cabinResult.value.rows : [];
    const trips  = tripResult.status  === "fulfilled" ? tripResult.value.rows  : [];

    // --------------------------------------------------------------------------
    // 6. RETURNER SAMLET SVAR
    // --------------------------------------------------------------------------
    // Vi sender alle tre resultattypene i ett objekt.
    // Klientkoden kan deretter bruke hvilke som helst av dem.
    return NextResponse.json(
      {
        locations: normalizedLocations,
        cabins,
        trips,
        query, // Send tilbake søketeksten slik at klienten vet hva den søkte etter
      },
      { status: 200 }
    );
  } catch (error) {
    // Noe uventet gikk galt (f.eks. databasetilkobling nede).
    // Vi returnerer feilmeldingen med HTTP 500 (Internal Server Error).
    // error?.message bruker optional chaining: trygt selv om error er null.
    return NextResponse.json(
      { error: error?.message || "Search failed" },
      { status: 500 }
    );
  }
}
