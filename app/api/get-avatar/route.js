import { NextResponse } from "next/server";
import pool from "../../../lib/db";

function pickAvatar(row) {
	if (!row) {
		return "/images/fjell.jpg";
	}

	return (
		row.profile_image ||
		row.avatar_url ||
		row.avatar ||
		row.image_url ||
		"/images/fjell.jpg"
	);
}

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const userId = searchParams.get("userId");

		if (!userId) {
			return NextResponse.json(
				{ error: "Mangler userId" },
				{ status: 400 }
			);
		}

		const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
		const user = result.rows[0] || null;

		if (!user) {
			return NextResponse.json(
				{ error: "Bruker ikke funnet" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ avatar: pickAvatar(user) });
	} catch (error) {
		console.error("Get avatar error:", error);
		return NextResponse.json(
			{ error: "Kunne ikke hente avatar" },
			{ status: 500 }
		);
	}
}
