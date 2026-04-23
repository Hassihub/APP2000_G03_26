// Importerer NextResponse for å kunne sende JSON-responser fra API-ruten.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen.
import pool from "../../../../../lib/db";

// Importerer autentiseringsfunksjonen som krever at brukeren er innlogget.
import { requireAuth } from "../../../../../lib/auth";

// Denne API-ruten brukes for å hente gruppechatten knyttet til en turavgang.
// GET:
// - sjekker om brukeren har tilgang
// - oppretter chat hvis den ikke finnes
// - henter medlemmer
// - henter meldinger


// Denne hjelpefunksjonen sjekker om brukeren har tilgang til gruppechatten.
// For å få tilgang må brukeren være bindende påmeldt på avgangen.
async function ensureAccess(client, departureId, userId) {
  // Queryen kobler sammen:
  // - trip_registrations for å sjekke om brukeren er registrert
  // - trip_departures for å hente avgangsinformasjon
  // - trips for å hente navn på turen
  const accessResult = await client.query(
    `
    SELECT
      tr.id,
      td.trip_id,
      td.start_time,
      td.end_time,
      td.status AS departure_status,
      t.navn AS trip_name
    FROM public.trip_registrations tr
    JOIN public.trip_departures td
      ON td.id = tr.departure_id
    JOIN public.trips t
      ON t.id = td.trip_id
    WHERE tr.departure_id = $1
      AND tr.user_id = $2
      AND tr.status = 'binding'
    LIMIT 1
    `,
    [departureId, userId]
  );

  // Returnerer første rad hvis tilgang finnes, ellers null.
  return accessResult.rows[0] ?? null;
}


// GET-ruta henter gruppechat-data for en spesifikk avgang.
export async function GET(request, { params }) {
  // Henter databaseklient fra poolen.
  const client = await pool.connect();

  try {
    // Krever at brukeren er innlogget.
    const { user, response } = await requireAuth();

    // Hvis requireAuth returnerer en response, send den videre.
    if (response) return response;

    // Leser departureId fra URL-parametrene og gjør den om til tall.
    const departureId = Number(params.departureId);

    // Hvis departureId ikke er et gyldig tall, returneres 400-feil.
    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    // Sjekker om brukeren faktisk har tilgang til gruppechatten.
    const access = await ensureAccess(client, departureId, user.id);

    // Hvis brukeren ikke er bindende påmeldt, nektes tilgang.
    if (!access) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til denne turgruppen" },
        { status: 403 }
      );
    }

    // Starter en transaksjon.
    await client.query("BEGIN");

    // Prøver å hente eksisterende gruppechat for denne avgangen.
    let chatResult = await client.query(
      `
      SELECT id, departure_id, created_at
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
        RETURNING id, departure_id, created_at
        `,
        [departureId]
      );
    }

    // Henter chat-objektet.
    const chat = chatResult.rows[0];

    // Henter alle medlemmer i gruppechatten.
    // Medlemmene er alle brukere som er bindende påmeldt samme avgang.
    const membersResult = await client.query(
      `
      SELECT
        u.id,
        u.username,
        u.avatar
      FROM public.trip_registrations tr
      JOIN public.users u
        ON u.id = tr.user_id
      WHERE tr.departure_id = $1
        AND tr.status = 'binding'
      ORDER BY u.username ASC
      `,
      [departureId]
    );

    // Henter de siste meldingene i gruppechatten.
    // Her joines meldinger med users for å få med navn og avatar.
    const messagesResult = await client.query(
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
      ORDER BY m.created_at ASC
      LIMIT 100
      `,
      [chat.id]
    );

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Returnerer all data frontend trenger for å vise gruppechatten.
    return NextResponse.json({
      // Selve chat-objektet
      chat,

      // Grunnleggende turinformasjon
      trip: {
        id: access.trip_id,
        navn: access.trip_name,
      },

      // Informasjon om avgangen chatten tilhører
      departure: {
        id: departureId,
        start_time: access.start_time,
        end_time: access.end_time,
        status: access.departure_status,
      },

      // Liste over medlemmer i gruppen
      members: membersResult.rows,

      // Liste over meldinger i gruppen
      messages: messagesResult.rows,

      // ID-en til nåværende bruker,
      // slik at frontend kan vite hvilke meldinger som er "mine"
      currentUserId: user.id,
    });
  } catch (error) {
    // Hvis noe går galt, prøv å rulle tilbake transaksjonen.
    try {
      await client.query("ROLLBACK");
    } catch {}

    // Logger feilen i terminalen for debugging.
    console.error("Trip group GET error:", error);

    // Returnerer generell 500-feil til frontend.
    return NextResponse.json(
      { error: "Kunne ikke hente turgruppen" },
      { status: 500 }
    );
  } finally {
    // Frigir alltid databaseklienten tilbake til poolen.
    client.release();
  }
}