const express = require("express");
const next = require("next");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Optional: load .env in development
try {
  if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }
} catch (e) {
  // ignore if dotenv is not installed
}

const { getDatabaseConfig } = require("./lib/db-config.cjs");

const dev = process.env.NODE_ENV !== "production";
const appNext = next({ dev });
const handle = appNext.getRequestHandler();

const port = process.env.PORT || 3000;

const pool = new Pool(getDatabaseConfig());
const publicDir = path.join(process.cwd(), "public");
const fallbackImagePath = path.join(publicDir, "images", "fjell.jpg");

function servePublicAssetOrFallback(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  let requestPath = req.path;

  try {
    requestPath = decodeURIComponent(new URL(req.originalUrl, `http://${req.headers.host || "localhost"}`).pathname);
  } catch {
    // Keep the raw path if decoding fails.
  }

  if (requestPath === "/images/profilbilde.jpg") {
    return res.sendFile(fallbackImagePath);
  }

  if (requestPath.startsWith("/uploads/")) {
    const assetPath = path.join(publicDir, requestPath);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }

    return res.sendFile(fallbackImagePath);
  }

  return next();
}

let userColumnsPromise = null;

function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
  return safe;
}

function clearSessionCookie(res) {
  res.clearCookie("connect.sid", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

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
  userColumnsPromise = null; // reset cache so newly added columns are picked up
}

function pickFirstValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function normalizeEmailInput(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

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

async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

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

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        if (!user) {
          return done(null, false, { message: "Feil e-post eller passord" });
        }

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

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    if (!user) return done(null, false);
    return done(null, sanitizeUser(user));
  } catch (err) {
    return done(err);
  }
});

appNext.prepare().then(() => {
  const app = express();

  app.set("trust proxy", 1); // needed for secure cookies behind Heroku proxy

  // Only parse JSON/urlencoded for auth routes handled by Express
  // Next.js app router routes will handle their own body parsing
  const authRouter = express.Router();
  authRouter.use(express.json());
  authRouter.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        // CockroachDB does not support the default Postgres DDL used by
        // connect-pg-simple (because of DEFERRABLE). We create the table
        // manually in SQL instead, so auto-create must be disabled.
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      // Rolling session: extend expiry on each request
      rolling: true,
      cookie: {
        // 30 minutes inactivity timeout
        maxAge: 30 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  // Mirror the session ID into a separate cookie so Next.js route handlers (app router) can
  // authenticate using the same session store.
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

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(servePublicAssetOrFallback);

  // Body parsers for selected Express endpoints (not global Next.js routes)
  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });

  // Apply body parsing middleware for profile, messages and forgot-password routes
  app.use("/api/profile", jsonParser, urlencodedParser);
  app.use("/api/messages", jsonParser, urlencodedParser);
  app.use("/api/auth/forgot-password", jsonParser, urlencodedParser);

  // Register
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

    const cleanRole = String(role ?? "").trim().toUpperCase();
    const allowedRoles = ["USER", "UTLEIER"];
    const roleValue = allowedRoles.includes(cleanRole) ? cleanRole : "USER";

    try {
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE email = $1 OR username = $2",
        [email.toLowerCase(), username]
      );

      if (existing.rowCount > 0) {
        return res
          .status(400)
          .json({ error: "E-post eller brukernavn er allerede i bruk" });
      }

      const hash = await bcrypt.hash(password, 10);

      const insertResult = await pool.query(
        "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
        [username, email.toLowerCase(), hash, roleValue]
      );

      const user = sanitizeUser(insertResult.rows[0]);

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

  // Login
  authRouter.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res
          .status(401)
          .json({ error: info?.message || "Ugyldig pålogging" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ user });
      });
    })(req, res, next);
  });

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

      await clearUserSessions(result.rows[0].id);

      clearSessionCookie(res);
      return res.json({ ok: true, message: "Passordet er oppdatert" });
    } catch (err) {
      console.error("/api/auth/forgot-password error", err);
      return res.status(500).json({ error: "Kunne ikke oppdatere passordet" });
    }
  });

  // Logout
  authRouter.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
    clearSessionCookie(res);
    res.clearCookie("sid");
    res.set("Cache-Control", "no-store");
        res.json({ ok: true });
      });
    });
  });

  // Current user
  authRouter.get("/me", (req, res) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ user: null });
    }
    return res.json({ user: req.user });
  });

  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

      const addUpdate = (column, value) => {
        updates.push(`${column} = $${values.length + 1}`);
        values.push(value);
      };

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

      if (nextName && usernameColumn === "username") {
        const existing = await pool.query(
          "SELECT 1 FROM users WHERE username = $1 AND id <> $2",
          [nextName, req.user.id]
        );

        if (existing.rowCount > 0) {
          return res.status(400).json({ error: "Brukernavn er allerede i bruk" });
        }
      }

      if (nextEmail && userColumns.has("email")) {
        const existing = await pool.query(
          "SELECT 1 FROM users WHERE email = $1 AND id <> $2",
          [nextEmail, req.user.id]
        );

        if (existing.rowCount > 0) {
          return res.status(400).json({ error: "E-post er allerede i bruk" });
        }
      }

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

  // Update username
  authRouter.post("/update-profile", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

  // Change password
  authRouter.post("/change-password", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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
      const fullUser = await findUserById(req.user.id);
      if (!fullUser) {
        return res.status(400).json({ error: "Bruker finnes ikke" });
      }

      const match = await bcrypt.compare(currentPassword, fullUser.password);
      if (!match) {
        return res.status(400).json({ error: "Feil nåværende passord" });
      }

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

  // Delete account
  authRouter.post("/delete-account", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

  // Create a new one-to-one message
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

  // Get all messages in a one-to-one conversation
  app.get("/api/messages/:otherUserId", async (req, res) => {
    if (!req.isAuthenticated?.()) {
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

  // Mount auth router with body parsing middleware
  app.use("/api/auth", authRouter);

  // Ensure all required user columns exist (adds missing cols silently)
  ensureUserColumns().catch((err) => console.error("ensureUserColumns error", err));

  // Let Next.js handle everything else
  app.all("*", (req, res) => handle(req, res));

  app.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
