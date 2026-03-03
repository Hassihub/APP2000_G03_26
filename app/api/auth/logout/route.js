import { NextResponse } from "next/server";
import { destroySession } from "../../../../lib/auth";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Kunne ikke logge ut" }, { status: 500 });
  }
}