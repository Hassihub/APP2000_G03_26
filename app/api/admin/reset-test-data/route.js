/**
 * app/api/admin/reset-test-data/route.js
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 */

// Next.js API-ruter bruker NextResponse for å sende svar tilbake til nettleseren.
import { NextResponse } from "next/server";

// db er en tilkobling til databasen vår (PostgreSQL på CockroachDB).
// Den er definert i lib/db.js og brukes til å sende SQL-spørringer.
import db from "../../../../lib/db";

// bcrypt er et bibliotek for å hashe passord.
// Man lagrer aldri passord i klartekst i databasen – man lagrer en hash.
// En hash er en enveis-transformasjon: "hemmelig" → "$2b$10$xyz..."
// Man kan ikke gå baklengs fra hashen til passordet.
import bcrypt from "bcrypt";

// fs (file system) er et innebygd Node.js-modul for å lese/skrive filer.
// Vi bruker "fs/promises" for å bruke async/await-varianten.
import fs from "fs/promises";

// path er et innebygd Node.js-modul for å håndtere filstier
// på en måte som fungerer på tvers av Windows/Mac/Linux.
import path from "path";

// ── Forhåndsinnstilte brukere ─────────────────────────────────────────────────
// Dette er en array av objekter. Hvert objekt beskriver én bruker
// som skal opprettes i databasen ved reset. "role" styrer hva brukeren
// har tilgang til i applikasjonen (ADMIN, UTLEIER, USER).
const PRESET_USERS = [
  {
    username: "Bruker1",
    email: "bruker1@usn.no",
    password: "hemmelig",
    role: "ADMIN",
  },
  {
    username: "Bruker2",
    email: "bruker2@usn.no",
    password: "hemmelig",
    role: "TURLEDER",
  },
  {
    username: "Bruker3",
    email: "bruker3@usn.no",
    password: "hemmelig",
    role: "UTLEIER",
  },
  {
    username: "Bruker4",
    email: "bruker4@usn.no",
    password: "hemmelig",
    role: "USER",
  },
  {
    username: "Bruker5",
    email: "bruker5@usn.no",
    password: "hemmelig",
    role: "USER",
  },
  {
    username: "Bruker6",
    email: "bruker6@usn.no",
    password: "hemmelig",
    role: "USER",
  },
];
/* bruker1@usn.no (admin)
bruker2@usn.no (turleder)
bruker3@usn.no (hytteeier)
bruker4@usn.no (bruker)
bruker5@usn.no (bruker)
bruker6@usn.no (bruker) */

// ── Forhåndsinnstilte hytter ──────────────────────────────────────────────────
// 4 fiktive hytter i Bø i Telemark.
// latitude/longitude er GPS-koordinater (breddegrad/lengdegrad).
// amenities er en liste over fasiliteter – lagres som et tekstarray i databasen.
const PRESET_CABINS = [
  {
    name: "Lifjellhytta",
    description:
      "Koselig hytte med utsikt over Lifjell. Perfekt for turer i nærområdet.",
    location: "Bø i Telemark",
    price_per_night: 950,
    capacity: 6,
    amenities: ["WiFi", "Parkering", "Vedovn", "Kjøkken"],
    latitude: 59.4512,
    longitude: 9.0721,
    images: [
      "/images/seed/001_Bo_i_Telemark_-_foto_Geir_Johansen.jpg",
      "/images/seed/iamnordic-28-10-19--3_1003920891.jpg",
      "/images/seed/20190113-050.jpg",
    ],
  },
  {
    name: "Skogshytta Bø",
    description:
      "Rolig hytte midt i skogen, nær Bø Sommarland. Ideell for barnefamilier.",
    location: "Bø i Telemark",
    price_per_night: 750,
    capacity: 4,
    amenities: ["Parkering", "Terrasse", "Grill"],
    latitude: 59.4198,
    longitude: 9.0634,
    images: [
      "/images/seed/20150926-078-1024x569.jpg",
      "/images/seed/20190113-244.jpg",
      "/images/seed/eu-assets.simpleview-europe.jpg",
    ],
  },
  {
    name: "Dalhytta Gvarv",
    description:
      "Moderne hytte i rolig dalstrøk nær Bø. Flott utgangspunkt for fjellturer.",
    location: "Bø i Telemark",
    price_per_night: 1100,
    capacity: 8,
    amenities: ["WiFi", "Badstue", "Parkering", "Vedovn", "Sykkelutleie"],
    latitude: 59.3945,
    longitude: 9.0312,
    images: [
      "/images/seed/20190710-371-360x240.jpg",
      "/images/seed/20190716-268-360x240.jpg",
      "/images/seed/images.jpg",
    ],
  },
  {
    name: "Utsiktshytta Notodden",
    description:
      "Høytliggende hytte med fantastisk utsikt over Telemarkslandskapet.",
    location: "Bø i Telemark",
    price_per_night: 1250,
    capacity: 5,
    amenities: ["WiFi", "Terrasse", "Vedovn", "Kjøkken", "Parkering"],
    latitude: 59.4367,
    longitude: 9.1045,
    images: [
      "/images/seed/images222.jpg",
      "/images/seed/IMG_9228.JPG",
      "/images/seed/001_Bo_i_Telemark_-_foto_Geir_Johansen.jpg",
    ],
  },
];

