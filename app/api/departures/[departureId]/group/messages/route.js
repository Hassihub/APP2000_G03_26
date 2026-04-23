// Importerer NextResponse for å kunne sende JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../../lib/auth";


// Denne hjelpefunksjonen sjekker om brukeren har tilgang til gruppechatten.
// For å kunne sende meldinger må brukeren være bindende påmeldt på avgangen.
async function ensureAccess(client, departureId, userId) {
  const accessResult = await client.query(
    `
    SELECT tr.id
    FROM public.trip_registrations tr
    WHERE tr.departure_id = $1
      AND tr.user_id = $2
      AND tr.status = 'binding'
    LIMIT 1
    `,
    [departureId, userId]
  );

  // Returnerer true hvis brukeren har tilgang, ellers false.
  return accessResult.rowCount > 0;
}


// POST-ruta brukes for å sende en ny melding i gruppechatten for en avgang.
export async function POST(request, { params }) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();

    // Hvis requireAuth returnerer en ferdig response, send den tilbake.
    if (response) return response;

    // Leser departureId fra URL-parametrene og gjør den om til tall.
    const departureId = Number(params.departureId);

    // Hvis departureId ikke er gyldig, returneres 400-feil.
    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    // Sjekker om brukeren har tilgang til gruppechatten.
    const access = await ensureAccess(client, departureId, user.id);

    // Hvis brukeren ikke er bindende påmeldt, nektes tilgang.
    if (!access) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til denne turgruppen" },
        { status: 403 }
      );
    }

    // Leser request body og henter ut meldingen.
    const body = await request.json();

    // Fjerner whitespace i starten/slutten av meldingen.
    const message = (body.message || "").trim();

    // Hvis meldingen er tom etter trim, returneres 400-feil.
    if (!message) {
      return NextResponse.json(
        { error: "Meldingen kan ikke være tom" },
        { status: 400 }
      );
    }

    // Enkel lengdesjekk for å unngå altfor lange meldinger.
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Meldingen er for lang" },
        { status: 400 }
      );
    }

    // Starter en transaksjon.
    await client.query("BEGIN");

    // Prøver å hente eksisterende chat for denne avgangen.
    let chatResult = await client.query(
      `
      SELECT id
      FROM public.trip_group_chats
      WHERE departure_id = $1
      LIMIT 1
      `,
      [departureId]
    );

    // Hvis chatten ikke finnes ennå, opprettes den automatisk.
    if (chatResult.rowCount === 0) {
      chatResult = await client.query(
        `
        INSERT INTO public.trip_group_chats (departure_id)
        VALUES ($1)
        RETURNING id
        `,
        [departureId]
      );
    }

    // Henter chat-id for gruppa.
    const chatId = chatResult.rows[0].id;

    // Lagrer den nye meldingen i trip_group_messages.
    const insertResult = await client.query(
      `
      INSERT INTO public.trip_group_messages (chat_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, chat_id, user_id, message, created_at
      `,
      [chatId, user.id, message]
    );

    // Henter den nysendte meldingen tilbake med brukerinfo,
    // slik at frontend får samme struktur som når meldinger hentes ellers.
    const messageResult = await client.query(
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
      WHERE m.id = $1
      LIMIT 1
      `,
      [insertResult.rows[0].id]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer suksessrespons med den ferdige meldingen.
    return NextResponse.json(
      {
        success: true,
        message: messageResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    // Hvis noe går galt, prøv å rulle tilbake transaksjonen.
    try {
      await client.query("ROLLBACK");
    } catch {}

    // Logger backend-feilen i terminalen for debugging.
    console.error("Trip group message POST error:", error);

    // Returnerer generell 500-feil til frontend.
    return NextResponse.json(
      { error: "Kunne ikke sende melding" },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}