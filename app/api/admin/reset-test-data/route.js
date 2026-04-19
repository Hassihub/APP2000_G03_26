import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";

const PRESET_USERS = [
  { username: "Admin",     email: "admin@usn.no",     password: "hemmelig", role: "ADMIN"   },
  { username: "Hytteeier", email: "hytteeier@usn.no", password: "hemmelig", role: "UTLEIER" },
  { username: "Utleier",   email: "utleier@usn.no",   password: "hemmelig", role: "UTLEIER" },
  { username: "Bruker1",   email: "bruker1@usn.no",   password: "hemmelig", role: "USER"    },
  { username: "Bruker2",   email: "bruker2@usn.no",   password: "hemmelig", role: "USER"    },
];

const PRESET_CABINS = [
  {
    name: "Lifjellhytta",
    description: "Koselig hytte med utsikt over Lifjell. Perfekt for turer i nærområdet.",
    location: "Bø i Telemark",
    price_per_night: 950,
    capacity: 6,
    amenities: ["WiFi", "Parkering", "Vedovn", "Kjøkken"],
    latitude: 59.4512,
    longitude: 9.0721,
  },
  {
    name: "Skogshytta Bø",
    description: "Rolig hytte midt i skogen, nær Bø Sommarland. Ideell for barnefamilier.",
    location: "Bø i Telemark",
    price_per_night: 750,
    capacity: 4,
    amenities: ["Parkering", "Terrasse", "Grill"],
    latitude: 59.4198,
    longitude: 9.0634,
  },
  {
    name: "Dalhytta Gvarv",
    description: "Moderne hytte i rolig dalstrøk nær Bø. Flott utgangspunkt for fjellturer.",
    location: "Bø i Telemark",
    price_per_night: 1100,
    capacity: 8,
    amenities: ["WiFi", "Badstue", "Parkering", "Vedovn", "Sykkelutleie"],
    latitude: 59.3945,
    longitude: 9.0312,
  },
  {
    name: "Utsiktshytta Notodden",
    description: "Høytliggende hytte med fantastisk utsikt over Telemarkslandskapet.",
    location: "Bø i Telemark",
    price_per_night: 1250,
    capacity: 5,
    amenities: ["WiFi", "Terrasse", "Vedovn", "Kjøkken", "Parkering"],
    latitude: 59.4367,
    longitude: 9.1045,
  },
];

// ── GPX helpers ──────────────────────────────────────────────────────────────

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
  // Name: prefer <trk><name>, then <metadata><name>, fall back to filename stem
  const trkNameMatch = content.match(/<trk[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/);
  const metaNameMatch = content.match(/<metadata[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/);
  const nameMatch = trkNameMatch || metaNameMatch;
  const rawName = nameMatch
    ? nameMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim()
    : path.basename(filename, ".gpx");

  // Description
  const descMatch = content.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
  const beskrivelse = descMatch
    ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim() || null
    : null;

  // Track points
  const coords = [];
  const trkptRe = /<trkpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = trkptRe.exec(content)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const eleMatch = m[3].match(/<ele[^>]*>([^<]+)<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;
    coords.push(ele !== null && !isNaN(ele) ? [lon, lat, ele] : [lon, lat]);
  }

  // Distance
  let lengde_km = 0;
  for (let i = 1; i < coords.length; i++) {
    lengde_km += haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }

  // Type / difficulty from filename
  const lower = filename.toLowerCase();
  const type = lower.includes("ski") ? "skitur" : lower.includes("sykkel") ? "sykkel" : "fottur";
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
    geometry: coords.length >= 2 ? { type: "LineString", coordinates: coords } : null,
  };
}

async function loadTripsFromGpx() {
  const gpxDir = path.join(process.cwd(), "public", "gpx");
  let files;
  try {
    files = (await fs.readdir(gpxDir)).filter((f) => f.toLowerCase().endsWith(".gpx"));
  } catch {
    return []; // folder empty or missing — fine
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

// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    // Clear dependent tables first (use .catch to skip tables that don't exist yet)
    await db.query(`DELETE FROM public.post_comments`).catch(() => {});
    await db.query(`DELETE FROM public.post_liked`).catch(() => {});
    await db.query(`DELETE FROM public.posts`).catch(() => {});
    await db.query(`DELETE FROM public.user_follows`).catch(() => {});
    await db.query(`DELETE FROM public.reservations`).catch(() => {});
    await db.query(`DELETE FROM public.cabin_images`).catch(() => {});
    await db.query(`DELETE FROM public.cabins`).catch(() => {});
    await db.query(`DELETE FROM public.tiu_trips`).catch(() => {});
    await db.query(`DELETE FROM public.trips`).catch(() => {});
    await db.query(`DELETE FROM public."session"`).catch(() => {});
    await db.query(`DELETE FROM public.users`).catch(() => {});

    // Insert preset users
    const insertedUsers = [];
    for (const u of PRESET_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const { rows } = await db.query(
        `INSERT INTO public.users (username, email, password, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, username, email, role`,
        [u.username, u.email, hash, u.role]
      );
      insertedUsers.push(rows[0]);
    }

    // Assign cabins to hytteeier
    const owner = insertedUsers.find((u) => u.email === "hytteeier@usn.no");

    for (const c of PRESET_CABINS) {
      try {
        await db.query(
          `INSERT INTO public.cabins
             (name, description, location, price_per_night, capacity, amenities, latitude, longitude, owner_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude, owner?.id ?? null]
        );
      } catch (err) {
        // Fall back without owner_id if the column doesn't exist yet
        if (err?.code === "42703" || err?.message?.includes('column "owner_id"')) {
          await db.query(
            `INSERT INTO public.cabins
               (name, description, location, price_per_night, capacity, amenities, latitude, longitude, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [c.name, c.description, c.location, c.price_per_night, c.capacity, c.amenities, c.latitude, c.longitude]
          );
        } else {
          throw err;
        }
      }
    }

    // Insert trips from public/gpx/
    const trips = await loadTripsFromGpx();
    for (const t of trips) {
      await db.query(
        `INSERT INTO public.trips (navn, beskrivelse, lengde_km, type, vanskelighetsgrad, geometry)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.navn, t.beskrivelse, t.lengde_km, t.type, t.vanskelighetsgrad, t.geometry ? JSON.stringify(t.geometry) : null]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Testdata tilbakestilt (${trips.length} tur${trips.length !== 1 ? "er" : ""} lastet inn)`,
    });
  } catch (e) {
    console.error("reset-test-data error:", e);
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
