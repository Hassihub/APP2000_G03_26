// Konrad - 274088
import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

async function ensureTurlederUserIdColumn(client) {
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id)
  `);

  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}

async function ensureUserNotificationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.user_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      action_url TEXT,
      metadata JSONB,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON public.user_notifications (user_id, created_at DESC)
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notifications_reference
    ON public.user_notifications (user_id, type, reference_id)
    WHERE reference_id IS NOT NULL
  `);
}

async function sendLeaderNotificationBestEffort({
  tripId,
  departureId,
  recipientUserId,
  actorUserId,
  actorUsername,
}) {
  if (!recipientUserId || String(recipientUserId) === String(actorUserId)) {
    return;
  }

  const client = await pool.connect();

  try {
    await ensureUserNotificationsTable(client);

    await client.query(
      `
      INSERT INTO public.user_notifications
        (user_id, type, reference_id, title, message, action_url, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT DO NOTHING
      `,
      [
        String(recipientUserId),
        "trip_binding_signup",
        `trip:${tripId}:departure:${departureId}:signup:${actorUserId}`,
        "Ny bindende påmelding",
        `${actorUsername} meldte seg bindende på turen.`,
        `/explore/${tripId}`,
        JSON.stringify({
          trip_id: tripId,
          departure_id: departureId,
          actor_user_id: actorUserId,
          actor_username: actorUsername,
        }),
      ],
    );
  } catch (error) {
    console.error("Notification insert error:", error);
  } finally {
    client.release();
  }
}

export async function POST(request, context) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    await ensureTurlederUserIdColumn(client);

    const { departureId: departureIdParam } = await context.params;
    const userId = user.id;
    const departureId = Number(departureIdParam);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    await client.query("BEGIN");

    const departureResult = await client.query(
      `
      SELECT
        id,
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      FROM public.trip_departures
      WHERE id = $1
      FOR UPDATE
      `,
      [departureId],
    );

    if (departureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgang ikke funnet" },
        { status: 404 },
      );
    }

    const departure = departureResult.rows[0];

    const leaderResult = await client.query(
      `
      SELECT turleder_user_id
      FROM public.tiu_trips
      WHERE trip_id = $1
      LIMIT 1
      `,
      [departure.trip_id],
    );

    const turlederUserId = leaderResult.rows[0]?.turleder_user_id ?? null;

    if (departure.status === "cancelled") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgangen er avlyst" },
        { status: 400 },
      );
    }

    if (departure.status === "confirmed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen er allerede bekreftet" },
        { status: 400 },
      );
    }

    const overlapResult = await client.query(
      `
      SELECT
        r.id,
        r.departure_id,
        d.trip_id,
        d.start_time,
        d.end_time
      FROM public.trip_registrations r
      JOIN public.trip_departures d
        ON d.id = r.departure_id
      WHERE r.user_id = $1
        AND r.status = 'binding'
        AND d.status IN ('open', 'confirmed')
        AND d.start_time < $3
        AND d.end_time > $2
        AND d.id <> $4
      LIMIT 1
      `,
      [userId, departure.start_time, departure.end_time, departureId],
    );

    if (overlapResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du har allerede en overlappende bindende påmelding" },
        { status: 400 },
      );
    }

    const existingRegistrationResult = await client.query(
      `
      SELECT id, status
      FROM public.trip_registrations
      WHERE departure_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [departureId, userId],
    );

    if (
      existingRegistrationResult.rowCount > 0 &&
      existingRegistrationResult.rows[0].status === "binding"
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du er allerede bindende påmeldt denne avgangen" },
        { status: 400 },
      );
    }

    if (departure.max_participants !== null) {
      const capacityResult = await client.query(
        `
        SELECT COUNT(*)::int AS binding_count
        FROM public.trip_registrations
        WHERE departure_id = $1
          AND status = 'binding'
        `,
        [departureId],
      );

      const currentBindingCount = capacityResult.rows[0].binding_count;

      if (currentBindingCount >= departure.max_participants) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Avgangen er fullbooket" },
          { status: 400 },
        );
      }
    }

    if (existingRegistrationResult.rowCount > 0) {
      await client.query(
        `
        UPDATE public.trip_registrations
        SET status = 'binding'
        WHERE departure_id = $1
          AND user_id = $2
        `,
        [departureId, userId],
      );
    } else {
      await client.query(
        `
        INSERT INTO public.trip_registrations (departure_id, user_id, status)
        VALUES ($1, $2, 'binding')
        `,
        [departureId, userId],
      );
    }

    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS binding_count
      FROM public.trip_registrations
      WHERE departure_id = $1
        AND status = 'binding'
      `,
      [departureId],
    );

    const bindingCount = countResult.rows[0].binding_count;
    const readyToConfirm = bindingCount >= departure.min_participants;

    await client.query("COMMIT");

    await sendLeaderNotificationBestEffort({
      tripId: departure.trip_id,
      departureId,
      recipientUserId: turlederUserId,
      actorUserId: userId,
      actorUsername: user.username,
    });

    return NextResponse.json(
      {
        success: true,
        message: readyToConfirm
          ? "Bindende påmelding registrert. Turen er klar til å bekreftes av turleder."
          : "Bindende påmelding registrert",
        departure: {
          id: departure.id,
          trip_id: departure.trip_id,
          start_time: departure.start_time,
          end_time: departure.end_time,
          min_participants: departure.min_participants,
          max_participants: departure.max_participants,
          status: departure.status,
        },
        binding_count: bindingCount,
        ready_to_confirm: readyToConfirm,
      },
      { status: 200 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Register API error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke registrere bindende påmelding",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(request, context) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const { departureId: departureIdParam } = await context.params;
    const departureId = Number(departureIdParam);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json({ error: "Ugyldig avgang" }, { status: 400 });
    }

    await client.query("BEGIN");

    const registrationResult = await client.query(
      `
      SELECT
        tr.id,
        tr.status,
        td.id AS departure_id,
        td.trip_id
      FROM public.trip_registrations tr
      JOIN public.trip_departures td
        ON td.id = tr.departure_id
      WHERE tr.departure_id = $1
        AND tr.user_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [departureId, user.id],
    );

    if (registrationResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ingen bindende påmelding å melde av" },
        { status: 404 },
      );
    }

    await client.query(
      `
      UPDATE public.trip_registrations
      SET status = 'cancelled'
      WHERE departure_id = $1
        AND user_id = $2
      `,
      [departureId, user.id],
    );

    const departureResult = await client.query(
      `
      SELECT
        id,
        min_participants,
        status
      FROM public.trip_departures
      WHERE id = $1
      LIMIT 1
      `,
      [departureId],
    );

    if (departureResult.rowCount > 0) {
      const departure = departureResult.rows[0];

      const countResult = await client.query(
        `
        SELECT COUNT(*)::int AS binding_count
        FROM public.trip_registrations
        WHERE departure_id = $1
          AND status = 'binding'
        `,
        [departureId],
      );

      const bindingCount = countResult.rows[0].binding_count;

      if (
        departure.status === "confirmed" &&
        bindingCount < departure.min_participants
      ) {
        await client.query(
          `
          UPDATE public.trip_departures
          SET status = 'open'
          WHERE id = $1
          `,
          [departureId],
        );
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Du er meldt av turen",
      },
      { status: 200 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Unregister API error:", error);

    return NextResponse.json(
      { error: "Kunne ikke melde deg av turen" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

