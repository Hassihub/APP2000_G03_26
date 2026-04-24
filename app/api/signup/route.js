/**
 * app/api/signup/route.js
 *
 * Author: Hasnain Malik
 *
 * API-endepunkt for brukerregistrering via Next.js App Router.
 * POST /api/signup
 *
 * Validerer input-data, hasher passordet med bcrypt og lagrer ny bruker
 * i databasen. Returnerer den opprettede brukeren (uten passord-hash).
 *
 * Passordkrav:
 *   - Minst 8 tegn
 *   - Maks 128 tegn
 *   - Minst én stor bokstav (A-Z)
 *   - Minst ett tall (0-9)
 *   - Minst ett spesialtegn (f.eks. !@#$%^&*)
 *
 * Roller brukeren kan velge: USER, UTLEIER, TURLEDER, ADVERTISER.
 * ADMIN og EDITOR kan ikke velges ved registrering.
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "../../../lib/db";
import { isSignupRole, ROLE_USER } from "../../../lib/roles";

/**
 * POST /api/signup
 * Registrerer en ny bruker med validert og hashet passord.
 */
export async function POST(req) {
  try {
    const { username, email, password, role } = await req.json();

    // Normaliser input – fjern whitespace og konverter til forventet format
    const cleanUsername = String(username ?? "").trim();
    const cleanEmail    = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");
    const cleanRole     = String(role ?? "").trim().toUpperCase();

    // Alle tre felt er påkrevde
    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { error: "Alle felt må fylles ut" },
        { status: 400 }
      );
    }

    // --- Passordvalidering ---

    // Minimum 8 tegn (for å forhindre svake passord)
    if (cleanPassword.length < 8) {
      return NextResponse.json(
        { error: "Passordet må være minst 8 tegn" },
        { status: 400 }
      );
    }

    // Maksimum 128 tegn (forhindrer DoS via ekstremt lange passord til bcrypt)
    if (cleanPassword.length > 128) {
      return NextResponse.json(
        { error: "Passordet kan ikke være lengre enn 128 tegn" },
        { status: 400 }
      );
    }

    // Minst én stor bokstav
    if (!/[A-Z]/.test(cleanPassword)) {
      return NextResponse.json(
        { error: "Passordet må inneholde minst én stor bokstav" },
        { status: 400 }
      );
    }

    // Minst ett siffer
    if (!/[0-9]/.test(cleanPassword)) {
      return NextResponse.json(
        { error: "Passordet må inneholde minst ett tall" },
        { status: 400 }
      );
    }

    // Minst ett spesialtegn (alt som ikke er bokstav eller tall)
    if (!/[^A-Za-z0-9]/.test(cleanPassword)) {
      return NextResponse.json(
        { error: "Passordet må inneholde minst ett spesialtegn (f.eks. !@#$)" },
        { status: 400 }
      );
    }

    // Hash passordet med bcrypt – 10 salt-runder gir god balanse mellom sikkerhet og ytelse.
    // bcrypt lagrer salt automatisk i hash-strengen, så vi trenger ikke lagre det separat.
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    // Bruk oppgitt rolle hvis den er tillatt ved registrering, ellers fall tilbake til USER.
    // Hindrer at brukere registrerer seg som ADMIN eller EDITOR via API-kall.
    const roleValue = isSignupRole(cleanRole) ? cleanRole : ROLE_USER;

    // Sett inn ny bruker med parameterisert spørring (beskytter mot SQL-injection).
    // RETURNING-klausulen henter den innsatte raden uten en ekstra SELECT.
    const query = `
      INSERT INTO public.users (username, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, avatar, created_at
    `;

    const values = [cleanUsername, cleanEmail, hashedPassword, roleValue];

    const result = await pool.query(query, values);

    const user = result.rows[0];

    // Returner brukeren uten passord-hash (201 Created)
    return NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          created_at: user.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // PostgreSQL feilkode 23505 = unik-constraint-brudd (e-post allerede registrert)
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "E-post er allerede registrert" },
        { status: 409 }
      );
    }

    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Kunne ikke registrere bruker" },
      { status: 500 }
    );
  }
}
