// Skrevet av Sigurd

import { NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { requireAuth, requireRole } from "../../../../lib/auth";
import { ROLE_UTLEIER, ROLE_ADMIN } from "../../../../lib/roles";

const MAX_FILES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Normaliserer filendelse for trygg lagring.
function getExtension(fileName = "") {
  const ext = path.extname(fileName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ext;
  return ".jpg";
}

export async function POST(req) {
  try {
    // Kun utleier/admin kan laste opp hyttebilder.
    const { user, response } = await requireAuth();
    if (response) return response;

    const roleError = requireRole(user, [ROLE_UTLEIER, ROLE_ADMIN]);
    if (roleError) return roleError;

    // Leser multipart-filer og sjekker antall/storrelse/type.
    const formData = await req.formData();
    const files = formData.getAll("images").filter(Boolean);

    if (!files.length) {
      return NextResponse.json({ error: "Ingen bilder ble sendt inn." }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maks ${MAX_FILES} bilder per opplasting.` },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "cabins");
    await mkdir(uploadDir, { recursive: true });

    const uploaded = [];

    // Lagrer hver fil i public/uploads/cabins og returnerer URL-er.
    for (const file of files) {
      if (typeof file?.arrayBuffer !== "function") continue;

      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Kun JPG, PNG og WEBP er tillatt." },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Et eller flere bilder er større enn 5 MB." },
          { status: 400 }
        );
      }

      const ext = getExtension(file.name);
      const fileName = `${Date.now()}-${randomUUID()}${ext}`;
      const targetPath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(await file.arrayBuffer());

      await writeFile(targetPath, buffer);
      uploaded.push(`/uploads/cabins/${fileName}`);
    }

    if (!uploaded.length) {
      return NextResponse.json({ error: "Ingen gyldige bilder funnet." }, { status: 400 });
    }

    return NextResponse.json({ image_urls: uploaded }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}