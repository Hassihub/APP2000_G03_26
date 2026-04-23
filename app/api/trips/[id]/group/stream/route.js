// Importerer databaseforbindelsen som brukes til SQL-spørringer.
import pool from "../../../../../../lib/db";

// Importerer funksjon for å hente nåværende innloggede bruker.
import { getCurrentUser } from "../../../../../../lib/auth";

// Tvinger route-handleren til å være dynamisk.
// Dette er viktig for streaming med Server-Sent Events slik at responsen ikke caches.
export const dynamic = "force-dynamic";

// Denne filen håndterer streaming av gruppechat-meldinger for en tur ved hjelp av Server-Sent Events (SSE).
// Den sender nye meldinger i sanntid til klienten etter siste mottatte melding-ID.


// Sørger for at nødvendige databasetabeller for gruppechat finnes.
async function ensureTripGroupTables(client) {
  // Oppretter tabellen for selve gruppechatten hvis den ikke finnes.
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

  // Sikrer at det bare finnes én gruppechat per tur.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_group_chats_trip_id
    ON public.trip_group_chats (trip_id ASC)
  `);

  // Oppretter tabellen for meldinger i gruppechatten hvis den ikke finnes.
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

  // Indeks for rask henting av meldinger per chat.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_chat_id
    ON public.trip_group_messages (chat_id ASC)
  `);

  // Indeks for rask sortering og uthenting etter tidspunkt.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_created_at
    ON public.trip_group_messages (created_at ASC)
  `);
}


// Sjekker om brukeren har tilgang til turgruppen.
// Brukeren må enten være interessert i turen eller være bindende påmeldt.
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

  // Returnerer true hvis brukeren har tilgang, ellers false.
  return result.rowCount > 0;
}


// Sørger for at det finnes en gruppechat for turen.
// Hvis den ikke finnes, opprettes den automatisk.
async function ensureChatForTrip(client, tripId) {
  // Prøver først å hente eksisterende chat.
  let chatResult = await client.query(
    `
    SELECT id, trip_id, created_at
    FROM public.trip_group_chats
    WHERE trip_id = $1
    LIMIT 1
    `,
    [tripId]
  );

  // Hvis ingen chat finnes, opprett en ny.
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

  // Returnerer chat-objektet.
  return chatResult.rows[0];
}


// Henter alle meldinger med ID større enn lastMessageId.
// Dette brukes av streamen for å finne nye meldinger siden sist klienten oppdaterte.
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


// Hovedfunksjon for GET-forespørsel.
// Denne setter opp en Server-Sent Events-stream for gruppechatten.
export async function GET(request, { params }) {
  // Henter en databaseklient.
  const client = await pool.connect();

  try {
    // Sørger for at tabellene finnes før vi starter.
    await ensureTripGroupTables(client);

    // Henter nåværende bruker.
    const user = await getCurrentUser();

    // Hvis ingen er logget inn, returner 401.
    if (!user) {
      return new Response("Ikke innlogget", { status: 401 });
    }

    // Leser og validerer tur-ID fra route-parametrene.
    const tripId = Number(params.id);
    if (!Number.isFinite(tripId)) {
      return new Response("Ugyldig tur-id", { status: 400 });
    }

    // Sjekker om brukeren har tilgang til turgruppen.
    const hasAccess = await userHasAccess(client, tripId, user.id);
    if (!hasAccess) {
      return new Response(
        "Du må melde interesse eller være påmeldt for å åpne turgruppen",
        { status: 403 }
      );
    }

    // Sørger for at gruppechat finnes for turen.
    const chat = await ensureChatForTrip(client, tripId);

    // Leser siste melding-ID klienten allerede kjenner til fra query-parametrene.
    const { searchParams } = new URL(request.url);
    let lastMessageId = Number(searchParams.get("lastMessageId") || "0");

    // Hvis lastMessageId er ugyldig eller negativ, bruk 0 som fallback.
    if (!Number.isFinite(lastMessageId) || lastMessageId < 0) {
      lastMessageId = 0;
    }

    // TextEncoder brukes for å sende tekst som bytes i streamen.
    const encoder = new TextEncoder();

    // Oppretter en ReadableStream som sender SSE-events.
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        // Hjelpefunksjon for å sende et SSE-event til klienten.
        const send = (event, data) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        // Sender et "ready"-event når streamen er startet opp.
        send("ready", {
          ok: true,
          tripId,
          chatId: chat.id,
          currentUserId: user.id,
        });

        // Sender heartbeat/ping hvert 20. sekund for å holde forbindelsen åpen.
        const heartbeat = setInterval(() => {
          send("ping", { ts: Date.now() });
        }, 20000);

        // Poller databasen hvert 1.5 sekund for nye meldinger.
        const poll = setInterval(async () => {
          if (closed) return;

          try {
            // Henter meldinger nyere enn siste meldings-ID klienten har.
            const rows = await getMessagesAfter(client, chat.id, lastMessageId);

            if (rows.length > 0) {
              for (const row of rows) {
                // Sender hver ny melding som et "message"-event.
                send("message", row);

                // Oppdaterer siste melding-ID slik at samme melding ikke sendes igjen.
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

        // Lytter på abort-signal når klienten lukker forbindelsen.
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

      // Rydd opp hvis streamen kanselleres.
      cancel() {
        try {
          client.release();
        } catch {}
      },
    });

    // Returnerer Response med riktig content-type og headers for SSE.
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Frigir databaseklienten ved feil.
    try {
      client.release();
    } catch {}

    // Returnerer en vanlig tekstrespons med feilmelding.
    return new Response(error?.message || "Kunne ikke starte stream", {
      status: 500,
    });
  }
}