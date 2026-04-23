// Importerer NextResponse for å kunne returnere JSON-responser fra API-ruter.
import { NextResponse } from "next/server";

// Importerer databaseforbindelsen/poolen.
import pool from "../../../lib/db";

// Importerer autentiserings- og autorisasjonsfunksjoner.
import { requireAuth, requireRole } from "../../../lib/auth";

// Importerer rolle-konstanter som brukes for tilgangskontroll.
import { ROLE_ADMIN, ROLE_TURLEDER } from "../../../lib/roles";


// Sender varsel til alle admin-brukere når en ny TiU-tur er opprettet.
// Varslingsfeil skal ikke stoppe selve opprettelsen av turen.
async function notifyAdmins(client, tripId, tripNavn) {
  try {
    // Henter alle brukere med admin-rolle.
    const adminsResult = await client.query(
      `SELECT id::text AS id FROM public.users WHERE role = $1`,
      [ROLE_ADMIN]
    );

    // Oppretter ett varsel per admin.
    for (const admin of adminsResult.rows) {
      await client.query(
        `
          INSERT INTO public.user_notifications
            (user_id, type, reference_id, title, message, action_url, metadata)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT DO NOTHING
        `,
        [
          admin.id,
          "new_tiu_trip",
          `tiu-trip:${tripId}`,
          "Ny TiU-tur til godkjenning",
          `Turen "${tripNavn}" er sendt inn og venter på godkjenning.`,
          `/admin/turer`,
          JSON.stringify({ trip_id: tripId }),
        ]
      );
    }
  } catch {
    // Varslingsfeil skal ikke stoppe opprettelse av tur.
  }
}


// En enkel cache-variabel så vi slipper å prøve å opprette trip_cabins-tabellen flere ganger unødvendig.
let tripCabinsTableReady = false;


// Sørger for at tabellen trip_cabins finnes.
// Denne tabellen brukes for å knytte hytter til turer, og i hvilken rekkefølge de hører til.
async function ensureTripCabinsTable(client) {
  // Hvis vi allerede har kjørt dette i denne serverprosessen, hopp over.
  if (tripCabinsTableReady) return;

  // Oppretter tabellen hvis den ikke finnes.
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.trip_cabins (
      trip_id BIGINT NOT NULL,
      cabin_id UUID NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (trip_id, cabin_id)
    )
  `);

  // Lager indeks for raskere oppslag per tur.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trip_cabins_trip_id
    ON public.trip_cabins (trip_id)
  `);

  // Sørger for at sort_order-kolonnen finnes, også hvis tabellen eksisterte fra før i eldre format.
  await client.query(`
    ALTER TABLE public.trip_cabins
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
  `);

  // Marker som ferdig initialisert.
  tripCabinsTableReady = true;
}


// Sørger for at turleder_user_id finnes i tiu_trips-tabellen.
// Denne brukes for å koble en TiU-turleder til faktisk bruker-ID.
async function ensureTurlederUserIdColumn(client) {
  // Legger til kolonnen hvis den mangler.
  await client.query(`
    ALTER TABLE public.tiu_trips
    ADD COLUMN IF NOT EXISTS turleder_user_id UUID NULL
  `);

  // Lager indeks for raskere oppslag.
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tiu_trips_turleder_user_id
    ON public.tiu_trips (turleder_user_id)
  `);

  // Fyller inn turleder_user_id for gamle rader ved å matche username mot turleder_navn.
  await client.query(`
    UPDATE public.tiu_trips tt
    SET turleder_user_id = u.id
    FROM public.users u
    WHERE tt.turleder_user_id IS NULL
      AND u.username = tt.turleder_navn
  `);
}


// Sjekker om trip_cabins-tabellen har kolonnen night_number.
// Dette trengs fordi databasen kan være i litt ulike versjoner.
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


// GET-ruta henter en liste over turer.
// Den støtter filtrering på søk, type, vanskelighetsgrad, TiU-only og dato.
export async function GET(request) {
  try {
    // Leser query-parametere fra URL-en.
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "alle";
    const difficulty = searchParams.get("difficulty") || "alle";
    const onlyTiu = (searchParams.get("onlyTiu") || "false") === "true";
    const startDate = searchParams.get("start_date") || "";
    const endDate = searchParams.get("end_date") || "";

    // Basisspørring som henter turer, eventuell TiU-info og første aktive avgang.
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
        tt.turleder_user_id,
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
        AND (tt.id IS NULL OR tt.planning_status NOT IN ('draft', 'rejected'))
    `;

    // Første parameter er søket på navn.
    const values = [`%${search}%`];

    // Filtrer på type hvis valgt.
    if (type !== "alle") {
      query += ` AND t.type = $${values.length + 1}`;
      values.push(type);
    }

    // Filtrer på vanskelighetsgrad hvis valgt.
    if (difficulty !== "alle") {
      query += ` AND t.vanskelighetsgrad = $${values.length + 1}`;
      values.push(difficulty);
    }

    // Filtrer til bare TiU-turer hvis det er huket av.
    if (onlyTiu) {
      query += ` AND tt.id IS NOT NULL`;
    }

    // Dato-filter:
    // Turen skal vises hvis enten en aktiv avgang eller et datoalternativ overlapper valgt datoperiode.
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

    // Sorterer resultatene på ID.
    query += ` ORDER BY t.id`;

    // Kjører SQL-spørringen.
    const result = await pool.query(query, values);

    // Returnerer turene som JSON.
    return NextResponse.json(result.rows);
  } catch (error) {
    // Logger feil i server-konsollen.
    console.error("Trips API GET error:", error);

    // Returnerer generell feilmelding til klienten.
    return NextResponse.json(
      { error: "Kunne ikke hente turer" },
      { status: 500 }
    );
  }
}


