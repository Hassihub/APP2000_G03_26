import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "../../../lib/db";
import { isSignupRole, ROLE_USER } from "../../../lib/roles";

export async function POST(req) {
  try {
    const { username, email, password, role } = await req.json();

    const cleanUsername = String(username ?? "").trim();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");
    const cleanRole = String(role ?? "").trim().toUpperCase();

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { error: "Alle felt må fylles ut" },
        { status: 400 }
      );
    }

    if (cleanPassword.length < 8) {
      return NextResponse.json(
        { error: "Passordet må være minst 8 tegn" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    // Sørg for at brukeren ikke kan registrere seg som ADMIN
    const roleValue = isSignupRole(cleanRole) ? cleanRole : ROLE_USER;

    const query = `
      INSERT INTO public.users (username, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, avatar, created_at
    `;

    const values = [cleanUsername, cleanEmail, hashedPassword, roleValue];

    const result = await pool.query(query, values);

    const user = result.rows[0];

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
