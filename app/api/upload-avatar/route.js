import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const POST = async (req) => {
  try {
    const data = await req.formData();
    const file = data.get("file");

    if (!file) {
      return NextResponse.json({ error: "Ingen fil valgt" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Opprett uploads-mappe om den ikke finnes
    const uploadDir = path.join(process.cwd(), "public/uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // Lag unikt filnavn
    const filename = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, filename);

    // Skriv filen
    fs.writeFileSync(filePath, buffer);

    // Returner sti til frontend
    return NextResponse.json({ filePath: `/uploads/${filename}` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kunne ikke laste opp filen" }, { status: 500 });
  }
};
