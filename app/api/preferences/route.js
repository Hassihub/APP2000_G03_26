import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ALLOWED_LANGUAGES = new Set(["no", "en", "fr", "es", "it"]);
const ALLOWED_THEMES = new Set([
  "light",
  "dark",
  "auto",
  "Lys",
  "Mørk",
  "Automatisk",
]);

export async function GET() {
  const cookieStore = await cookies();

  return NextResponse.json({
    language: cookieStore.get("language")?.value || "no",
    theme: cookieStore.get("theme")?.value || "light",
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const response = NextResponse.json({ ok: true });

  if (typeof body.language === "string" && ALLOWED_LANGUAGES.has(body.language)) {
    response.cookies.set("language", body.language, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (typeof body.theme === "string" && ALLOWED_THEMES.has(body.theme)) {
    response.cookies.set("theme", body.theme, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}