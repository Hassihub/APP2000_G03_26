// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../../lib/auth";


// Sørger for at tabellene for turgruppechat finnes.
// Her opprettes:
// - trip_group_chats: én gruppechat per tur
// - trip_group_messages: meldingene som hører til gruppechatten
async function ensureTripGroupTables(client) {
  // Oppretter tabellen for gruppechat hvis den ikke finnes.
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

  // Oppretter tabellen for meldinger i gruppechat hvis den ikke finnes.
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
  // Denne brukes for å skille mellom tekstmeldinger og bildemeldinger.
  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS message_type STRING NOT NULL DEFAULT 'text'
  `);

  // Sørger for at kolonnen image_url finnes.
  // Denne brukes når en melding inneholder et bilde.
  await client.query(`
    ALTER TABLE public.trip_group_messages
    ADD COLUMN IF NOT EXISTS image_url STRING NULL
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


// Sjekker om brukeren har tilgang til å sende meldinger i turgruppen.
// Brukeren får tilgang hvis hen enten:
// - har meldt interesse for turen
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


// Gjør om en bildebuffer til en data URL i base64-format.
// Dette brukes for å lagre og sende bilder direkte som tekststreng.
function bufferToDataUrl(buffer, mimeType) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}


// POST-ruta brukes for å sende en ny melding til turgruppen.
// Meldingen kan være:
// - kun tekst
// - kun bilde
// - bilde + tekst
export async function POST(request, { params }) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Sørger for at nødvendige chat-tabeller finnes.
    await ensureTripGroupTables(client);

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

    // Sjekker om brukeren har tilgang til å sende melding i denne turgruppen.
    const hasAccess = await userHasAccess(client, tripId, user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Du må melde interesse eller være påmeldt for å sende melding" },
        { status: 403 }
      );
    }

    // Leser form-data siden meldingen kan inneholde både tekst og fil.
    const formData = await request.formData();
    const rawMessage = formData.get("message");
    const file = formData.get("image");

    // Trimmer meldingen hvis den finnes.
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const hasText = message.length > 0;

    // Forbereder bildefelter.
    let imageUrl = null;
    let hasImage = false;

    // Hvis en fil er lastet opp, valider og konverter den.
    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      // Bare bildefiler er tillatt.
      if (!String(file.type || "").startsWith("image/")) {
        return NextResponse.json(
          { error: "Du kan bare laste opp bildefiler" },
          { status: 400 }
        );
      }

      // Maks størrelse på bilde er 3 MB.
      if (file.size > 3 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Bildet er for stort. Maks 3 MB." },
          { status: 400 }
        );
      }

      // Leser fila som ArrayBuffer og gjør den om til data URL.
      const arrayBuffer = await file.arrayBuffer();
      imageUrl = bufferToDataUrl(arrayBuffer, file.type);
      hasImage = true;
    }

    // Meldingen må inneholde enten tekst eller bilde.
    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: "Meldingen må inneholde tekst eller bilde" },
        { status: 400 }
      );
    }

    // Begrensning på tekstlengde.
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Meldingen er for lang" },
        { status: 400 }
      );
    }

    // Starter transaksjon.
    await client.query("BEGIN");

    // Henter eksisterende gruppechat for turen hvis den finnes.
    let chatResult = await client.query(
      `
      SELECT id
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
        RETURNING id
        `,
        [tripId]
      );
    }

    // Henter chat-id.
    const chatId = chatResult.rows[0].id;

    // Bestemmer meldingstype.
    const messageType = hasImage ? "image" : "text";

    // Hvis meldingen bare er bilde og ingen tekst, lagres en placeholder.
    const storedMessage = hasText ? message : "[bilde]";

    // Setter inn meldingen i databasen.
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
      [chatId, user.id, storedMessage, messageType, imageUrl]
    );

    // Henter tilbake den lagrede meldingen sammen med brukerinfo,
    // slik at frontend får komplett objekt med en gang.
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
      [insertResult.rows[0].id]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons med den nye meldingen.
    return NextResponse.json(
      {
        success: true,
        message: fullMessageResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    // Hvis noe går galt, prøv rollback.
    try {
      await client.query("ROLLBACK");
    } catch {}

    // Logger backend-feilen for debugging.
    console.error("Trip group message POST error:", error);

    // Returnerer 500-feil til frontend.
    return NextResponse.json(
      {
        error: "Kunne ikke sende melding",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}