// ── Forhåndsinnstilte sosiale innlegg ────────────────────────────────────────
// Hvert innlegg kobles til én av brukerne via userIndex (indeks i PRESET_USERS).
// image er filnavnet på et bilde fra public/images/seed/ som leses og lagres
// som binærdata i post_pictures-tabellen.
// hoursAgo brukes til å spre innleggene utover i tid slik at feeden ser naturlig ut.
const PRESET_POSTS = [
  {
    userIndex: 3, // Bruker4
    caption: "Helgetur til Lifjell! Sola belyste hele dalen – nesten for vakkert. Anbefalt for alle 🏔️☀️",
    image: "001_Bo_i_Telemark_-_foto_Geir_Johansen.jpg",
    hoursAgo: 2,
  },
  {
    userIndex: 4, // Bruker5
    caption: "Skogsstien rundt Bø var perfekt i dag! Spiste nistepakke ved bekken. Livet er bra 😄",
    image: "iamnordic-28-10-19--3_1003920891.jpg",
    hoursAgo: 24,
  },
  {
    userIndex: 1, // Bruker2 (Turleder)
    caption: "Guidet 12 km-tur gjennomført! Alle fullførte selv i bakkene. Neste tur om to uker 💪",
    image: "20190113-050.jpg",
    hoursAgo: 48,
  },
  {
    userIndex: 5, // Bruker6
    caption: "Første vintertur i år! Snøen lå som et hvitt teppe og det var helt stille ❄️",
    image: "20190113-244.jpg",
    hoursAgo: 72,
  },
  {
    userIndex: 2, // Bruker3 (Utleier)
    caption: "En times gåtur etter en lang uke – nok til å nullstille hodet. Kom deg ut i helgen! 🌿",
    image: "20190710-371-360x240.jpg",
    hoursAgo: 120,
  },
];

// Kobler GPX-filnavn til et forsidebilde for turen.
// Nøklene er unike ord fra filnavnet (lowercase), verdiene er bilde-URL-er.
const TRIP_IMAGES = {
  "gvarv":          "/images/seed/iamnordic-28-10-19--3_1003920891.jpg",
  "kulturvandring": "/images/seed/001_Bo_i_Telemark_-_foto_Geir_Johansen.jpg",
  "h-yslass":       "/images/seed/20190113-050.jpg", // URL-encodet "høyslass"
};

// ── GPX-hjelpe­funksjoner ─────────────────────────────────────────────────────

