// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../../lib/auth";


// Sørger for at tabellene for privat chat finnes.
// Her opprettes:
// - trip_private_chats: selve chat-relasjonen mellom to brukere på en bestemt tur
// - trip_private_messages: meldingene som hører til en privat chat
async function ensurePrivateChatTables(client) {
  // Oppretter tabellen for private chatter hvis den ikke finnes.
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

  // Oppretter tabellen for private meldinger hvis den ikke finnes.
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

  // Lager indeks for raskt oppslag av meldinger per chat.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_chat_id
    ON public.trip_private_messages (chat_id ASC)
  `);

  // Lager indeks for sortering/uthenting på opprettelsestidspunkt.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_private_messages_created_at
    ON public.trip_private_messages (created_at ASC)
  `);
}


// Sjekker om en bruker regnes som deltaker i turen.
// En bruker regnes som deltaker hvis vedkommende enten:
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

  // Returnerer true hvis brukeren er deltaker, ellers false.
  return result.rowCount > 0;
}


// Hjelpefunksjon som sorterer to bruker-ID-er stabilt.
// Dette brukes for å sikre at samme chat alltid lagres med samme rekkefølge på brukerne,
// uansett hvem som åpnet den først.
function sortUserIds(a, b) {
  return [a, b].sort((x, y) => String(x).localeCompare(String(y)));
}


// Sørger for at en privat chat mellom to brukere på en bestemt tur finnes.
// Hvis den allerede finnes, hentes den.
// Hvis den ikke finnes, opprettes den.
async function ensurePrivateChat(client, tripId, currentUserId, otherUserId) {
  // Sorterer bruker-ID-ene slik at de lagres konsekvent.
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


// GET-ruta henter en privat chat mellom innlogget bruker og en annen bruker på en bestemt tur.
export async function GET(request, context) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Sørger for at nødvendige private chat-tabeller finnes.
    await ensurePrivateChatTables(client);

    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) return response;

    // Leser route-parametrene:
    // - id = tur-ID
    // - otherUserId = den andre brukeren i privat chat
    const { id, otherUserId } = await context.params;

    const tripId = Number(id);
    const otherUser = String(otherUserId || "");

    // Validerer tur-ID.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json({ error: "Ugyldig tur-id" }, { status: 400 });
    }

    // Validerer bruker-ID.
    // Man kan ikke åpne privat chat med seg selv.
    if (!otherUser || otherUser === user.id) {
      return NextResponse.json({ error: "Ugyldig bruker" }, { status: 400 });
    }

    // Henter grunnleggende info om turen.
    const tripResult = await client.query(
      `
      SELECT
        t.id,
        t.navn,
        tt.turleder_user_id,
        tt.turleder_navn
      FROM public.trips t
      LEFT JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      WHERE t.id = $1
      LIMIT 1
      `,
      [tripId]
    );

    // Hvis turen ikke finnes, returneres 404.
    if (tripResult.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke turen" }, { status: 404 });
    }

    // Sjekker om innlogget bruker er deltaker i turen.
    const currentIsMember = await isTripParticipant(client, tripId, user.id);

    // Sjekker om den andre brukeren også er deltaker i turen.
    const otherIsMember = await isTripParticipant(client, tripId, otherUser);

    // Begge brukere må være med i turen for å kunne ha privat chat.
    if (!currentIsMember || !otherIsMember) {
      return NextResponse.json(
        { error: "Begge brukere må være med i turen for å bruke privat chat" },
        { status: 403 }
      );
    }

    // Henter info om den andre brukeren.
    const otherUserResult = await client.query(
      `
      SELECT id, username, avatar
      FROM public.users
      WHERE id = $1
      LIMIT 1
      `,
      [otherUser]
    );

    // Hvis brukeren ikke finnes, returneres 404.
    if (otherUserResult.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke brukeren" }, { status: 404 });
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Henter eller oppretter selve private chatten mellom disse to brukerne.
    const chat = await ensurePrivateChat(client, tripId, user.id, otherUser);

    // Henter meldinger i chatten, sammen med avsenderinfo.
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
      FROM public.trip_private_messages m
      JOIN public.users u
        ON u.id = m.user_id
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC
      LIMIT 200
      `,
      [chat.id]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer data frontend trenger for å vise chatten.
    return NextResponse.json({
      // Informasjon om turen chatten tilhører
      trip: tripResult.rows[0],

      // Selve chat-objektet
      chat,

      // Informasjon om den andre brukeren
      otherUser: otherUserResult.rows[0],

      // Meldinger i chatten
      messages: messagesResult.rows,

      // ID-en til nåværende bruker
      currentUserId: user.id,
    });
  } catch (error) {
    // Hvis noe går galt, prøv rollback.
    try {
      await client.query("ROLLBACK");
    } catch {}

    // Logger backend-feilen.
    console.error("Private trip chat GET error:", error);

    // Returnerer 500-feil til frontend.
    return NextResponse.json(
      {
        error: "Kunne ikke hente privat chat",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}