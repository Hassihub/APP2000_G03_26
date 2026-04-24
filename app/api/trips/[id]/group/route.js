// Konrad - 274088
import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

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

async function ensureTripLeaderColumn(client) {
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id ASC)
  `);

  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
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

export async function GET(request, { params }) {
  const client = await pool.connect();

  try {
    await ensureTripGroupTables(client);
    await ensureTripLeaderColumn(client);

    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const { id } = await params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    const tripResult = await client.query(
      `
      SELECT
        t.id,
        t.navn,
        tt.turleder_navn,
        tt.turleder_user_id
      FROM public.trips t
      LEFT JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      WHERE t.id = $1
      LIMIT 1
      `,
      [tripId],
    );

    if (tripResult.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke turen" }, { status: 404 });
    }

    const hasAccess = await userHasAccess(client, tripId, user.id);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Du må melde interesse eller være påmeldt for å åpne turgruppen",
        },
        { status: 403 },
      );
    }

    await client.query("BEGIN");

    let chatResult = await client.query(
      `
      SELECT id, trip_id, created_at
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
        RETURNING id, trip_id, created_at
        `,
        [tripId],
      );
    }

    const chat = chatResult.rows[0];

    const membersResult = await client.query(
      `
      SELECT DISTINCT
        u.id,
        u.username,
        u.avatar
      FROM public.users u
      WHERE u.id IN (
        SELECT ti.user_id
        FROM public.trip_interest ti
        WHERE ti.trip_id = $1
          AND ti.status = 'interested'

        UNION

        SELECT tr.user_id
        FROM public.trip_registrations tr
        JOIN public.trip_departures td
          ON td.id = tr.departure_id
        WHERE td.trip_id = $1
          AND tr.status = 'binding'
      )
      ORDER BY u.username ASC
      `,
      [tripId],
    );

    const messagesResult = await client.query(
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
      FROM public.trip_group_messages m
      JOIN public.users u
        ON u.id = m.user_id
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC
      LIMIT 200
      `,
      [chat.id],
    );

    await client.query("COMMIT");

    return NextResponse.json({
      trip: tripResult.rows[0],
      chat,
      members: membersResult.rows,
      messages: messagesResult.rows,
      currentUserId: user.id,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Trip group GET error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke hente turgruppen",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

