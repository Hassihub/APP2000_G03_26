/**
 * server.js
 *
 * Author: Hasnain Malik
 *
 * Egendefinert Express-server som wrapper Next.js-applikasjonen.
 * Håndterer all autentisering via Passport.js (LocalStrategy med bcrypt),
 * sesjoner lagret i PostgreSQL, og definerer Express-endepunkter for:
 *   - POST /api/auth/register       → Registrering av ny bruker
 *   - POST /api/auth/login          → Innlogging med e-post og passord
 *   - POST /api/auth/logout         → Utlogging og destruksjon av sesjon
 *   - GET  /api/auth/me             → Hent innlogget bruker
 *   - POST /api/auth/forgot-password → Tilbakestill passord
 *   - POST /api/auth/change-password → Endre passord (innlogget)
 *   - POST /api/auth/delete-account  → Slett brukerkonto
 *   - GET/PUT /api/profile          → Hent/oppdater brukerprofil
 *   - GET/POST /api/messages        → Meldingssystem mellom brukere
 *
 * Alle passord hashes med bcrypt (10 salt-runder) før lagring i databasen.
 * Sesjoner lagres i PostgreSQL-tabellen "session" via connect-pg-simple.
 * Et "sid"-cookie speiles fra express-session til Next.js App Router,
 * slik at lib/auth.js kan verifisere sesjoner i API-ruter.
 */

const express = require("express");
const next = require("next");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Last .env-fil i utviklingsmodus (ikke nødvendig i produksjon)
try {
  if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }
} catch (e) {
  // Ignorer hvis dotenv ikke er installert
}

const { getDatabaseConfig } = require("./lib/db-config.cjs");

const dev = process.env.NODE_ENV !== "production";
const appNext = next({ dev });
const handle = appNext.getRequestHandler(); // Next.js request-handler for alt som ikke er Express-ruter

const port = process.env.PORT || 3000;

// PostgreSQL-tilkobling delt mellom auth-logikk og sesjonslagring
const pool = new Pool(getDatabaseConfig());
const publicDir = path.join(process.cwd(), "public");
const fallbackImagePath = path.join(publicDir, "images", "fjell.jpg");

/**
 * Middleware som serverer statiske filer fra /public med fallback-bilde.
 * Brukes for brukerbilder i /uploads/ og profilbilde-fallback.
 */
function servePublicAssetOrFallback(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  let requestPath = req.path;

  try {
    requestPath = decodeURIComponent(new URL(req.originalUrl, `http://${req.headers.host || "localhost"}`).pathname);
  } catch {
    // Behold rå sti hvis dekoding feiler
  }

  // Spesialhåndtering for standard profilbilde-sti
  if (requestPath === "/images/profilbilde.jpg") {
    return res.sendFile(fallbackImagePath);
  }

  // Serve opplastede brukerbilder, med fallback til fjell.jpg hvis filen mangler
  if (requestPath.startsWith("/uploads/")) {
    const assetPath = path.join(publicDir, requestPath);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }

    return res.sendFile(fallbackImagePath);
  }

  return next();
}

// Cache for brukerkolonner – brukes til å dynamisk oppdage hvilke kolonner som finnes i users-tabellen
let userColumnsPromise = null;

/**
 * Fjerner passord-feltet fra et bruker-objekt før det sendes til klienten.
 * Sikrer at hashed passord aldri eksponeres via API-svar.
 */
function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
  return safe;
}

/**
 * Sletter session-cookie fra nettleseren.
 * Brukes ved utlogging og sletting av konto.
 */
function clearSessionCookie(res) {
  res.clearCookie("connect.sid", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Henter og cacher en liste over alle kolonner i users-tabellen.
 * Brukes i PUT /api/profile for å bygge dynamiske UPDATE-spørringer.
 */
async function getUserColumns() {
  if (!userColumnsPromise) {
    userColumnsPromise = pool
      .query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'`
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)))
      .catch((error) => {
        userColumnsPromise = null;
        throw error;
      });
  }

  return userColumnsPromise;
}

/**
 * Legger til eventuelle manglende valgfrie kolonner i users-tabellen.
 * Kjøres ved serveroppstart for å sikre at databaseschema er oppdatert.
 */
