import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import pool from "../db";

// Configure local strategy: username + password
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const result = await pool.query(
        "SELECT id, username, password FROM users WHERE username = $1",
        [username]
      );

      if (result.rows.length === 0) {
        return done(null, false, { message: "Feil brukernavn eller passord" });
      }

  const user = result.rows[0];
  // Kolonnen `password` inneholder bcrypt-hashen
  const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return done(null, false, { message: "Feil brukernavn eller passord" });
      }

      // Remove password hash before attaching user to session
      const safeUser = { id: user.id, username: user.username };
      return done(null, safeUser);
    } catch (err) {
      console.error("Passport LocalStrategy error", err);
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      "SELECT id, username FROM users WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return done(null, false);
    }
    const user = result.rows[0];
    done(null, { id: user.id, username: user.username });
  } catch (err) {
    console.error("Passport deserializeUser error", err);
    done(err);
  }
});

export default passport;
