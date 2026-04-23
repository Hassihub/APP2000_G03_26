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

export async function POST(request, context) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    await ensureTurlederUserIdColumn(client);
    await ensureUserNotificationsTable(client);

    const { id } = await context.params;
    const tripId = Number(id);

    if (!Number.isFinite(tripId)) {
      return NextResponse.json(
        { error: "Ugyldig tur-id" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const dateOptionId = Number(body?.dateOptionId);
    const minParticipants = Number(body?.min_participants ?? 1);
    const maxParticipants =
      body?.max_participants === null ||
      body?.max_participants === undefined ||
      body?.max_participants === ""
        ? null
        : Number(body.max_participants);

    if (!Number.isFinite(dateOptionId)) {
      return NextResponse.json(
        { error: "Ugyldig datoalternativ" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(minParticipants) || minParticipants < 1) {
      return NextResponse.json(
        { error: "Minste antall deltakere må være minst 1" },
        { status: 400 }
      );
    }

    if (maxParticipants !== null) {
      if (!Number.isFinite(maxParticipants) || maxParticipants < minParticipants) {
        return NextResponse.json(
          { error: "Maks antall deltakere må være større enn eller lik minimum" },
          { status: 400 }
        );
      }
    }

    await client.query("BEGIN");

    const tripResult = await client.query(
      `
      SELECT
        t.id,
        t.navn,
        tt.id AS tiu_trip_id,
        tt.is_flexible,
        tt.planning_status,
        tt.turleder_user_id
      FROM public.trips t
      JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      WHERE t.id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tripId]
    );

    if (tripResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Fant ikke fleksibel fellestur" },
        { status: 404 }
      );
    }

    const trip = tripResult.rows[0];

    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";
    const isLeaderForThisTrip =
      trip.turleder_user_id &&
      String(trip.turleder_user_id) === String(user.id);

    if (!isAdmin && !isLeaderForThisTrip) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Ingen tilgang" },
        { status: 403 }
      );
    }

    if (!trip.is_flexible) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen er ikke fleksibel" },
        { status: 400 }
      );
    }

    const existingDepartureResult = await client.query(
      `
      SELECT id
      FROM public.trip_departures
      WHERE trip_id = $1
        AND status <> 'cancelled'
      LIMIT 1
      `,
      [tripId]
    );

    if (existingDepartureResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Turen har allerede en aktiv avgang" },
        { status: 400 }
      );
    }

    const optionResult = await client.query(
      `
      SELECT
        id,
        trip_id,
        start_time,
        end_time,
        is_selected
      FROM public.trip_date_options
      WHERE trip_id = $1
      ORDER BY start_time ASC
      `,
      [tripId]
    );

    if (optionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Denne turen har ingen datoalternativer" },
        { status: 404 }
      );
    }

    const selectedOption = optionResult.rows.find(
      (option) => Number(option.id) === dateOptionId
    );

    if (!selectedOption) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Datoalternativet ble ikke funnet for denne turen",
          received_date_option_id: dateOptionId,
          trip_id: tripId,
          available_option_ids: optionResult.rows.map((row) => row.id),
        },
        { status: 404 }
      );
    }

    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = false
      WHERE trip_id = $1
      `,
      [tripId]
    );

    await client.query(
      `
      UPDATE public.trip_date_options
      SET is_selected = true
      WHERE id = $1
        AND trip_id = $2
      `,
      [dateOptionId, tripId]
    );

    const departureResult = await client.query(
      `
      INSERT INTO public.trip_departures (
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'open')
      RETURNING
        id,
        trip_id,
        start_time,
        end_time,
        min_participants,
        max_participants,
        status
      `,
      [
        tripId,
        selectedOption.start_time,
        selectedOption.end_time,
        minParticipants,
        maxParticipants,
      ]
    );

    const departure = departureResult.rows[0];

    await client.query(
      `
      UPDATE public.tiu_trips
      SET planning_status = 'binding_open'
      WHERE trip_id = $1
      `,
      [tripId]
    );

    const interestedUsersResult = await client.query(
      `
      SELECT ti.user_id
      FROM public.trip_interest ti
      WHERE ti.trip_id = $1
        AND ti.status = 'interested'
      `,
      [tripId]
    );

    for (const row of interestedUsersResult.rows) {
      await client.query(
        `
        INSERT INTO public.user_notifications
          (user_id, type, reference_id, title, message, action_url, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT DO NOTHING
        `,
        [
          String(row.user_id),
          "trip_date_selected",
          `trip:${tripId}:departure:${departure.id}:date_selected`,
          "Dato valgt for tur",
          `Dato for turen "${trip.navn}" er valgt. Du kan nå melde deg bindende på.`,
          `/explore/${tripId}`,
          JSON.stringify({
            trip_id: tripId,
            departure_id: departure.id,
            trip_name: trip.navn,
            selected_start_time: selectedOption.start_time,
            selected_end_time: selectedOption.end_time,
          }),
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Dato valgt og avgang opprettet",
        departure,
      },
      { status: 200 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Select date API error:", error);

    return NextResponse.json(
      {
        error: "Kunne ikke velge datoalternativ",
        details: error?.message || "Ukjent feil",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}