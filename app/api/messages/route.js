import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

let messagesTableReady = false;

// Verify that the existing messages table is accessible.
// The actual schema is managed outside this app and uses columns:
// id (uuid), senderid (uuid), receiverid (uuid), text (string),
// createdat (timestamp), readat (timestamp|null).
async function ensureMessagesTable() {
	if (messagesTableReady) return true;

	try {
		// Will throw if the table does not exist.
		await db.query("SELECT 1 FROM public.messages LIMIT 1");
		messagesTableReady = true;
		return true;
	} catch {
		return false;
	}
}

export async function POST(req) {
	try {
		const { user, response } = await requireAuth();
		if (response) return response;

		const body = await req.json();

		const senderId = String(user.id);
		const receiverId = String(body.receiverId ?? "").trim();
		const content = String(body.content ?? "").trim();

		if (!receiverId) {
			return NextResponse.json({ error: "receiverId er påkrevd" }, { status: 400 });
		}
		if (!content) {
			return NextResponse.json({ error: "content er påkrevd" }, { status: 400 });
		}
		if (receiverId === senderId) {
			return NextResponse.json({ error: "Du kan ikke sende melding til deg selv" }, { status: 400 });
		}

		const hasTable = await ensureMessagesTable();
		if (!hasTable) {
			return NextResponse.json({ error: "Kunne ikke finne meldings-tabellen" }, { status: 500 });
		}

		const sql = `
			INSERT INTO public.messages (senderid, receiverid, text)
			VALUES ($1::uuid, $2::uuid, $3)
			RETURNING id, senderid, receiverid, text, createdat, readat
		`;

		const result = await db.query(sql, [senderId, receiverId, content]);
		const row = result.rows[0];
		const message = {
			id: row.id,
			sender_id: row.senderid,
			receiver_id: row.receiverid,
			content: row.text,
			created_at: row.createdat,
			read_at: row.readat,
		};

		return NextResponse.json({ message }, { status: 201 });
	} catch (e) {
		return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
	}
}

// GET /api/messages?otherUserId=...  -> conversation between two users
// GET /api/messages                  -> last 50 messages involving current user
export async function GET(req) {
	try {
		const { user, response } = await requireAuth();
		if (response) return response;

		const hasTable = await ensureMessagesTable();
		if (!hasTable) {
			return NextResponse.json({ error: "Kunne ikke finne meldings-tabellen" }, { status: 500 });
		}

		const meId = String(user.id);
		const { searchParams } = new URL(req.url);
		const otherId = searchParams.get("otherUserId") || searchParams.get("other_user_id");

		if (otherId) {
			const sql = `
				SELECT id, senderid, receiverid, text, createdat, readat
				FROM public.messages
				WHERE (senderid = $1::uuid AND receiverid = $2::uuid)
					 OR (senderid = $2::uuid AND receiverid = $1::uuid)
				ORDER BY createdat ASC
			`;

			const result = await db.query(sql, [meId, String(otherId)]);
			const messages = result.rows.map((row) => ({
				id: row.id,
				sender_id: row.senderid,
				receiver_id: row.receiverid,
				content: row.text,
				created_at: row.createdat,
				read_at: row.readat,
			}));
			return NextResponse.json({ messages }, { status: 200 });
		}

		const sql = `
			SELECT id, senderid, receiverid, text, createdat, readat
			FROM public.messages
			WHERE senderid = $1::uuid OR receiverid = $1::uuid
			ORDER BY createdat DESC
			LIMIT 50
		`;

		const result = await db.query(sql, [meId]);
		const messages = result.rows.map((row) => ({
			id: row.id,
			sender_id: row.senderid,
			receiver_id: row.receiverid,
			content: row.text,
			created_at: row.createdat,
			read_at: row.readat,
		}));

		return NextResponse.json({ messages }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
	}
}
export { ensureMessagesTable };