async function ensureUserColumns() {
  const cols = [
    "bio TEXT",
    "phone TEXT",
    "dob DATE",
    "age INTEGER",
    "interests TEXT DEFAULT '[]'",
    "radius_km INTEGER DEFAULT 50",
    "banner_image TEXT",
    "notifications BOOLEAN DEFAULT TRUE",
    "theme TEXT DEFAULT 'Lys'",
    "email_notifications BOOLEAN DEFAULT FALSE",
    "location_sharing BOOLEAN DEFAULT FALSE",
    "public_profile BOOLEAN DEFAULT TRUE",
  ];
  for (const col of cols) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
  }
  userColumnsPromise = null; // Nullstill cache etter kolonner er lagt til
}

/**
 * Returnerer første ikke-tomme verdi fra source for nøklene i rekkefølge.
 * Brukes for å håndtere at ulike database-schema kan ha ulike kolonnenavn.
 */
function pickFirstValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

/** Konverterer ulike verdityper til boolean med valgfri fallback. */
function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

/** Beregner alder i hele år basert på fødselsdato. */
function calculateAge(dob) {
  if (!dob) return "";

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "";

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
}

/**
 * Bygger en full profilpayload for en bruker med siste tur og transaksjoner.
 * Brukes av GET /api/profile for å sende brukerdata til klienten.
 */
async function buildProfilePayload(user) {
  const fullUser = await findUserById(user.id);

  let latestTrip = null;
  let transactions = [];

  try {
    const latestTripResult = await pool.query(
      `SELECT navn, beskrivelse, bilde_url, vanskelighetsgrad, lengde_km
       FROM public.trips
       ORDER BY id DESC
       LIMIT 1`
    );

    latestTrip = latestTripResult.rows[0] || null;
  } catch (error) {
    console.error("buildProfilePayload latestTrip error", error);
  }

  try {
    // Hent brukerens siste 10 reservasjoner for transaksjonshistorikk
    if (fullUser?.email) {
      const reservationsResult = await pool.query(
        `SELECT r.start_date,
                c.name AS cabin_name,
                c.price_per_night
         FROM public.reservations r
         LEFT JOIN public.cabins c ON c.id = r.cabin_id
         WHERE r.guest_email = $1
         ORDER BY r.created_at DESC
         LIMIT 10`,
        [fullUser.email]
      );

      transactions = reservationsResult.rows.map((row) => ({
        date: row.start_date,
        amount: row.price_per_night
          ? `${row.price_per_night} NOK`
          : "Ukjent pris",
        desc: row.cabin_name || "Reservasjon",
      }));
    }
  } catch (error) {
    console.error("buildProfilePayload reservations error", error);
  }

  // Hent profil-felter med fallback på tvers av ulike kolonnenavn-konvensjoner
  const dob = pickFirstValue(fullUser, ["dob", "birth_date", "date_of_birth"], "");
  const age = pickFirstValue(fullUser, ["age"], calculateAge(dob));
  const profileImage = pickFirstValue(
    fullUser,
    ["profile_image", "avatar_url", "avatar", "image_url"],
    "/images/fjell.jpg"
  );
  const bannerImage = pickFirstValue(
    fullUser,
    ["banner_image", "banner_url"],
    null
  );

  return {
    id: fullUser.id,
    role: fullUser.role || "",
    name: pickFirstValue(fullUser, ["username", "name", "full_name"], "Bruker"),
    dob,
    age,
    phone: pickFirstValue(fullUser, ["phone", "phone_number"], ""),
    email: fullUser.email || "",
    bio: pickFirstValue(fullUser, ["bio", "about"], ""),
    profileImage,
    bannerImage,
    lastTrip: latestTrip
      ? {
          title: latestTrip.navn,
          date: "Siste registrerte tur",
          description:
            latestTrip.beskrivelse || "Ingen beskrivelse registrert for turen.",
          image: latestTrip.bilde_url || "/images/fjell.jpg",
          difficulty: latestTrip.vanskelighetsgrad || "Ukjent",
          distance: latestTrip.lengde_km
            ? `${latestTrip.lengde_km} km`
            : "Ukjent",
          duration: "Ikke oppgitt",
          elevation: "Ikke oppgitt",
          rating: 4,
          location: latestTrip.navn,
        }
      : {
          title: "Ingen tur registrert",
          date: "",
          description: "Du har ingen registrerte turer ennå.",
          image: "/images/fjell.jpg",
          difficulty: "Ukjent",
          distance: "Ukjent",
          duration: "Ukjent",
          elevation: "Ukjent",
          rating: 0,
          location: "",
        },
    transactions,
    payment: {
      card: "Ikke registrert",
      billing: transactions[0]?.date || "Ingen fakturaperiode",
    },
    settings: {
      notifications: toBoolean(
        pickFirstValue(fullUser, ["notifications", "notifications_enabled"], true),
        true
      ),
      theme: pickFirstValue(fullUser, ["theme"], "Lys"),
      emailNotifications: toBoolean(
        pickFirstValue(fullUser, ["email_notifications", "emailNotifications"], false),
        false
      ),
      locationSharing: toBoolean(
        pickFirstValue(fullUser, ["location_sharing", "locationSharing"], false),
        false
      ),
      publicProfile: toBoolean(
        pickFirstValue(fullUser, ["public_profile", "publicProfile"], true),
        true
      ),
    },
    interests: (() => {
      try { return JSON.parse(fullUser?.interests || "[]"); } catch { return []; }
    })(),
    radius_km: fullUser?.radius_km != null ? Number(fullUser.radius_km) : 50,
  };
}

