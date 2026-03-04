import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([
    { postid: 1, caption: "test post", likes: 0, timestamp: new Date() }
  ])
}