// POST-ruta oppretter en ny tur.
export async function POST(request) {
  // Henter en klient fra poolen så vi kan bruke transaksjon.
  const client = await pool.connect();

  try {
    // Leser request body som JSON.
    const body = await request.json();

    // Henter og normaliserer vanlige felt.
    const navn = (body.navn || "").trim();
    const beskrivelse = body.beskrivelse ?? null;
    const lengde_km = Number(body.lengde_km);
    const type = (body.type || "").trim();
    const vanskelighetsgrad = (body.vanskelighetsgrad || "").trim();
    const bilde_url = body.bilde_url?.trim() || null;
    const geometry = body.geometry ?? null;

    // Henter TiU-relaterte felt.
    const isTiu = body.isTiu === true;
    const turleder_navn = body.turleder_navn?.trim() || null;

    // Henter info om fleksibel tur og datoalternativer.
    const isFlexible = body.isFlexible === true;
    const dateOptions = Array.isArray(body.dateOptions) ? body.dateOptions : [];

    // Henter cabin_ids, rydder bort tomme verdier og dubletter.
    const cabinIdsRaw = Array.isArray(body.cabin_ids) ? body.cabin_ids : [];
    const cabin_ids = [...new Set(cabinIdsRaw.map((id) => String(id).trim()).filter(Boolean))];

    // Bruker settes senere hvis auth trengs.
    let user = null;

    // Hvis dette er en TiU-tur, må brukeren være innlogget og ha riktig rolle.
    if (isTiu) {
      const auth = await requireAuth();
      if (auth.response) {
        return auth.response;
      }

      user = auth.user;

      const roleError = requireRole(user, [ROLE_ADMIN, ROLE_TURLEDER]);
      if (roleError) {
        return roleError;
      }
    }

    // Validerer at navn finnes.
    if (!navn) {
      return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
    }

    // Validerer at lengde_km er et positivt tall.
    if (!Number.isFinite(lengde_km) || lengde_km <= 0) {
      return NextResponse.json(
        { error: "Lengde (km) må være et positivt tall" },
        { status: 400 }
      );
    }

    // Validerer type.
    const allowedTypes = new Set(["fottur", "skitur", "sykkel"]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
    }

    // Validerer vanskelighetsgrad.
    const allowedDiff = new Set(["lett", "middels", "krevende"]);
    if (!allowedDiff.has(vanskelighetsgrad)) {
      return NextResponse.json(
        { error: "Ugyldig vanskelighetsgrad" },
        { status: 400 }
      );
    }

    // Validerer geometri hvis den finnes.
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

    // Begrens antall hytter som kan knyttes til turen.
    if (cabin_ids.length > 25) {
      return NextResponse.json(
        { error: "Du kan velge maks 25 hytter per tur" },
        { status: 400 }
      );
    }

    // TiU-turer må ha turledernavn.
    if (isTiu && !turleder_navn) {
      return NextResponse.json(
        { error: "Turleder må fylles ut for TiU-tur" },
        { status: 400 }
      );
    }

    // Fleksibel tur må være TiU-tur.
    if (isFlexible && !isTiu) {
      return NextResponse.json(
        { error: "Fleksibel fellestur må være en TiU-tur" },
        { status: 400 }
      );
    }

    // TiU-turer må være fleksible i denne løsningen.
    if (isTiu && !isFlexible) {
      return NextResponse.json(
        { error: "TiU-turer må ha fleksible startdatoer" },
        { status: 400 }
      );
    }

    // TiU-turer må ha mellom 3 og 5 datoalternativer.
    if (isTiu && (dateOptions.length < 3 || dateOptions.length > 5)) {
      return NextResponse.json(
        { error: "Fleksibel fellestur må ha 3–5 datoalternativer" },
        { status: 400 }
      );
    }

    // Validerer hvert datoalternativ for TiU-turer.
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

    // Sjekker at alle cabin_ids faktisk finnes i cabins-tabellen.
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

    // Lager et map fra cabin-id til cabin-rad for senere bruk i responsen.
    const cabinsById = new Map(cabinsResult.rows.map((row) => [String(row.id), row]));

    // Starter transaksjon.
    await client.query("BEGIN");

    // Sørger for at nødvendige tabeller/kolonner finnes.
    await ensureTripCabinsTable(client);
    await ensureTurlederUserIdColumn(client);
    const hasNightNumberColumn = await hasTripCabinsNightNumberColumn(client);

    // SQL for å opprette selve turen i trips-tabellen.
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

    // Verdiene til insert-spørringen.
    const tripValues = [
      navn,
      beskrivelse,
      lengde_km,
      type,
      vanskelighetsgrad,
      bilde_url,
      geometry,
    ];

    // Oppretter turen og henter den tilbake.
    const tripResult = await client.query(insertTripQuery, tripValues);
    const trip = tripResult.rows[0];

    // Hvis det er en TiU-tur, oppretter vi også rad i tiu_trips.
    if (isTiu) {
      // Nye TiU-turer starter som draft.
      const planningStatus = "draft";

      const tiuResult = await client.query(
        `
        INSERT INTO public.tiu_trips (
          trip_id,
          turleder_navn,
          turleder_user_id,
          is_flexible,
          planning_status
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, turleder_navn, turleder_user_id, is_flexible, planning_status
        `,
        [trip.id, turleder_navn, user.id, isFlexible, planningStatus]
      );

      // Legger TiU-informasjonen inn i responsobjektet.
      trip.tiu_trip_id = tiuResult.rows[0].id;
      trip.turleder_navn = tiuResult.rows[0].turleder_navn;
      trip.turleder_user_id = tiuResult.rows[0].turleder_user_id;
      trip.is_flexible = tiuResult.rows[0].is_flexible;
      trip.planning_status = tiuResult.rows[0].planning_status;
    } else {
      // Hvis det ikke er TiU-tur, sett feltene til null/falsk.
      trip.tiu_trip_id = null;
      trip.turleder_navn = null;
      trip.turleder_user_id = null;
      trip.is_flexible = false;
      trip.planning_status = null;
    }

    // Knytter valgte hytter til turen i trip_cabins.
    for (let i = 0; i < cabin_ids.length; i += 1) {
      if (hasNightNumberColumn) {
        // Hvis kolonnen night_number finnes, bruk den også.
        await client.query(
          `
            INSERT INTO public.trip_cabins (trip_id, cabin_id, sort_order, night_number)
            VALUES ($1, $2, $3, $4)
          `,
          [trip.id, cabin_ids[i], i, i + 1]
        );
      } else {
        // Eldre databaseskjema uten night_number.
        await client.query(
          `
            INSERT INTO public.trip_cabins (trip_id, cabin_id, sort_order)
            VALUES ($1, $2, $3)
          `,
          [trip.id, cabin_ids[i], i]
        );
      }
    }

    // Hvis det er en TiU-tur, opprett alle datoalternativene.
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

    // Legger til cabin-info i responsobjektet.
    trip.cabins = cabin_ids
      .map((id) => cabinsById.get(id))
      .filter(Boolean)
      .map((row) => ({ id: row.id, name: row.name }));

    // Fullfører transaksjonen.
    await client.query("COMMIT");

    // Etter commit: varsle adminer hvis dette er en TiU-tur.
    if (isTiu) {
      await notifyAdmins(client, trip.id, trip.navn);
    }

    // Returnerer den opprettede turen.
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    // Hvis noe feiler, prøv rollback.
    await client.query("ROLLBACK");

    // Logger feilen i server-konsollen.
    console.error("Trips API POST error:", error);

    // Returnerer generell feilmelding til klienten.
    return NextResponse.json(
      { error: "Kunne ikke opprette tur" },
      { status: 500 }
    );
  } finally {
    // Frigir databaseklienten tilbake til poolen.
    client.release();
  }
}