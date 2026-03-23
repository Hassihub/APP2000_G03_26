const express = require("express");
const next = require("next");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

// Optional: load .env in development
try {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line global-require
    require("dotenv").config();
  }
} catch (e) {
  // ignore if dotenv is not installed
}

const dev = process.env.NODE_ENV !== "production";
const appNext = next({ dev });
const handle = appNext.getRequestHandler();

const port = process.env.PORT || 3000;

// Create a separate pool for the Express server
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
  },
});

function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
  return safe;
}

async function findUserByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
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

  // Apply body parsing middleware only to /api/auth routes
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
        [email, username]
      );

      if (existing.rowCount > 0) {
        return res
          .status(400)
          .json({ error: "E-post eller brukernavn er allerede i bruk" });
      }

      const hash = await bcrypt.hash(password, 10);

      const insertResult = await pool.query(
        "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
        [username, email, hash, roleValue]
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

  // Logout
  authRouter.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.clearCookie("sid");
        res.json({ ok: true });
      });
    });
  });

  // Current user
  authRouter.get("/me", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ user: null });
    }
    return res.json({ user: req.user });
  });

  // Update username
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

  // Change password
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
          res.clearCookie("connect.sid");
          return res.json({ ok: true });
        });
      });
    } catch (err) {
      console.error("/api/auth/delete-account error", err);
      return res.status(500).json({ error: "Noe gikk galt" });
    }
  });

  // Mount auth router with body parsing middleware
  app.use("/api/auth", authRouter);

  // Let Next.js handle everything else
  app.all("*", (req, res) => handle(req, res));

  app.listen(port, (err) => {
    if (err) throw err;
    // eslint-disable-next-line no-console
    console.log(`> Ready on http://localhost:${port}`);
  });
});
