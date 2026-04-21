import { NextResponse } from "next/server";
import pool from "../../../lib/db";
import { requireAuth, requireRole } from "../../../lib/auth";
import { ROLE_ADMIN, ROLE_TURLEDER } from "../../../lib/roles";

let tripCabinsTableReady = false;

async function ensureTripCabinsTable(client) {
  if (tripCabinsTableReady) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_cabins (
      trip_id BIGINT NOT NULL,
      cabin_id UUID NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (trip_id, cabin_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_cabins_trip_id
    ON public.trip_cabins (trip_id)
  `);

  await client.query(`
    ALTER TABLE public.trip_cabins
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
  `);

  tripCabinsTableReady = true;
}

async function hasTripCabinsNightNumberColumn(client) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trip_cabins'
          AND column_name = 'night_number'
      ) AS exists
    `
  );

  return result.rows[0]?.exists === true;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "alle";
    const difficulty = searchParams.get("difficulty") || "alle";
    const onlyTiu = (searchParams.get("onlyTiu") || "false") === "true";
    const startDate = searchParams.get("start_date") || "";
    const endDate = searchParams.get("end_date") || "";

    let query = `
      SELECT
        t.id,
        t.navn,
        t.beskrivelse,
        t.lengde_km,
        t.type,
        t.vanskelighetsgrad,
        t.bilde_url,
        t.bilde_urls,
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

    if (startDate && endDate) {
      const startDateParam = `$${values.length + 1}`;
      values.push(startDate);
      const endDateParam = `$${values.length + 1}`;
      values.push(endDate);

      query += `
        AND (
          EXISTS (
            SELECT 1
            FROM public.trip_departures td_filter
            WHERE td_filter.trip_id = t.id
              AND td_filter.status <> 'cancelled'
              AND td_filter.start_time < (${endDateParam}::date + INTERVAL '1 day')
              AND COALESCE(td_filter.end_time, td_filter.start_time) >= ${startDateParam}::date
          )
          OR EXISTS (
            SELECT 1
            FROM public.trip_date_options tdo_filter
            WHERE tdo_filter.trip_id = t.id
              AND tdo_filter.start_time < (${endDateParam}::date + INTERVAL '1 day')
              AND tdo_filter.end_time >= ${startDateParam}::date
          )
        )
      `;
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
    const cabinIdsRaw = Array.isArray(body.cabin_ids) ? body.cabin_ids : [];
    const cabin_ids = [...new Set(cabinIdsRaw.map((id) => String(id).trim()).filter(Boolean))];

    if (isTiu) {
      const { user, response } = await requireAuth();
      if (response) {
        return response;
      }

      const roleError = requireRole(user, [ROLE_ADMIN, ROLE_TURLEDER]);
      if (roleError) {
        return roleError;
      }
    }

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

    if (cabin_ids.length > 25) {
      return NextResponse.json(
        { error: "Du kan velge maks 25 hytter per tur" },
        { status: 400 }
      );
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

    if (isTiu && !isFlexible) {
      return NextResponse.json(
        { error: "TiU-turer må ha fleksible startdatoer" },
        { status: 400 }
      );
    }

    if (isTiu && (dateOptions.length < 3 || dateOptions.length > 5)) {
      return NextResponse.json(
        { error: "Fleksibel fellestur må ha 3–5 datoalternativer" },
        { status: 400 }
      );
    }

    if (isTiu) {
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

    const cabinsResult = await client.query(
      `
        SELECT id::text AS id, name
        FROM public.cabins
        WHERE id::text = ANY($1::text[])
      `,
      [cabin_ids]
    );

    if (cabinsResult.rowCount !== cabin_ids.length) {
      return NextResponse.json(
        { error: "En eller flere valgte hytter finnes ikke" },
        { status: 400 }
      );
    }

    const cabinsById = new Map(cabinsResult.rows.map((row) => [String(row.id), row]));

    await client.query("BEGIN");
    await ensureTripCabinsTable(client);
    const hasNightNumberColumn = await hasTripCabinsNightNumberColumn(client);

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
      const planningStatus = "draft";

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

    for (let i = 0; i < cabin_ids.length; i += 1) {
      if (hasNightNumberColumn) {
        await client.query(
          `
            INSERT INTO public.trip_cabins (trip_id, cabin_id, sort_order, night_number)
            VALUES ($1, $2, $3, $4)
          `,
          [trip.id, cabin_ids[i], i, i + 1]
        );
      } else {
        await client.query(
          `
            INSERT INTO public.trip_cabins (trip_id, cabin_id, sort_order)
            VALUES ($1, $2, $3)
          `,
          [trip.id, cabin_ids[i], i]
        );
      }
    }

    if (isTiu) {
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

    trip.cabins = cabin_ids
      .map((id) => cabinsById.get(id))
      .filter(Boolean)
      .map((row) => ({ id: row.id, name: row.name }));

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