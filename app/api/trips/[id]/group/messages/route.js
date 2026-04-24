// Konrad - 274088
import { NextResponse } from "next/server";
import pool from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/auth";

async function ensureTripGroupTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_group_chats (
      id INT8 NOT NULL GENERATED ALWAYS AS IDENTITY,
      trip_id INT8 NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT trip_group_chats_pkey PRIMARY KEY (id ASC),
      CONSTRAINT fk_trip_group_chats_trip
        FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_group_chats_trip_id
    ON public.trip_group_chats (trip_id ASC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_group_messages (
      id INT8 NOT NULL GENERATED ALWAYS AS IDENTITY,
      chat_id INT8 NOT NULL,
      user_id UUID NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT trip_group_messages_pkey PRIMARY KEY (id ASC),
      CONSTRAINT fk_trip_group_messages_chat
        FOREIGN KEY (chat_id) REFERENCES public.trip_group_chats(id) ON DELETE CASCADE,
      CONSTRAINT fk_trip_group_messages_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
      CONSTRAINT chk_trip_group_messages_message
        CHECK (length(trim(message)) > 0)
    )
  `);

  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS message_type STRING NOT NULL DEFAULT 'text'
  `);

  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS image_url STRING NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_chat_id
    ON public.trip_group_messages (chat_id ASC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_created_at
    ON public.trip_group_messages (created_at ASC)
  `);
}

async function userHasAccess(client, tripId, userId) {
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
    [tripId, userId],
  );

  return result.rowCount > 0;
}

function bufferToDataUrl(buffer, mimeType) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request, { params }) {
  const client = await pool.connect();

  try {
    await ensureTripGroupTables(client);

    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const { id } = await params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    const hasAccess = await userHasAccess(client, tripId, user.id);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Du må melde interesse eller være påmeldt for å sende melding",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const rawMessage = formData.get("message");
    const file = formData.get("image");

    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const hasText = message.length > 0;

    let imageUrl = null;
    let hasImage = false;

    if (
      file &&
      typeof file === "object" &&
      "arrayBuffer" in file &&
      file.size > 0
    ) {
      if (!String(file.type || "").startsWith("image/")) {
        return NextResponse.json(
          { error: "Du kan bare laste opp bildefiler" },
          { status: 400 },
        );
      }

      if (file.size > 3 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Bildet er for stort. Maks 3 MB." },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      imageUrl = bufferToDataUrl(arrayBuffer, file.type);
      hasImage = true;
    }

    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: "Meldingen må inneholde tekst eller bilde" },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Meldingen er for lang" },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    let chatResult = await client.query(
      `
      SELECT id
      FROM public.trip_group_chats
      WHERE trip_id = $1
      LIMIT 1
      `,
      [tripId],
    );

    if (chatResult.rowCount === 0) {
      chatResult = await client.query(
        `
        INSERT INTO public.trip_group_chats (trip_id)
        VALUES ($1)
        RETURNING id
        `,
        [tripId],
      );
    }

    const chatId = chatResult.rows[0].id;
    const messageType = hasImage ? "image" : "text";
    const storedMessage = hasText ? message : "[bilde]";

    const insertResult = await client.query(
      `
      INSERT INTO public.trip_group_messages (
        chat_id,
        user_id,
        message,
        message_type,
        image_url
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [chatId, user.id, storedMessage, messageType, imageUrl],
    );

    const fullMessageResult = await client.query(
      `
      SELECT
        m.id,
        m.message,
        m.message_type,
        m.image_url,
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
      [insertResult.rows[0].id],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: fullMessageResult.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Trip group message POST error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke sende melding",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

