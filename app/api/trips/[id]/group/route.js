// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../lib/auth";


// Sørger for at tabellene for turgruppechat finnes.
// Her opprettes:
// - trip_group_chats: én chat per tur
// - trip_group_messages: meldingene som tilhører gruppa
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

  // Oppretter tabellen for meldingene i gruppechatten.
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

  // Sørger for at kolonnen message_type finnes.
  // Brukes for å skille mellom tekstmeldinger og bildemeldinger.
  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS message_type STRING NOT NULL DEFAULT 'text'
  `);

  // Sørger for at kolonnen image_url finnes.
  // Denne brukes når en melding inneholder bilde.
  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS image_url STRING NULL
  `);

  // Indeks for rask henting av meldinger per chat.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_chat_id
    ON public.trip_group_messages (chat_id ASC)
  `);

  // Indeks for sortering/henting etter tidspunkt.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_group_messages_created_at
    ON public.trip_group_messages (created_at ASC)
  `);
}


// Sørger for at turleder_user_id finnes i tiu_trips-tabellen.
// Denne brukes for å vite hvem som er turleder i frontend og backend.
async function ensureTripLeaderColumn(client) {
  // Legger til kolonnen hvis den ikke finnes.
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  // Lager indeks for raskere oppslag.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id ASC)
  `);

  // Fyller inn manglende turleder_user_id ved å matche username mot turleder_navn.
  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}


// Sjekker om en bruker har tilgang til turgruppen.
// Brukeren får tilgang hvis hen enten:
// - har meldt interesse
// - eller er bindende påmeldt en avgang på turen
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


// GET-ruta henter gruppechat-data for en tur.
export async function GET(request, { params }) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Sørger for at nødvendige tabeller og kolonner finnes.
    await ensureTripGroupTables(client);
    await ensureTripLeaderColumn(client);

    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    // Leser tur-ID fra route-parametrene.
    const { id } = await params;
    const tripId = Number(id);

    // Validerer tur-ID.
    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    // Henter grunnleggende info om turen.
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
      [tripId]
    );

    // Hvis turen ikke finnes, returneres 404.
    if (tripResult.rowCount === 0) {
      return NextResponse.json(
        { error: "Fant ikke turen" },
        { status: 404 }
      );
    }

    // Sjekker om brukeren har tilgang til turgruppen.
    const hasAccess = await userHasAccess(client, tripId, user.id);

    // Hvis ikke, returneres 403.
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Du må melde interesse eller være påmeldt for å åpne turgruppen" },
        { status: 403 }
      );
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Prøver å hente eksisterende gruppechat for turen.
    let chatResult = await client.query(
      `
      SELECT id, trip_id, created_at
      FROM public.trip_group_chats
      WHERE trip_id = $1
      LIMIT 1
      `,
      [tripId]
    );

    // Hvis gruppechat ikke finnes ennå, opprett den.
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

    // Henter chat-objektet.
    const chat = chatResult.rows[0];

    // Henter alle medlemmer i gruppa.
    // Et medlem er enten:
    // - en bruker med interesse
    // - eller en bindende påmeldt bruker
    // DISTINCT brukes for å unngå dubletter.
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
      [tripId]
    );

    // Henter meldingene i gruppechatten.
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
      [chat.id]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer all data frontend trenger for å vise turgruppen.
    return NextResponse.json({
      // Informasjon om turen
      trip: tripResult.rows[0],

      // Selve chat-objektet
      chat,

      // Liste over deltakere/medlemmer
      members: membersResult.rows,

      // Liste over meldinger
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
    console.error("Trip group GET error:", error);

    // Returnerer 500-feil til frontend.
    return NextResponse.json(
      {
        error: "Kunne ikke hente turgruppen",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}