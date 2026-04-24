// Konrad - 274088
import pool from "../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

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
    [tripId, userId],
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
    [tripId, userOneId, userTwoId],
  );

  if (result.rowCount === 0) {
    result = await client.query(
      `
      INSERT INTO public.trip_private_chats (trip_id, user_one_id, user_two_id)
      VALUES ($1, $2, $3)
      RETURNING id, trip_id, user_one_id, user_two_id, created_at
      `,
      [tripId, userOneId, userTwoId],
    );
  }

  return result.rows[0];
}

async function getMessagesAfter(client, chatId, lastMessageId) {
  const result = await client.query(
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
    WHERE m.chat_id = $1
      AND m.id > $2
    ORDER BY m.id ASC
    `,
    [chatId, lastMessageId],
  );

  return result.rows;
}

export async function GET(request, context) {
  const client = await pool.connect();

  try {
    await ensurePrivateChatTables(client);

    const user = await getCurrentUser();

    if (!user) {
      return new Response("Ikke innlogget", { status: 401 });
    }

    const { id, otherUserId } = await context.params;

    const tripId = Number(id);
    const otherUser = String(otherUserId || "");

    if (!Number.isFinite(tripId)) {
      return new Response("Ugyldig tur-id", { status: 400 });
    }

    if (!otherUser || otherUser === user.id) {
      return new Response("Ugyldig bruker", { status: 400 });
    }

    const currentIsMember = await isTripParticipant(client, tripId, user.id);
    const otherIsMember = await isTripParticipant(client, tripId, otherUser);

    if (!currentIsMember || !otherIsMember) {
      return new Response(
        "Begge brukere må være med i turen for å bruke privat chat",
        { status: 403 },
      );
    }

    const chat = await ensurePrivateChat(client, tripId, user.id, otherUser);
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
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
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

