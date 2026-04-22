import pool from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

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
    [tripId, userId]
  );

  return result.rowCount > 0;
}

async function ensureChatForTrip(client, tripId) {
  let chatResult = await client.query(
    `
    SELECT id, trip_id, created_at
    FROM public.trip_group_chats
    WHERE trip_id = $1
    LIMIT 1
    `,
    [tripId]
  );

  if (chatResult.rowCount === 0) {
    chatResult = await client.query(
      `
      INSERT INTO public.trip_group_chats (trip_id)
      VALUES ($1)
      RETURNING id, trip_id, created_at
      `,
      [tripId]
    );
  }

  return chatResult.rows[0];
}

async function getMessagesAfter(client, chatId, lastMessageId) {
  const result = await client.query(
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
    WHERE m.chat_id = $1
      AND m.id > $2
    ORDER BY m.id ASC
    `,
    [chatId, lastMessageId]
  );

  return result.rows;
}

export async function GET(request, { params }) {
  const client = await pool.connect();

  try {
    await ensureTripGroupTables(client);

    const user = await getCurrentUser();

    if (!user) {
      return new Response("Ikke innlogget", { status: 401 });
    }

    const tripId = Number(params.id);
    if (!Number.isFinite(tripId)) {
      return new Response("Ugyldig tur-id", { status: 400 });
    }

    const hasAccess = await userHasAccess(client, tripId, user.id);
    if (!hasAccess) {
      return new Response(
        "Du må melde interesse eller være påmeldt for å åpne turgruppen",
        { status: 403 }
      );
    }

    const chat = await ensureChatForTrip(client, tripId);
    const { searchParams } = new URL(request.url);
    let lastMessageId = Number(searchParams.get("lastMessageId") || "0");

    if (!Number.isFinite(lastMessageId) || lastMessageId < 0) {
      lastMessageId = 0;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        const send = (event, data) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        send("ready", {
          ok: true,
          tripId,
          chatId: chat.id,
          currentUserId: user.id,
        });

        const heartbeat = setInterval(() => {
          send("ping", { ts: Date.now() });
        }, 20000);

        const poll = setInterval(async () => {
          if (closed) return;

          try {
            const rows = await getMessagesAfter(client, chat.id, lastMessageId);

            if (rows.length > 0) {
              for (const row of rows) {
                send("message", row);
                lastMessageId = Math.max(lastMessageId, Number(row.id));
              }
            }
          } catch (error) {
            send("error", {
              message: error?.message || "Klarte ikke hente nye meldinger",
            });
          }
        }, 1500);

        request.signal.addEventListener("abort", () => {
          closed = true;
          clearInterval(heartbeat);
          clearInterval(poll);
          try {
            controller.close();
          } catch {}
          client.release();
        });
      },
      cancel() {
        try {
          client.release();
        } catch {}
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    try {
      client.release();
    } catch {}

    return new Response(error?.message || "Kunne ikke starte stream", {
      status: 500,
    });
  }
}