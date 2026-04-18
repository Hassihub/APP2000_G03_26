import { NextResponse } from "next/server";
import pool from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/auth";

export async function POST(request, { params }) {
  const client = await pool.connect();

  try {
    const { user, response } = await requireAuth();
    if (response) {
      return response;
    }

    const userId = user.id;
    const departureId = Number(params.departureId);

    if (!Number.isFinite(departureId)) {
      return NextResponse.json(
        { error: "Ugyldig avgang" },
        { status: 400 }
      );
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
      [departureId]
    );

    if (departureResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgang ikke funnet" },
        { status: 404 }
      );
    }

    const departure = departureResult.rows[0];

    if (departure.status === "cancelled") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Avgangen er avlyst" },
        { status: 400 }
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
      [userId, departure.start_time, departure.end_time, departureId]
    );

    if (overlapResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du har allerede en overlappende bindende påmelding" },
        { status: 400 }
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
      [departureId, userId]
    );

    if (
      existingRegistrationResult.rowCount > 0 &&
      existingRegistrationResult.rows[0].status === "binding"
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Du er allerede bindende påmeldt denne avgangen" },
        { status: 400 }
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
        [departureId]
      );

      const currentBindingCount = capacityResult.rows[0].binding_count;

      if (currentBindingCount >= departure.max_participants) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Avgangen er fullbooket" },
          { status: 400 }
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
        [departureId, userId]
      );
    } else {
      await client.query(
        `
        INSERT INTO public.trip_registrations (departure_id, user_id, status)
        VALUES ($1, $2, 'binding')
        `,
        [departureId, userId]
      );
    }

    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS binding_count
      FROM public.trip_registrations
      WHERE departure_id = $1
        AND status = 'binding'
      `,
      [departureId]
    );

    const bindingCount = countResult.rows[0].binding_count;
    const shouldConfirm = bindingCount >= departure.min_participants;

    if (shouldConfirm && departure.status === "open") {
      await client.query(
        `
        UPDATE public.trip_departures
        SET status = 'confirmed'
        WHERE id = $1
        `,
        [departureId]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Bindende påmelding registrert",
        departure: {
          id: departure.id,
          trip_id: departure.trip_id,
          start_time: departure.start_time,
          end_time: departure.end_time,
          min_participants: departure.min_participants,
          max_participants: departure.max_participants,
          status: shouldConfirm ? "confirmed" : departure.status,
        },
        binding_count: bindingCount,
        confirmed: shouldConfirm,
      },
      { status: 200 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("Register API error:", error);

    return NextResponse.json(
      { error: "Kunne ikke registrere bindende påmelding" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}