/** Slår opp en bruker i databasen basert på e-post (case-insensitive). */
async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

/** Slår opp en bruker i databasen basert på ID. */
async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

/**
 * Sletter alle sesjoner tilhørende en bruker fra session-tabellen.
 * Brukes etter passordtilbakestilling for å tvinge ny innlogging.
 */
async function clearUserSessions(userId) {
  if (!userId) {
    return;
  }

  try {
    await pool.query(
      `DELETE FROM session
       WHERE sess -> 'passport' ->> 'user' = $1`,
      [String(userId)]
    );
  } catch (error) {
    console.error("clearUserSessions error", error);
  }
}

// ============================================================
// PASSPORT.JS KONFIGURASJON
// ============================================================

/**
 * LocalStrategy: verifiserer e-post og passord ved innlogging.
 * 1. Slår opp bruker basert på e-post.
 * 2. Sammenligner oppgitt passord med lagret bcrypt-hash.
 * 3. Returnerer sanitisert bruker-objekt (uten passord-hash) ved suksess.
 */
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        if (!user) {
          // Gi samme feilmelding for ukjent e-post og feil passord (timing-attack-beskyttelse)
          return done(null, false, { message: "Feil e-post eller passord" });
        }

        // bcrypt.compare håndterer salt automatisk og er konstant-tids
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return done(null, false, { message: "Feil e-post eller passord" });
        }

        return done(null, sanitizeUser(user));
      } catch (err) {
        return done(err);
      }
    }
  )
);

