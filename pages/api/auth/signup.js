import nextConnect from "next-connect";
import session from "express-session";
import bcrypt from "bcryptjs";
import passport from "../../../lib/auth/passport";
import pool from "../../../lib/db";

const handler = nextConnect({
  onError(err, req, res) {
    console.error("Signup API error", err);
    res.status(500).json({ message: "Noe gikk galt" });
  },
  onNoMatch(req, res) {
    res.status(405).json({ message: "Method not allowed" });
  },
});

handler.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

handler.use(passport.initialize());
handler.use(passport.session());

handler.post(async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ message: "Brukernavn, e-post og passord er påkrevd" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Brukernavn eller e-post er allerede i bruk" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (id, username, email, password) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, username, email",
      [username, email, passwordHash]
    );

    const user = result.rows[0];

    // Logg inn brukeren direkte etter registrering
    req.logIn(user, (err) => {
      if (err) {
        console.error("Login after signup failed", err);
      }
      res.status(201).json({ user });
    });
  } catch (err) {
    console.error("Signup error", err);
    res.status(500).json({ message: "Kunne ikke opprette bruker" });
  }
});

export default handler;
