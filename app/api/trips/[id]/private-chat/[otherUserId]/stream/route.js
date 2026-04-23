// Importerer databaseforbindelsen som brukes til alle SQL-spørringer.
import pool from "../../../../../../../lib/db";

// Importerer funksjon for å hente nåværende innloggede bruker uten å kreve API-JSON-respons.
import { getCurrentUser } from "../../../../../../../lib/auth";

// Tvinger denne route-handleren til å være dynamisk.
// Det er viktig for streaming/SSE slik at svaret ikke caches.
export const dynamic = "force-dynamic";


// Sørger for at tabellene for privat chat finnes.
// Denne funksjonen kan trygt kjøres flere ganger siden den bruker IF NOT EXISTS.
async function ensurePrivateChatTables(client) {
  // Oppretter tabellen som representerer én privat chat mellom to brukere på én tur.
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

  // Oppretter tabellen som lagrer meldingene i private chatter.
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

  // Indeks for rask uthenting av meldinger per chat.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_chat_id
    ON public.trip_private_messages (chat_id ASC)
  `);

  // Indeks for effektiv sortering/filtering på opprettelsestidspunkt.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_created_at
    ON public.trip_private_messages (created_at ASC)
  `);
}


// Sjekker om en bruker regnes som deltaker i en tur.
// En bruker er deltaker hvis vedkommende enten:
// - har meldt ikke-bindende interesse
// - eller er bindende påmeldt på en avgang på turen
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

  // Returnerer true hvis brukeren finnes i en av de to gruppene, ellers false.
  return result.rowCount > 0;
}


// Sorterer to bruker-ID-er alfabetisk som strenger.
// Dette gjør at samme chat alltid får samme brukerrekkefølge i databasen,
// uansett hvem som åpner chatten først.
function sortUserIds(a, b) {
  return [a, b].sort((x, y) => String(x).localeCompare(String(y)));
}


// Henter privat chat mellom to brukere på en tur hvis den finnes,
// ellers oppretter den en ny.
async function ensurePrivateChat(client, tripId, currentUserId, otherUserId) {
  // Sørger for stabil rekkefølge på brukerfeltene.
  const [userOneId, userTwoId] = sortUserIds(currentUserId, otherUserId);

  // Prøver først å hente eksisterende chat.
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

  // Hvis ingen chat finnes, opprett en ny.
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

  // Returnerer chat-objektet.
  return result.rows[0];
}


// Henter alle meldinger i en privat chat med id større enn lastMessageId.
// Brukes av streamen for å finne "nye" meldinger siden sist.
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
    [chatId, lastMessageId]
  );

  return result.rows;
}


// GET-ruta starter en Server-Sent Events-stream for privat chat.
// Frontend kobler seg til denne for å få meldinger i sanntid.
export async function GET(request, context) {
  // Henter en databaseklient.
  const client = await pool.connect();

  try {
    // Sørger for at nødvendige tabeller finnes før streamen starter.
    await ensurePrivateChatTables(client);

    // Henter nåværende innloggede bruker.
    const user = await getCurrentUser();

    // Hvis ingen er logget inn, returner 401 som vanlig Response.
    if (!user) {
      return new Response("Ikke innlogget", { status: 401 });
    }

    // Leser parametere fra URL-en:
    // id = tripId
    // otherUserId = den andre brukeren i privat chat
    const { id, otherUserId } = await context.params;

    const tripId = Number(id);
    const otherUser = String(otherUserId || "");

    // Validerer tur-ID.
    if (!Number.isFinite(tripId)) {
      return new Response("Ugyldig tur-id", { status: 400 });
    }

    // Validerer annen bruker og hindrer chat med seg selv.
    if (!otherUser || otherUser === user.id) {
      return new Response("Ugyldig bruker", { status: 400 });
    }

    // Sjekker at begge brukere faktisk er deltakere i turen.
    const currentIsMember = await isTripParticipant(client, tripId, user.id);
    const otherIsMember = await isTripParticipant(client, tripId, otherUser);

    if (!currentIsMember || !otherIsMember) {
      return new Response(
        "Begge brukere må være med i turen for å bruke privat chat",
        { status: 403 }
      );
    }

    // Henter eller oppretter selve private chatten.
    const chat = await ensurePrivateChat(client, tripId, user.id, otherUser);

    // Leser siste meldings-ID klienten allerede kjenner til.
    const { searchParams } = new URL(request.url);
    let lastMessageId = Number(searchParams.get("lastMessageId") || "0");

    // Rydder opp hvis parameteren er ugyldig eller negativ.
    if (!Number.isFinite(lastMessageId) || lastMessageId < 0) {
      lastMessageId = 0;
    }

    // Brukes til å encode tekst til bytes i ReadableStream.
    const encoder = new TextEncoder();

    // Oppretter selve streamen som skal sende events til klienten.
    const stream = new ReadableStream({
      start(controller) {
        // Brukes for å stoppe videre sending når forbindelsen er lukket.
        let closed = false;

        // Hjelpefunksjon som sender ett SSE-event til klienten.
        // Formatet er:
        // event: <navn>
        // data: <json>
        const send = (event, data) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        // Sender et "ready"-event med grunnleggende info når streamen starter.
        send("ready", {
          ok: true,
          tripId,
          chatId: chat.id,
          currentUserId: user.id,
        });

        // Sender heartbeat/ping hvert 20. sekund for å holde forbindelsen varm.
        const heartbeat = setInterval(() => {
          send("ping", { ts: Date.now() });
        }, 20000);

        // Poller databasen hvert 1.5 sekund for nye meldinger.
        // Dette er ikke ekte push fra DB, men fungerer som pseudo-realtime.
        const poll = setInterval(async () => {
          if (closed) return;

          try {
            // Henter meldinger nyere enn siste klienten kjenner til.
            const rows = await getMessagesAfter(client, chat.id, lastMessageId);

            if (rows.length > 0) {
              for (const row of rows) {
                // Sender hver ny melding som eget "message"-event.
                send("message", row);

                // Oppdaterer siste meldings-ID så samme melding ikke sendes igjen.
                lastMessageId = Math.max(lastMessageId, Number(row.id));
              }
            }
          } catch (error) {
            // Hvis polling feiler, send et error-event til klienten.
            send("error", {
              message: error?.message || "Klarte ikke hente nye meldinger",
            });
          }
        }, 1500);

        // Når klienten lukker forbindelsen, rydd opp.
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

      // Hvis streamen kanselleres, prøv å frigi DB-klienten.
      cancel() {
        try {
          client.release();
        } catch {}
      },
    });

    // Returnerer streamen som en SSE-response.
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Hvis noe feiler før streamen er startet, frigir vi klienten.
    try {
      client.release();
    } catch {}

    // Returnerer en vanlig tekst-response med feilmelding.
    return new Response(error?.message || "Kunne ikke starte stream", {
      status: 500,
    });
  }
}