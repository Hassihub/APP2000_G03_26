import { NextResponse } from "next/server";
import db from "../../../../lib/db";
import bcrypt from "bcrypt";

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

    return NextResponse.json({ success: true, message: "Testdata tilbakestilt" });
  } catch (e) {
    console.error("reset-test-data error:", e);
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