// Haversine-formelen regner ut avstanden i kilometer mellom to GPS-punkter.
// Jordas overflate er krum, så vi kan ikke bruke vanlig Pytagoras.
// Haversine tar høyde for kurvingen og gir et nøyaktig resultat.
//
// Parametere:
//   lat1, lon1 – koordinater for punkt 1 (breddegrad, lengdegrad)
//   lat2, lon2 – koordinater for punkt 2
// Returnerer: avstand i kilometer
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Jordas radius i kilometer

  // Konverter grader til radianer (Math-funksjonene i JS bruker radianer)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine-formelen (matematisk beregning av kurveavstand)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  // atan2 gir vinkelen, ganget med 2*R gir distansen langs jordoverflaten
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// parseGpx leser innholdet i én GPX-fil og trekker ut det vi trenger.
// GPX er et XML-format for GPS-ruter (fra f.eks. UT.no).
//
// Parametere:
//   content  – filinnholdet som en tekststreng
//   filename – filnavnet, brukes til å bestemme type og vanskelighetsgrad
// Returnerer: et objekt med feltene som trengs for trips-tabellen
function parseGpx(content, filename) {
  // Regex (regulært uttrykk) for å lete etter tekst-mønstre i en streng.
  // Her leter vi etter <name>...</name> inne i <trk>-blokken.
  // [\s\S]*? betyr: "hvilken som helst tegn (inkl. linjeskift), så kort som mulig"
  const trkNameMatch = content.match(
    /<trk[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/,
  );

  // GPX fra UT.no har navn i <metadata><name> i stedet for <trk><name>.
  // Vi prøver begge steder og bruker det første som treffer.
  const metaNameMatch = content.match(
    /<metadata[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/,
  );

  // Velg det første treffet (trkNameMatch har prioritet)
  const nameMatch = trkNameMatch || metaNameMatch;

  const rawName = nameMatch
    ? // Noen GPX-filer pakker inn tekst i CDATA: <![CDATA[Navn her]]>
      // .replace() fjerner CDATA-innpakningene og beholder bare teksten.
      nameMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim()
    : // Fallback: bruk filnavnet uten .gpx-ending hvis ingen <name>-tag finnes
      path.basename(filename, ".gpx");

  // Hent beskrivelse fra <desc>-taggen (valgfri i GPX)
  const descMatch = content.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
  const beskrivelse = descMatch
    ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim() || null
    : null;

  // Hent alle GPS-koordinater fra <trkpt>-tagger.
  // En GPX-fil kan ha tusenvis av slike punkter.
  // Regex-en fanger lat, lon og innholdet mellom <trkpt> og </trkpt>.
  const coords = [];
  const trkptRe =
    /<trkpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;

  // exec() med /g-flagg finner ett treff av gangen i en løkke.
  // m[1] = lat, m[2] = lon, m[3] = innholdet mellom taggene (inkl. <ele>)
  let m;
  while ((m = trkptRe.exec(content)) !== null) {
    const lat = parseFloat(m[1]); // gjør tekststrengen "59.4512" om til tall
    const lon = parseFloat(m[2]);

    // Hopp over punktet hvis lat eller lon ikke er et gyldig tall
    if (isNaN(lat) || isNaN(lon)) continue;

    // Prøv å hente høyde (elevation) fra <ele>-taggen inne i trkpt
    const eleMatch = m[3].match(/<ele[^>]*>([^<]+)<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;

    // GeoJSON-format: [longitude, latitude] (merk: lon før lat er GeoJSON-standard)
    // Hvis vi har høyde, legg til som tredje element: [lon, lat, høyde]
    coords.push(ele !== null && !isNaN(ele) ? [lon, lat, ele] : [lon, lat]);
  }

  // Regn ut total distanse ved å summere Haversine-avstanden mellom
  // hvert par av nabopunkter langs hele ruten.
  let lengde_km = 0;
  for (let i = 1; i < coords.length; i++) {
    // coords[i-1] og coords[i] er to nabopunkter.
    // [0] = lon, [1] = lat – vi sender lat, lon til haversineKm (den rekkefølgen).
    lengde_km += haversineKm(
      coords[i - 1][1],
      coords[i - 1][0],
      coords[i][1],
      coords[i][0],
    );
  }

  // Bestem type tur basert på nøkkelord i filnavnet (små bokstaver).
  // .includes() sjekker om teksten inneholder en delstreng.
  const lower = filename.toLowerCase();
  const type = lower.includes("ski")
    ? "skitur"
    : lower.includes("sykkel")
      ? "sykkel"
      : "fottur"; // standard hvis ingen nøkkelord matcher

  // Bestem vanskelighetsgrad på samme måte
  const vanskelighetsgrad = lower.includes("krevende")
    ? "krevende"
    : lower.includes("lett")
      ? "lett"
      : "middels"; // standard

  return {
    navn: rawName,
    beskrivelse,
    // Math.round(...* 10) / 10 runder av til én desimal, f.eks. 12.347 → 12.3
    // "|| 1" er fallback: hvis distansen ble 0 (f.eks. bare ett punkt), sett til 1
    lengde_km: Math.round(lengde_km * 10) / 10 || 1,
    type,
    vanskelighetsgrad,
    // Bygg et GeoJSON LineString-objekt – dette er formatet kartet forventer.
    // Vi trenger minst 2 punkter for å danne en linje.
    geometry:
      coords.length >= 2 ? { type: "LineString", coordinates: coords } : null,
    // Behold filnavnet så reset-ruten kan slå opp riktig bilde fra TRIP_IMAGES
    filename,
  };
}

// loadTripsFromGpx leser alle .gpx-filer fra public/gpx/ og parser dem.
// Returnerer en array av tur-objekter klare til å settes inn i databasen.
async function loadTripsFromGpx() {
  // process.cwd() er rotmappen til prosjektet (der package.json ligger).
  // path.join() setter sammen mappedeler på riktig måte for operativsystemet.
  const gpxDir = path.join(process.cwd(), "public", "gpx");

  let files;
  try {
    // fs.readdir() leser alle filnavn i mappen.
    // .filter() beholder bare filer som slutter på .gpx (case-insensitiv).
    files = (await fs.readdir(gpxDir)).filter((f) =>
      f.toLowerCase().endsWith(".gpx"),
    );
  } catch {
    // Hvis mappen ikke finnes eller er tom, returner tom array.
    // Dette betyr at reset fungerer fint selv uten GPX-filer.
    return [];
  }

  const trips = [];
  for (const file of files) {
    try {
      // Les filinnholdet som UTF-8 tekst (norske tegn støttes)
      const content = await fs.readFile(path.join(gpxDir, file), "utf-8");
      // Parser GPX-innholdet og legg resultatet i lista
      trips.push(parseGpx(content, file));
    } catch {
      // Hopp over filer som ikke kan leses (f.eks. ødelagt XML)
    }
  }
  return trips;
}

// ── Hoved-API-handler ─────────────────────────────────────────────────────────

// POST er HTTP-metoden knappen sender. Next.js kaller denne funksjonen
// automatisk når nettleseren sender en POST til /api/admin/reset-test-data.
export async function POST() {
  try {
    // Sjekk at innlogget bruker er ADMIN før vi gjør noe som helst.
    // getCurrentUser() leser sesjons-cookien og slår opp brukeren i databasen.
    // Hvis brukeren ikke er logget inn eller ikke er ADMIN, avvises forespørselen
    // med HTTP 403 (Forbidden) – dette gjelder selv om noen kjenner URL-en.
    const { getCurrentUser } = await import("../../../../lib/auth");
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
    }

    // ── Steg 1: Slett alt eksisterende innhold ──────────────────────────────
    // Vi sletter i riktig rekkefølge for å unngå feil med fremmednøkler:
    // tabeller som refererer til andre tabeller slettes FØR de de refererer til.
    // .catch(() => {}) betyr: ignorer feil hvis tabellen ikke finnes enda
    // (noen tabeller opprettes først når de brukes for første gang).

    await db.query(`DELETE FROM public.post_comments`).catch(() => {});          // kommentarer på innlegg
    await db.query(`DELETE FROM public.post_liked`).catch(() => {});             // likes på innlegg
    await db.query(`DELETE FROM public.post_pictures`).catch(() => {});          // bilder tilknyttet innlegg
    await db.query(`DELETE FROM public.posts`).catch(() => {});                  // innlegg i sosial-feeden
    await db.query(`DELETE FROM public.user_follows`).catch(() => {});           // følger-relasjoner
    await db.query(`DELETE FROM public.messages`).catch(() => {});               // meldinger mellom brukere
    await db.query(`DELETE FROM public.trip_registrations`).catch(() => {});     // påmeldinger til avreiser
    await db.query(`DELETE FROM public.trip_departures`).catch(() => {});        // planlagte avreiser
    await db.query(`DELETE FROM public.trip_date_options`).catch(() => {});      // datoalternativer for fleksible turer
    await db.query(`DELETE FROM public.trip_interest`).catch(() => {});          // interessemeldinger på turer
    await db.query(`DELETE FROM public.route_verification_cabins`).catch(() => {}); // koblingstabell rute↔hytte
    await db.query(`DELETE FROM public.routes_to_verification`).catch(() => {}); // ruter som venter på godkjenning
    await db.query(`DELETE FROM public.reservations`).catch(() => {});           // hyttebooker
    await db.query(`DELETE FROM public.cabin_images`).catch(() => {});           // hyttebilder
    await db.query(`DELETE FROM public.cabins`).catch(() => {});                 // hytter
    await db.query(`DELETE FROM public.tiu_trips`).catch(() => {});              // TiU-tilknytning for turer
    await db.query(`DELETE FROM public.trips`).catch(() => {});                  // turer
    await db.query(`DELETE FROM public.ads`).catch(() => {});                    // annonser
    await db.query(`DELETE FROM public."session"`).catch(() => {});              // innloggingssesjoner
    await db.query(`DELETE FROM public.users`).catch(() => {});                  // brukere (sist, andre tabeller peker hit)

    // ── Steg 2: Opprett forhåndsinnstilte brukere ───────────────────────────
    // Vi lagrer id-ene etter innsetting slik at vi kan koble hytter til eier.
    const insertedUsers = [];

    for (const u of PRESET_USERS) {
      // bcrypt.hash() lager en sikker hash av passordet.
      // Tallet 10 er "salt rounds" – hvor mange ganger algoritmen kjøres.
      // Høyere tall = sikrere, men tregere. 10 er standard anbefaling.
      const hash = await bcrypt.hash(u.password, 10);

      // $1, $2, $3... er parameterplassholdere i SQL.
      // Verdiene sendes separat i arrayen [u.username, u.email, ...]
      // Dette kalles "parameteriserte spørringer" og beskytter mot SQL-injection.
      // RETURNING betyr at vi vil ha tilbake de angitte kolonnene etter innsetting.
      const { rows } = await db.query(
        `INSERT INTO public.users (username, email, password, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, username, email, role`,
        [u.username, u.email, hash, u.role],
      );

      // rows[0] er den første (og eneste) raden som ble returnert
      insertedUsers.push(rows[0]);
    }

    // Finn hytteeier-brukeren i listen vi nettopp opprettet
    // slik at vi kan sette owner_id på hyttene.
    // .find() returnerer det første elementet der betingelsen er sann.
    const owner = insertedUsers.find((u) => u.email === "hytteeier@usn.no");

    // ── Steg 3: Opprett forhåndsinnstilte hytter ───────────────────────────
    for (const c of PRESET_CABINS) {
      let cabinId;
      try {
        // RETURNING id gir oss tilbake id-en til den nyopprettede hytten
        // slik at vi kan koble bilder til riktig hytte etterpå.
        const { rows } = await db.query(
          `INSERT INTO public.cabins
             (name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING id`,
          [c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude, owner?.id ?? null],
        );
        cabinId = rows[0].id;
      } catch (err) {
        // Feilkode 42703 betyr "ukjent kolonne" i PostgreSQL.
        // owner_id-kolonnen legges til av server.js første gang noen logger inn.
        // Hvis databasen ikke har den enda, faller vi tilbake til insert uten den.
        if (err?.code === "42703" || err?.message?.includes('column "owner_id"')) {
          const { rows } = await db.query(
            `INSERT INTO public.cabins
               (name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING id`,
            [c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude],
          );
          cabinId = rows[0].id;
        } else {
          throw err;
        }
      }

      // Sett inn bilder for denne hytten i cabin_images-tabellen.
      // sort_order bestemmer rekkefølgen bildene vises i (0 = første bilde).
      for (let i = 0; i < c.images.length; i++) {
        await db.query(
          `INSERT INTO public.cabin_images (cabin_id, image_url, sort_order) VALUES ($1, $2, $3)`,
          [String(cabinId), c.images[i], i],
        );
      }
    }

    // ── Steg 4: Last inn turer fra GPX-filer ───────────────────────────────
    // Hent og parse alle .gpx-filer fra public/gpx/
    const trips = await loadTripsFromGpx();

    for (const t of trips) {
      // Slå opp bilde for turen basert på GPX-filnavnet.
      // Object.entries() gir oss [nøkkel, verdi]-par fra TRIP_IMAGES.
      // .find() leter etter et nøkkelord som finnes i filnavnet.
      const imageEntry = Object.entries(TRIP_IMAGES).find(([keyword]) =>
        t.filename.toLowerCase().includes(keyword)
      );
      const bilde_url = imageEntry ? imageEntry[1] : null;

      // JSON.stringify() gjør JavaScript-objektet om til en JSON-tekststreng
      // fordi PostgreSQL forventer JSONB-kolonner som tekst.
      await db.query(
        `INSERT INTO public.trips (navn, beskrivelse, lengde_km, type, vanskelighetsgrad, bilde_url, geometry)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          t.navn,
          t.beskrivelse,
          t.lengde_km,
          t.type,
          t.vanskelighetsgrad,
          bilde_url,
          t.geometry ? JSON.stringify(t.geometry) : null,
        ],
      );
    }

    // ── Steg 5: Opprett forhåndsinnstilte sosiale innlegg ──────────────────────
    // Bildene leses fra public/images/seed/ og lagres som binærdata (Buffer)
    // i post_pictures-tabellen, akkurat slik appen selv gjør det ved opplasting.
    const seedImgDir = path.join(process.cwd(), "public", "images", "seed");

    for (const p of PRESET_POSTS) {
      // Slå opp brukeren som skal eie innlegget via indeksen i PRESET_POSTS
      const author = insertedUsers[p.userIndex];
      if (!author) continue; // hopp over hvis indeksen er feil

      // Beregn timestamp: NOW() minus antall timer bakover i tid.
      // Dette gjør at innleggene ser ut som om de ble publisert til ulike tider.
      // interval er PostgreSQL-syntaks for tidsintervaller.
      const { rows } = await db.query(
        `INSERT INTO public.posts (userid, tripid, caption, "timestamp")
         VALUES ($1, NULL, $2, NOW() - interval '${p.hoursAgo} hours')
         RETURNING postid`,
        [author.id, p.caption],
      );
      const postid = rows[0].postid;

      // Les bildefilen fra disk og lagre som bytea i post_pictures.
      // fs.readFile() uten encoding-argument returnerer en Buffer (binærdata).
      try {
        const imageBuffer = await fs.readFile(path.join(seedImgDir, p.image));
        await db.query(
          `INSERT INTO public.post_pictures (postid, picture) VALUES ($1, $2)`,
          [postid, imageBuffer],
        );
      } catch {
        // Hopp over bildet hvis filen ikke finnes – innlegget opprettes uansett
      }
    }

    // Alt gikk bra – send suksessmelding tilbake til nettleseren.
    // Template literal (backtick-streng) lar oss sette inn variabler med ${}.
    // Ternær operator velger riktig flertallsform ("tur" vs "turer").
    return NextResponse.json({
      success: true,
      message: `Testdata tilbakestilt (${trips.length} tur${trips.length !== 1 ? "er" : ""} lastet inn)`,
    });
  } catch (e) {
    // Noe uventet gikk galt. console.error() skriver til server-loggen
    // slik at vi kan se feilen i terminalen der appen kjører.
    console.error("reset-test-data error:", e);

    // Send feilmeldingen tilbake til nettleseren med HTTP-statuskode 500
    // (500 = "Internal Server Error" – noe gikk galt på serveren).
    // e?.message bruker optional chaining: trygt selv om e er null/undefined.
    return NextResponse.json(
      { error: e?.message ?? "Ukjent feil" },
      { status: 500 },
    );
  }
}
