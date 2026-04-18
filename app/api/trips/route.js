import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "alle";
    const difficulty = searchParams.get("difficulty") || "alle";
    const onlyTiu = (searchParams.get("onlyTiu") || "false") === "true";

    let query = `
      SELECT
        t.id,
        t.navn,
        t.beskrivelse,
        t.lengde_km,
        t.type,
        t.vanskelighetsgrad,
        t.bilde_url,
        t.geometry,
        tt.id AS tiu_trip_id,
        tt.turleder_navn,
        tt.is_flexible,
        tt.planning_status,
        (
          SELECT COUNT(*)::int
          FROM public.trip_date_options tdo
          WHERE tdo.trip_id = t.id
        ) AS date_options_count,
        d.id AS departure_id,
        d.status AS departure_status,
        d.start_time AS departure_start_time,
        d.end_time AS departure_end_time,
        d.min_participants,
        d.max_participants
      FROM public.trips t
      LEFT JOIN public.tiu_trips tt
        ON tt.trip_id = t.id
      LEFT JOIN LATERAL (
        SELECT
          td.id,
          td.status,
          td.start_time,
          td.end_time,
          td.min_participants,
          td.max_participants
        FROM public.trip_departures td
        WHERE td.trip_id = t.id
          AND td.status <> 'cancelled'
        ORDER BY td.start_time ASC
        LIMIT 1
      ) d ON true
      WHERE t.navn ILIKE $1
    `;

    const values = [`%${search}%`];

    if (type !== "alle") {
      query += ` AND t.type = $${values.length + 1}`;
      values.push(type);
    }

    if (difficulty !== "alle") {
      query += ` AND t.vanskelighetsgrad = $${values.length + 1}`;
      values.push(difficulty);
    }

    if (onlyTiu) {
      query += ` AND tt.id IS NOT NULL`;
    }

    query += ` ORDER BY t.id`;

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Trips API GET error:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente turer" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const navn = (body.navn || "").trim();
    const beskrivelse = body.beskrivelse ?? null;
    const lengde_km = Number(body.lengde_km);
    const type = (body.type || "").trim();
    const vanskelighetsgrad = (body.vanskelighetsgrad || "").trim();
    const bilde_url = body.bilde_url?.trim() || null;
    const geometry = body.geometry ?? null;

    const isTiu = body.isTiu === true;
    const turleder_navn = body.turleder_navn?.trim() || null;

    const isFlexible = body.isFlexible === true;
    const dateOptions = Array.isArray(body.dateOptions) ? body.dateOptions : [];

    if (!navn) {
      return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
    }

    if (!Number.isFinite(lengde_km) || lengde_km <= 0) {
      return NextResponse.json(
        { error: "Lengde (km) må være et positivt tall" },
        { status: 400 }
      );
    }

    const allowedTypes = new Set(["fottur", "skitur", "sykkel"]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
    }

    const allowedDiff = new Set(["lett", "middels", "krevende"]);
    if (!allowedDiff.has(vanskelighetsgrad)) {
      return NextResponse.json(
        { error: "Ugyldig vanskelighetsgrad" },
        { status: 400 }
      );
    }

    if (geometry !== null) {
      const isObject = typeof geometry === "object" && geometry !== null;
      const hasCoords =
        isObject &&
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 2;

      if (!hasCoords) {
        return NextResponse.json(
          { error: "Ugyldig rute-geometri" },
          { status: 400 }
        );
      }
    }

    if (isTiu && !turleder_navn) {
      return NextResponse.json(
        { error: "Turleder må fylles ut for TiU-tur" },
        { status: 400 }
      );
    }

    if (isFlexible && !isTiu) {
      return NextResponse.json(
        { error: "Fleksibel fellestur må være en TiU-tur" },
        { status: 400 }
      );
    }

    if (isFlexible && (dateOptions.length < 3 || dateOptions.length > 5)) {
      return NextResponse.json(
        { error: "Fleksibel fellestur må ha 3–5 datoalternativer" },
        { status: 400 }
      );
    }

    if (isFlexible) {
      for (const option of dateOptions) {
        const start = option?.start_time;
        const end = option?.end_time;

        if (!start || !end) {
          return NextResponse.json(
            { error: "Alle datoalternativer må ha start- og sluttid" },
            { status: 400 }
          );
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime()) ||
          endDate <= startDate
        ) {
          return NextResponse.json(
            { error: "Ugyldige datoalternativer" },
            { status: 400 }
          );
        }
      }
    }

    await client.query("BEGIN");

    const insertTripQuery = `
      INSERT INTO public.trips
        (
          navn,
          beskrivelse,
          lengde_km,
          type,
          vanskelighetsgrad,
          bilde_url,
          geometry
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      RETURNING
        id,
        navn,
        beskrivelse,
        lengde_km,
        type,
        vanskelighetsgrad,
        opprettet,
        bilde_url,
        geometry
    `;

    const tripValues = [
      navn,
      beskrivelse,
      lengde_km,
      type,
      vanskelighetsgrad,
      bilde_url,
      geometry,
    ];

    const tripResult = await client.query(insertTripQuery, tripValues);
    const trip = tripResult.rows[0];

    if (isTiu) {
      const planningStatus = isFlexible ? "interest_open" : "date_selected";

      const tiuResult = await client.query(
        `
        INSERT INTO public.tiu_trips (
          trip_id,
          turleder_navn,
          is_flexible,
          planning_status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, turleder_navn, is_flexible, planning_status
        `,
        [trip.id, turleder_navn, isFlexible, planningStatus]
      );

      trip.tiu_trip_id = tiuResult.rows[0].id;
      trip.turleder_navn = tiuResult.rows[0].turleder_navn;
      trip.is_flexible = tiuResult.rows[0].is_flexible;
      trip.planning_status = tiuResult.rows[0].planning_status;
    } else {
      trip.tiu_trip_id = null;
      trip.turleder_navn = null;
      trip.is_flexible = false;
      trip.planning_status = null;
    }

    if (isFlexible) {
      for (const option of dateOptions) {
        await client.query(
          `
          INSERT INTO public.trip_date_options (trip_id, start_time, end_time)
          VALUES ($1, $2, $3)
          `,
          [trip.id, option.start_time, option.end_time]
        );
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Trips API POST error:", error);
    return NextResponse.json(
      { error: "Kunne ikke opprette tur" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}