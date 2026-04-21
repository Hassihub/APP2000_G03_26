import { NextResponse } from "next/server";
import pool from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/auth";

async function ensureAccess(client, departureId, userId) {
  const accessResult = await client.query(
    `
    SELECT tr.id
    FROM public.trip_registrations tr
    WHERE tr.departure_id = $1
      AND tr.user_id = $2
      AND tr.status = 'binding'
    LIMIT 1
    `,
    [departureId, userId]
  );

  return accessResult.rowCount > 0;
}

export async function POST(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const departureId = Number(params.departureId);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    const access = await ensureAccess(client, departureId, user.id);

    if (!access) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til denne turgruppen" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const message = (body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Meldingen kan ikke være tom" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Meldingen er for lang" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    let chatResult = await client.query(
      `
      SELECT id
      FROM public.trip_group_chats
      WHERE departure_id = $1
      LIMIT 1
      `,
      [departureId]
    );

    if (chatResult.rowCount === 0) {
      chatResult = await client.query(
        `
        INSERT INTO public.trip_group_chats (departure_id)
        VALUES ($1)
        RETURNING id
        `,
        [departureId]
      );
    }

    const chatId = chatResult.rows[0].id;

    const insertResult = await client.query(
      `
      INSERT INTO public.trip_group_messages (chat_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, chat_id, user_id, message, created_at
      `,
      [chatId, user.id, message]
    );

    const messageResult = await client.query(
      `
      SELECT
        m.id,
        m.message,
        m.created_at,
        u.id AS user_id,
        u.username,
        u.avatar
      FROM public.trip_group_messages m
      JOIN public.users u
        ON u.id = m.user_id
      WHERE m.id = $1
      LIMIT 1
      `,
      [insertResult.rows[0].id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: messageResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("Trip group message POST error:", error);
    return NextResponse.json(
      { error: "Kunne ikke sende melding" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}