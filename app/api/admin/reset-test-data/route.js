/**
 * app/api/admin/reset-test-data/route.js
 *
 * Christian Hjortland
 * Studentnr: 274074
 * Github - @chh303
 */

import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";

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

const TRIP_IMAGES = {
  "gvarv":          "/images/seed/iamnordic-28-10-19--3_1003920891.jpg",
  "kulturvandring": "/images/seed/001_Bo_i_Telemark_-_foto_Geir_Johansen.jpg",
  "h-yslass":       "/images/seed/20190113-050.jpg", // URL-encodet "høyslass"
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseGpx(content, filename) {
  const trkNameMatch = content.match(
    /<trk[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/,
  );
  const metaNameMatch = content.match(
    /<metadata[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/,
  );
  const nameMatch = trkNameMatch || metaNameMatch;
  const rawName = nameMatch
    ? nameMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim()
    : path.basename(filename, ".gpx");

  const descMatch = content.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
  const beskrivelse = descMatch
    ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim() || null
    : null;

  const coords = [];
  const trkptRe =
    /<trkpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = trkptRe.exec(content)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const eleMatch = m[3].match(/<ele[^>]*>([^<]+)<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;
    coords.push(ele !== null && !isNaN(ele) ? [lon, lat, ele] : [lon, lat]);
  }

  let lengde_km = 0;
  for (let i = 1; i < coords.length; i++) {
    lengde_km += haversineKm(
      coords[i - 1][1],
      coords[i - 1][0],
      coords[i][1],
      coords[i][0],
    );
  }

  const lower = filename.toLowerCase();
  const type = lower.includes("ski")
    ? "skitur"
    : lower.includes("sykkel")
      ? "sykkel"
      : "fottur";
  const vanskelighetsgrad = lower.includes("krevende")
    ? "krevende"
    : lower.includes("lett")
      ? "lett"
      : "middels";

  return {
    navn: rawName,
    beskrivelse,
    lengde_km: Math.round(lengde_km * 10) / 10 || 1,
    type,
    vanskelighetsgrad,
    geometry:
      coords.length >= 2 ? { type: "LineString", coordinates: coords } : null,
    filename,
  };
}

async function loadTripsFromGpx() {
  const gpxDir = path.join(process.cwd(), "public", "gpx");
  let files;
  try {
    files = (await fs.readdir(gpxDir)).filter((f) =>
      f.toLowerCase().endsWith(".gpx"),
    );
  } catch {
    return [];
  }

  const trips = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(gpxDir, file), "utf-8");
      trips.push(parseGpx(content, file));
    } catch {
      // skip unreadable files
    }
  }
  return trips;
}

export async function POST() {
  try {
    const { getCurrentUser } = await import("../../../../lib/auth");
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
    }

    // ── Steg 1: Slett alt ──────────────────────────────────────────────────
    await db.query(`DELETE FROM public.post_comments`).catch(() => {});          // kommentarer på innlegg
    await db.query(`DELETE FROM public.post_liked`).catch(() => {});             // likes på innlegg
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

    // ── Steg 2: Opprett brukere ─────────────────────────────────────────────
    const insertedUsers = [];

    for (const u of PRESET_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const { rows } = await db.query(
        `INSERT INTO public.users (username, email, password, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, username, email, role`,
        [u.username, u.email, hash, u.role],
      );
      insertedUsers.push(rows[0]);
    }
    const owner = insertedUsers.find((u) => u.email === "hytteeier@usn.no");

    // ── Steg 3: Opprett hytter ──────────────────────────────────────────────
    for (const c of PRESET_CABINS) {
      let cabinId;
      try {
        const { rows } = await db.query(
          `INSERT INTO public.cabins
             (name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING id`,
          [c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude, owner?.id ?? null],
        );
        cabinId = rows[0].id;
      } catch (err) {
        // owner_id-kolonnen legges til av server.js ved første innlogging; fallback uten den.
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

      for (let i = 0; i < c.images.length; i++) {
        await db.query(
          `INSERT INTO public.cabin_images (cabin_id, image_url, sort_order) VALUES ($1, $2, $3)`,
          [String(cabinId), c.images[i], i],
        );
      }
    }

    // ── Steg 4: Last inn turer ──────────────────────────────────────────────
    const trips = await loadTripsFromGpx();

    for (const t of trips) {
      const imageEntry = Object.entries(TRIP_IMAGES).find(([keyword]) =>
        t.filename.toLowerCase().includes(keyword)
      );
      const bilde_url = imageEntry ? imageEntry[1] : null;

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

    return NextResponse.json({
      success: true,
      message: `Testdata tilbakestilt (${trips.length} tur${trips.length !== 1 ? "er" : ""} lastet inn)`,
    });
  } catch (e) {
    console.error("reset-test-data error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Ukjent feil" },
      { status: 500 },
    );
  }
}
