import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

async function ensureAccess(client, departureId, userId) {
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

  return accessResult.rows[0] ?? null;
}

export async function GET(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const departureId = Number(params.departureId);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    const access = await ensureAccess(client, departureId, user.id);

    if (!access) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til denne turgruppen" },
        { status: 403 }
      );
    }

    await client.query("BEGIN");

    let chatResult = await client.query(
      `
      SELECT id, departure_id, created_at
      FROM public.trip_group_chats
      WHERE departure_id = $1
      LIMIT 1
      `,
      [departureId]
    );

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

    const chat = chatResult.rows[0];

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

    await client.query("COMMIT");

    return NextResponse.json({
      chat,
      trip: {
        id: access.trip_id,
        navn: access.trip_name,
      },
      departure: {
        id: departureId,
        start_time: access.start_time,
        end_time: access.end_time,
        status: access.departure_status,
      },
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
      { error: "Kunne ikke hente turgruppen" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}