/**
 * serializeUser: lagrer kun bruker-ID i sesjonen (minimerer sesjonsstørrelse).
 * Kjøres én gang ved innlogging.
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * deserializeUser: henter full brukerdata fra databasen basert på ID i sesjonen.
 * Kjøres ved hvert autentisert request for å populere req.user.
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    if (!user) return done(null, false);
    return done(null, sanitizeUser(user));
  } catch (err) {
    return done(err);
  }
});

// ============================================================
// EXPRESS APP OG MIDDLEWARE
// ============================================================

appNext.prepare().then(() => {
  const app = express();

  // Nødvendig for korrekte IP-adresser og secure cookies bak Heroku-proxy
  app.set("trust proxy", 1);

  // Separat router for auth-endepunkter med body-parsing middleware
  const authRouter = express.Router();
  authRouter.use(express.json());
  authRouter.use(express.urlencoded({ extended: true }));

  // Sesjonslagring i PostgreSQL med connect-pg-simple.
  // Tabellen "session" må opprettes manuelt (createTableIfMissing: false)
  // fordi CockroachDB ikke støtter DEFERRABLE som brukes av standard DDL.
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      rolling: true, // Forleng sesjonens levetid ved aktivitet
      cookie: {
        maxAge: 30 * 60 * 1000, // 30 minutters inaktivitetstimeout
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  // Speil session-ID til en "sid"-cookie som Next.js App Router kan lese.
  // lib/auth.js bruker denne for å autentisere forespørsler i API-ruter.
  app.use((req, res, next) => {
    if (req.sessionID) {
      res.cookie("sid", req.sessionID, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dager
      });
    }
    next();
  });

  // Initialiser Passport og koble det til express-session
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(servePublicAssetOrFallback);

  // Legg til body-parsing kun for utvalgte Express-ruter
  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });

  app.use("/api/profile", jsonParser, urlencodedParser);
  app.use("/api/messages", jsonParser, urlencodedParser);
  app.use("/api/auth/forgot-password", jsonParser, urlencodedParser);

  // ============================================================
  // AUTH-ENDEPUNKTER
  // ============================================================

  /**
   * POST /api/auth/register
   * Registrerer ny bruker med hashet passord.
   * Sjekker at e-post/brukernavn ikke allerede er i bruk.
   * Logger inn brukeren automatisk etter vellykket registrering.
   */
  authRouter.post("/register", async (req, res) => {
    const { username, email, password, role } = req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Brukernavn, e-post og passord er påkrevd" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Passord må være minst 8 tegn" });
    }

    // Begrens tillatte roller ved registrering (ADMIN kan ikke velges)
    const cleanRole = String(role ?? "").trim().toUpperCase();
    const allowedRoles = ["USER", "UTLEIER"];
    const roleValue = allowedRoles.includes(cleanRole) ? cleanRole : "USER";

    try {
      // Kontroller at e-post og brukernavn er unike
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE email = $1 OR username = $2",
        [email.toLowerCase(), username]
      );

      if (existing.rowCount > 0) {
        return res
          .status(400)
          .json({ error: "E-post eller brukernavn er allerede i bruk" });
      }

      // Hash passord med bcrypt (10 salt-runder) før lagring
      const hash = await bcrypt.hash(password, 10);

      const insertResult = await pool.query(
        "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
        [username, email.toLowerCase(), hash, roleValue]
      );

      const user = sanitizeUser(insertResult.rows[0]);

      // Logg inn brukeren automatisk via Passport etter registrering
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Kunne ikke logge inn" });
        }
        return res.json({ user });
      });
    } catch (err) {
      console.error("/api/auth/register error", err);
      return res.status(500).json({ error: "Noe gikk galt" });
    }
  });

  /**
   * POST /api/auth/login
   * Logger inn brukeren via Passport LocalStrategy.
   * Passport sammenligner passord mot bcrypt-hash i databasen.
   * Returnerer sanitisert bruker-objekt ved suksess.
   */
  authRouter.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res
          .status(401)
          .json({ error: info?.message || "Ugyldig pålogging" });
      }

      // Opprett Passport-sesjon og sett session-cookie
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ user });
      });
    })(req, res, next);
  });

  /**
   * POST /api/auth/forgot-password
   * Tilbakestiller passord uten å kreve innlogging.
   * Finner bruker via e-post, hasher nytt passord og sletter eksisterende sesjoner.
   * OBS: Ingen e-postbekreftelse – brukeren trenger kun å kjenne e-postadressen.
   */
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email, password, confirmPassword } = req.body || {};

    const nextPassword = typeof password === "string" ? password : "";
    const confirmedPassword =
      typeof confirmPassword === "string" ? confirmPassword : "";

    if (!email || !nextPassword || !confirmedPassword) {
      return res.status(400).json({ error: "Alle felt må fylles ut" });
    }

    if (nextPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Nytt passord må være minst 8 tegn" });
    }

    if (nextPassword !== confirmedPassword) {
      return res.status(400).json({ error: "Passordene må være like" });
    }

    try {
      // Oppdater passordet med ny bcrypt-hash – BTRIM og LOWER for å tolerere whitespace/store bokstaver
      const result = await pool.query(
        `UPDATE users
         SET password = $1
         WHERE LOWER(BTRIM(email)) = $2
         RETURNING id`,
        [await bcrypt.hash(nextPassword, 10), email.trim().toLowerCase()]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Fant ingen bruker med denne e-posten" });
      }

      // Slett alle aktive sesjoner for denne brukeren (tving re-innlogging)
      await clearUserSessions(result.rows[0].id);

      clearSessionCookie(res);
      return res.json({ ok: true, message: "Passordet er oppdatert" });
    } catch (err) {
      console.error("/api/auth/forgot-password error", err);
      return res.status(500).json({ error: "Kunne ikke oppdatere passordet" });
    }
  });

  /**
   * POST /api/auth/logout
   * Logger ut brukeren, ødelegger sesjonen og sletter session-cookies.
   */
  authRouter.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        clearSessionCookie(res);
        res.clearCookie("sid");
        res.set("Cache-Control", "no-store"); // Hindre browser cache av innlogget tilstand
        res.json({ ok: true });
      });
    });
  });

  /**
   * GET /api/auth/me
   * Returnerer innlogget bruker-objekt, eller 401 hvis ikke innlogget.
   * Brukes av frontend for å sjekke innloggingsstatus og hente brukerdata.
   */
  authRouter.get("/me", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ user: null });
    }
    return res.json({ user: req.user });
  });

  // ============================================================
  // PROFIL-ENDEPUNKTER
  // ============================================================

  /**
   * GET /api/profile
   * Henter full profildata for innlogget bruker inkl. siste tur og transaksjoner.
   * Krever aktiv Passport-sesjon.
   */
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    try {
      const profile = await buildProfilePayload(req.user);
      return res.json({ profile });
    } catch (err) {
      console.error("/api/profile GET error", err);
      return res.status(500).json({ error: "Kunne ikke hente profil" });
    }
  });

  /**
   * PUT /api/profile
   * Oppdaterer profilfelter dynamisk basert på hvilke kolonner som finnes i databasen.
   * Sjekker at brukernavn og e-post ikke allerede er i bruk av andre.
   * Oppdaterer Passport-sesjonen etter endring.
   */
  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    try {
      const body = req.body || {};
      const settings = body.settings && typeof body.settings === "object"
        ? body.settings
        : {};
      const userColumns = await getUserColumns();
      const updates = [];
      const values = [];

      // Hjelpefunksjon: legg til et felt i UPDATE-listen
      const addUpdate = (column, value) => {
        updates.push(`${column} = $${values.length + 1}`);
        values.push(value);
      };

      // Finn hvilke kolonnenavn databasen bruker for hvert profilfelt
      const findColumn = (candidates) =>
        candidates.find((candidate) => userColumns.has(candidate));

      const usernameColumn = findColumn(["username", "name", "full_name"]);
      const profileImageColumn = findColumn([
        "profile_image",
        "avatar_url",
        "avatar",
        "image_url",
      ]);
      const phoneColumn = findColumn(["phone", "phone_number"]);
      const dobColumn = findColumn(["dob", "birth_date", "date_of_birth"]);
      const bioColumn = findColumn(["bio", "about"]);
      const notificationsColumn = findColumn([
        "notifications",
        "notifications_enabled",
      ]);
      const themeColumn = findColumn(["theme"]);
      const emailNotificationsColumn = findColumn([
        "email_notifications",
        "emailNotifications",
      ]);
      const locationSharingColumn = findColumn([
        "location_sharing",
        "locationSharing",
      ]);
      const publicProfileColumn = findColumn([
        "public_profile",
        "publicProfile",
      ]);
      const ageColumn = findColumn(["age"]);
      const interestsColumn = findColumn(["interests"]);
      const radiusColumn = findColumn(["radius_km"]);

      const nextName = typeof body.name === "string" ? body.name.trim() : "";
      const nextEmail = typeof body.email === "string" ? body.email.trim() : "";

      // Sjekk at nytt brukernavn ikke allerede er i bruk av en annen bruker
      if (nextName && usernameColumn === "username") {
        const existing = await pool.query(
          "SELECT 1 FROM users WHERE username = $1 AND id <> $2",
          [nextName, req.user.id]
        );

        if (existing.rowCount > 0) {
          return res.status(400).json({ error: "Brukernavn er allerede i bruk" });
        }
      }

      // Sjekk at ny e-post ikke allerede er i bruk av en annen bruker
      if (nextEmail && userColumns.has("email")) {
        const existing = await pool.query(
          "SELECT 1 FROM users WHERE email = $1 AND id <> $2",
          [nextEmail, req.user.id]
        );

        if (existing.rowCount > 0) {
          return res.status(400).json({ error: "E-post er allerede i bruk" });
        }
      }

      // Bygg UPDATE-liste for alle oppgitte felter
      if (nextName && usernameColumn) addUpdate(usernameColumn, nextName);
      if (nextEmail && userColumns.has("email")) addUpdate("email", nextEmail);

      if (typeof body.phone === "string" && phoneColumn) {
        addUpdate(phoneColumn, body.phone.trim());
      }

      if (typeof body.bio === "string" && bioColumn) {
        addUpdate(bioColumn, body.bio.trim());
      }

      if (typeof body.dob === "string" && dobColumn) {
        const trimmedDob = body.dob.trim();
        addUpdate(dobColumn, trimmedDob === "" ? null : trimmedDob);
      }

      if (body.age !== undefined && ageColumn) {
        const trimmedAge = typeof body.age === "string" ? body.age.trim() : body.age;
        const numericAge = Number(trimmedAge);
        addUpdate(ageColumn, Number.isFinite(numericAge) ? numericAge : null);
      }

      if (typeof body.profileImage === "string" && profileImageColumn) {
        addUpdate(profileImageColumn, body.profileImage.trim());
      }

      const bannerImageColumn = findColumn(["banner_image", "banner_url"]);
      if (typeof body.bannerImage === "string" && bannerImageColumn) {
        addUpdate(bannerImageColumn, body.bannerImage.trim());
      }

      if (settings.notifications !== undefined && notificationsColumn) {
        addUpdate(notificationsColumn, toBoolean(settings.notifications, true));
      }

      if (typeof settings.theme === "string" && themeColumn) {
        addUpdate(themeColumn, settings.theme.trim());
      }

      if (settings.emailNotifications !== undefined && emailNotificationsColumn) {
        addUpdate(
          emailNotificationsColumn,
          toBoolean(settings.emailNotifications, false)
        );
      }

      if (settings.locationSharing !== undefined && locationSharingColumn) {
        addUpdate(
          locationSharingColumn,
          toBoolean(settings.locationSharing, false)
        );
      }

      if (settings.publicProfile !== undefined && publicProfileColumn) {
        addUpdate(publicProfileColumn, toBoolean(settings.publicProfile, true));
      }

      if (Array.isArray(body.interests) && interestsColumn) {
        addUpdate(interestsColumn, JSON.stringify(body.interests));
      }

      if (body.radius_km !== undefined && radiusColumn) {
        const numericRadius = Number(body.radius_km);
        addUpdate(radiusColumn, Number.isFinite(numericRadius) ? numericRadius : 50);
      }

      if (updates.length > 0) {
        values.push(req.user.id);
        const updateResult = await pool.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
          values
        );

        const nextUser = sanitizeUser(updateResult.rows[0]);
        // Oppdater Passport-sesjonen med ny brukerdata
        req.login(nextUser, async (loginErr) => {
          if (loginErr) {
            return res.status(500).json({ error: "Kunne ikke oppdatere sesjon" });
          }

          const profile = await buildProfilePayload(nextUser);
          return res.json({ profile });
        });

        return;
      }

      const profile = await buildProfilePayload(req.user);
      return res.json({ profile });
    } catch (err) {
      console.error("/api/profile PUT error", err);
      return res.status(500).json({ error: "Kunne ikke oppdatere profil" });
    }
  });

  /**
   * POST /api/auth/update-profile
   * Endrer brukernavnet til innlogget bruker.
   * Sjekker at nytt brukernavn ikke allerede er tatt.
   */
  authRouter.post("/update-profile", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Brukernavn er påkrevd" });
    }

    try {
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE username = $1 AND id <> $2",
        [username, req.user.id]
      );

      if (existing.rowCount > 0) {
        return res
          .status(400)
          .json({ error: "Brukernavn er allerede i bruk" });
      }

      const result = await pool.query(
        "UPDATE users SET username = $1 WHERE id = $2 RETURNING *",
        [username, req.user.id]
      );

      const user = sanitizeUser(result.rows[0]);
      req.login(user, (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Kunne ikke oppdatere sesjon" });
        }
        return res.json({ user });
      });
    } catch (err) {
      console.error("/api/auth/update-profile error", err);
      return res.status(500).json({ error: "Noe gikk galt" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Lar en innlogget bruker endre passordet sitt.
   * Verifiserer nåværende passord mot bcrypt-hash før oppdatering.
   */
  authRouter.post("/change-password", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Begge passordfeltene er påkrevde" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Nytt passord må være minst 8 tegn" });
    }

    try {
      // Hent full brukerrad (inkl. passord-hash) for verifisering
      const fullUser = await findUserById(req.user.id);
      if (!fullUser) {
        return res.status(400).json({ error: "Bruker finnes ikke" });
      }

      // Sammenlign oppgitt nåværende passord med lagret hash
      const match = await bcrypt.compare(currentPassword, fullUser.password);
      if (!match) {
        return res.status(400).json({ error: "Feil nåværende passord" });
      }

      // Hash nytt passord og oppdater i databasen
      const hash = await bcrypt.hash(newPassword, 10);

      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
        hash,
        req.user.id,
      ]);

      return res.json({ ok: true });
    } catch (err) {
      console.error("/api/auth/change-password error", err);
      return res.status(500).json({ error: "Noe gikk galt" });
    }
  });

  /**
   * POST /api/auth/delete-account
   * Sletter brukerkontoen permanent og logger ut brukeren.
   * Ødelegger sesjonen og sletter alle session-cookies.
   */
  authRouter.post("/delete-account", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    try {
      await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);

      req.logout((err) => {
        if (err) {
          return res.status(500).json({ error: "Kunne ikke logge ut" });
        }
        req.session.destroy(() => {
          clearSessionCookie(res);
          return res.json({ ok: true });
        });
      });
    } catch (err) {
      console.error("/api/auth/delete-account error", err);
      return res.status(500).json({ error: "Noe gikk galt" });
    }
  });

  // ============================================================
  // MELDINGS-ENDEPUNKTER
  // ============================================================

  /**
   * POST /api/messages
   * Sender en ny direktemelding fra innlogget bruker til en annen bruker.
   * Krever aktiv Passport-sesjon.
   */
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    const { receiverId, content } = req.body || {};

    if (!receiverId || !content || !content.trim()) {
      return res
        .status(400)
        .json({ error: "Mottaker og meldingstekst er påkrevd" });
    }

    try {
      const insertResult = await pool.query(
        "INSERT INTO messages (senderid, receiverid, text) VALUES ($1, $2, $3) RETURNING *",
        [req.user.id, receiverId, content.trim()]
      );

      const row = insertResult.rows[0];
      const message = {
        id: row.id,
        sender_id: row.senderid,
        receiver_id: row.receiverid,
        content: row.text,
        created_at: row.createdat,
        read_at: row.readat,
      };

      return res.status(201).json({ message });
    } catch (err) {
      console.error("/api/messages POST error", err);
      return res.status(500).json({ error: "Kunne ikke sende melding" });
    }
  });

  /**
   * GET /api/messages/:otherUserId
   * Henter alle meldinger i en én-til-én-samtale mellom innlogget bruker og en annen.
   * Returnerer meldinger i kronologisk rekkefølge med avsender- og mottaker-brukernavn.
   */
  app.get("/api/messages/:otherUserId", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "Ikke logget inn" });
    }

    const { otherUserId } = req.params;

    if (!otherUserId) {
      return res.status(400).json({ error: "Mangler mottaker-id" });
    }

    try {
      const result = await pool.query(
        `SELECT m.id,
                m.senderid,
                m.receiverid,
                m.text,
                m.createdat,
                m.readat,
                su.username AS sender_username,
                ru.username AS receiver_username
         FROM messages m
         JOIN users su ON su.id = m.senderid
         JOIN users ru ON ru.id = m.receiverid
         WHERE (m.senderid = $1 AND m.receiverid = $2)
            OR (m.senderid = $2 AND m.receiverid = $1)
         ORDER BY m.createdat ASC`,
        [req.user.id, otherUserId]
      );

      const messages = result.rows.map((row) => ({
        id: row.id,
        sender_id: row.senderid,
        receiver_id: row.receiverid,
        content: row.text,
        created_at: row.createdat,
        read_at: row.readat,
        sender_username: row.sender_username,
        receiver_username: row.receiver_username,
      }));

      return res.json({ messages });
    } catch (err) {
      console.error("/api/messages GET error", err);
      return res.status(500).json({ error: "Kunne ikke hente meldinger" });
    }
  });

  // Monter auth-routeren under /api/auth
  app.use("/api/auth", authRouter);

  // Legg til manglende brukerkolonner i databasen ved oppstart
  ensureUserColumns().catch((err) => console.error("ensureUserColumns error", err));

  // La Next.js håndtere alle andre forespørsler (sider, API-ruter, statiske filer)
  app.all("*", (req, res) => handle(req, res));

  app.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
