import { NextResponse } from "next/server";
import pool from "../../../../../../../lib/db";
import { requireAuth } from "../../../../../../../lib/auth";

async function ensurePrivateChatTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_private_chats (
      id INT8 NOT NULL GENERATED ALWAYS AS IDENTITY,
      trip_id INT8 NOT NULL,
      user_one_id UUID NOT NULL,
      user_two_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT trip_private_chats_pkey PRIMARY KEY (id ASC),
      CONSTRAINT fk_trip_private_chats_trip
        FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE,
      CONSTRAINT fk_trip_private_chats_user_one
        FOREIGN KEY (user_one_id) REFERENCES public.users(id) ON DELETE CASCADE,
      CONSTRAINT fk_trip_private_chats_user_two
        FOREIGN KEY (user_two_id) REFERENCES public.users(id) ON DELETE CASCADE,
      CONSTRAINT chk_trip_private_chats_not_same_user
        CHECK (user_one_id <> user_two_id),
      CONSTRAINT uq_trip_private_chats_trip_users
        UNIQUE (trip_id, user_one_id, user_two_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_private_messages (
      id INT8 NOT NULL GENERATED ALWAYS AS IDENTITY,
      chat_id INT8 NOT NULL,
      user_id UUID NOT NULL,
      message TEXT NOT NULL,
      message_type STRING NOT NULL DEFAULT 'text',
      image_url STRING NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT trip_private_messages_pkey PRIMARY KEY (id ASC),
      CONSTRAINT fk_trip_private_messages_chat
        FOREIGN KEY (chat_id) REFERENCES public.trip_private_chats(id) ON DELETE CASCADE,
      CONSTRAINT fk_trip_private_messages_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_chat_id
    ON public.trip_private_messages (chat_id ASC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_created_at
    ON public.trip_private_messages (created_at ASC)
  `);
}

async function isTripParticipant(client, tripId, userId) {
  const result = await client.query(
    `
    SELECT 1
    WHERE EXISTS (
      SELECT 1
      FROM public.trip_interest ti
      WHERE ti.trip_id = $1
        AND ti.user_id = $2
        AND ti.status = 'interested'
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_registrations tr
      JOIN public.trip_departures td
        ON td.id = tr.departure_id
      WHERE td.trip_id = $1
        AND tr.user_id = $2
        AND tr.status = 'binding'
    )
    `,
    [tripId, userId]
  );

  return result.rowCount > 0;
}

function sortUserIds(a, b) {
  return [a, b].sort((x, y) => String(x).localeCompare(String(y)));
}

async function ensurePrivateChat(client, tripId, currentUserId, otherUserId) {
  const [userOneId, userTwoId] = sortUserIds(currentUserId, otherUserId);

  let result = await client.query(
    `
    SELECT id, trip_id, user_one_id, user_two_id, created_at
    FROM public.trip_private_chats
    WHERE trip_id = $1
      AND user_one_id = $2
      AND user_two_id = $3
    LIMIT 1
    `,
    [tripId, userOneId, userTwoId]
  );

  if (result.rowCount === 0) {
    result = await client.query(
      `
      INSERT INTO public.trip_private_chats (trip_id, user_one_id, user_two_id)
      VALUES ($1, $2, $3)
      RETURNING id, trip_id, user_one_id, user_two_id, created_at
      `,
      [tripId, userOneId, userTwoId]
    );
  }

  return result.rows[0];
}

function bufferToDataUrl(buffer, mimeType) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request, context) {
  const client = await pool.connect();

  try {
    await ensurePrivateChatTables(client);

    const { user, response } = await requireAuth();
    if (response) return response;

    const { id, otherUserId } = await context.params;

    const tripId = Number(id);
    const otherUser = String(otherUserId || "");

    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    if (!otherUser || otherUser === user.id) {
      return NextResponse.json({ error: "Ugyldig bruker" }, { status: 400 });
    }

    const currentIsMember = await isTripParticipant(client, tripId, user.id);
    const otherIsMember = await isTripParticipant(client, tripId, otherUser);

    if (!currentIsMember || !otherIsMember) {
      return NextResponse.json(
        { error: "Begge brukere må være med i turen for å bruke privat chat" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const rawMessage = formData.get("message");
    const file = formData.get("image");

    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const hasText = message.length > 0;

    let imageUrl = null;
    let hasImage = false;

    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      if (!String(file.type || "").startsWith("image/")) {
        return NextResponse.json(
          { error: "Du kan bare laste opp bildefiler" },
          { status: 400 }
        );
      }

      if (file.size > 3 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Bildet er for stort. Maks 3 MB." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageUrl = bufferToDataUrl(arrayBuffer, file.type);
      hasImage = true;
    }

    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: "Meldingen må inneholde tekst eller bilde" },
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

    const chat = await ensurePrivateChat(client, tripId, user.id, otherUser);

    const messageType = hasImage ? "image" : "text";
    const storedMessage = hasText ? message : "[bilde]";

    const insertResult = await client.query(
      `
      INSERT INTO public.trip_private_messages (
        chat_id,
        user_id,
        message,
        message_type,
        image_url
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [chat.id, user.id, storedMessage, messageType, imageUrl]
    );

    const fullMessageResult = await client.query(
      `
      SELECT
        m.id,
        m.message,
        COALESCE(m.message_type, 'text') AS message_type,
        m.image_url,
        m.created_at,
        u.id AS user_id,
        u.username,
        u.avatar
      FROM public.trip_private_messages m
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
        message: fullMessageResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Private trip message POST error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke sende privat melding",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}