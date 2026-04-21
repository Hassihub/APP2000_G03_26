import { NextResponse } from "next/server";

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_SIMPLE_FILE_UPLOAD_PUBLIC_KEY ||
    process.env.SIMPLE_FILE_UPLOAD_KEY ||
    null;

  if (!publicKey) {
    return NextResponse.json({ publicKey: null }, { status: 404 });
  }

  return NextResponse.json({ publicKey }, { status: 200 });
}
