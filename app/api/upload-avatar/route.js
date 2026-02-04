import { NextResponse } from "next/server";
import multer from "multer";
import path from "path";
import fs from "fs";

// Opprett uploads-mappe
const uploadDir = path.join(process.cwd(), "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Konfigurer multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

export const POST = async (req) => {
  return new Promise((resolve) => {
    upload.single("avatar")(req, {}, (err) => {
      if (err) return resolve(NextResponse.json({ error: "Kunne ikke laste opp" }, { status: 500 }));
      resolve(NextResponse.json({ filePath: `/uploads/${req.file.filename}` }));
    });
  });
};
