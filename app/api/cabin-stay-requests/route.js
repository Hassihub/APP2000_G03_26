// Skrevet av Sigurd

import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth, requireRole } from "../../../lib/auth";
import { ROLE_ADMIN, ROLE_TURLEDER } from "../../../lib/roles";

let stayRequestsTableReady = false;
let notificationsTableReady = false;

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function ensureStayRequestsTable() {
  if (stayRequestsTableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS public.cabin_stay_requests (
      id BIGSERIAL PRIMARY KEY,
      trip_id BIGINT NOT NULL,
      cabin_id UUID NOT NULL,
      requester_user_id TEXT NOT NULL,
      requested_beds INTEGER NOT NULL CHECK (requested_beds > 0),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      owner_response TEXT,
      requested_start DATE,
      requested_end DATE,
      approved_beds INTEGER,
      reservation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE (trip_id, cabin_id, requester_user_id)
    )
  `);

  await db.query(`ALTER TABLE public.cabin_stay_requests ADD COLUMN IF NOT EXISTS requested_start DATE`);
  await db.query(`ALTER TABLE public.cabin_stay_requests ADD COLUMN IF NOT EXISTS requested_end DATE`);
  await db.query(`ALTER TABLE public.cabin_stay_requests ADD COLUMN IF NOT EXISTS approved_beds INTEGER`);
  await db.query(`ALTER TABLE public.cabin_stay_requests ADD COLUMN IF NOT EXISTS reservation_id TEXT`);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cabin_stay_requests_trip
    ON public.cabin_stay_requests (trip_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cabin_stay_requests_requester
    ON public.cabin_stay_requests (requester_user_id, created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cabin_stay_requests_cabin
    ON public.cabin_stay_requests (cabin_id, created_at DESC)
  `);

  stayRequestsTableReady = true;
}

async function ensureNotificationsTable() {
  if (notificationsTableReady) return true;

  try {
    await db.query(`
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

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
      ON public.user_notifications (user_id, created_at DESC)
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notifications_reference
      ON public.user_notifications (user_id, type, reference_id)
      WHERE reference_id IS NOT NULL
    `);

    notificationsTableReady = true;
    return true;
  } catch {
    return false;
  }
}

async function userAllowsNotifications(userId) {
  try {
    const result = await db.query(
      `
        SELECT COALESCE(notifications, true) AS notifications_enabled
        FROM public.users
        WHERE id = $1
        LIMIT 1
      `,
      [String(userId)]
    );

    if (result.rowCount === 0) return true;
    return Boolean(result.rows[0]?.notifications_enabled);
  } catch {
    return true;
  }
}

async function createNotification({ userId, type, referenceId, title, message, actionUrl, metadata, force = false }) {
  const hasNotifications = await ensureNotificationsTable();
  if (!hasNotifications) return;

  if (!force) {
    const allowsNotifications = await userAllowsNotifications(userId);
    if (!allowsNotifications) return;
  }

  const targetUserId = String(userId);
  const normalizedType = String(type);
  const normalizedReferenceId = referenceId == null ? null : String(referenceId);
  const normalizedTitle = String(title || "Varsling");
  const normalizedMessage = String(message || "");
  const normalizedActionUrl = String(actionUrl || "/reserver/foresporsler");
  const metadataJson = JSON.stringify(metadata || {});

  if (normalizedReferenceId) {
    const updateResult = await db.query(
      `
        UPDATE public.user_notifications
        SET title = $4,
            message = $5,
            action_url = $6,
            metadata = $7::jsonb,
            is_read = false,
            read_at = NULL,
            created_at = NOW()
        WHERE user_id = $1
          AND type = $2
          AND reference_id = $3
        RETURNING id
      `,
      [
        targetUserId,
        normalizedType,
        normalizedReferenceId,
        normalizedTitle,
        normalizedMessage,
        normalizedActionUrl,
        metadataJson,
      ]
    );

    if (updateResult.rowCount > 0) {
      return;
    }
  }

  await db.query(
    `
      INSERT INTO public.user_notifications
        (user_id, type, reference_id, title, message, action_url, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT DO NOTHING
    `,
    [
      targetUserId,
      normalizedType,
      normalizedReferenceId,
      normalizedTitle,
      normalizedMessage,
      normalizedActionUrl,
      metadataJson,
    ]
  );
}

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    await ensureStayRequestsTable();

    const userId = String(user.id);

    const incomingResult = await db.query(
      `
        SELECT
          csr.id,
          csr.trip_id,
          csr.cabin_id::text AS cabin_id,
          csr.requester_user_id,
          csr.requested_beds,
          csr.message,
          csr.status,
          csr.owner_response,
          csr.created_at,
          csr.updated_at,
          csr.responded_at,
          csr.requested_start::text AS requested_start,
          csr.requested_end::text AS requested_end,
          csr.approved_beds,
          csr.approved_start::text AS approved_start,
          csr.approved_end::text AS approved_end,
          csr.reservation_id,
          dto.trip_date_options,
          t.navn AS trip_name,
          c.name AS cabin_name,
          c.location AS cabin_location,
          c.capacity AS cabin_capacity,
          c.owner_id::text AS owner_id,
          u.username AS requester_name,
          u.email AS requester_email
        FROM public.cabin_stay_requests csr
        JOIN public.cabins c
          ON c.id = csr.cabin_id
        LEFT JOIN public.trips t
          ON t.id = csr.trip_id
        LEFT JOIN public.tiu_trips tt
          ON tt.trip_id = csr.trip_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              jsonb_build_object(
                'id', tdo.id,
                'start_time', tdo.start_time,
                'end_time', tdo.end_time,
                'is_selected', tdo.is_selected
              )
              ORDER BY tdo.start_time ASC
            ),
            '[]'::json
          ) AS trip_date_options
          FROM public.trip_date_options tdo
          WHERE tdo.trip_id = csr.trip_id
        ) dto ON true
        LEFT JOIN public.users u
          ON u.id::text = csr.requester_user_id
        WHERE c.owner_id::text = $1
          AND tt.id IS NOT NULL
        ORDER BY csr.created_at DESC
        LIMIT 200
      `,
      [userId]
    );

    const outgoingResult = await db.query(
      `
        SELECT
          csr.id,
          csr.trip_id,
          csr.cabin_id::text AS cabin_id,
          csr.requester_user_id,
          csr.requested_beds,
          csr.message,
          csr.status,
          csr.owner_response,
          csr.created_at,
          csr.updated_at,
          csr.responded_at,
          csr.requested_start::text AS requested_start,
          csr.requested_end::text AS requested_end,
          csr.approved_beds,
          csr.approved_start::text AS approved_start,
          csr.approved_end::text AS approved_end,
          csr.reservation_id,
          dto.trip_date_options,
          t.navn AS trip_name,
          c.name AS cabin_name,
          c.location AS cabin_location,
          c.capacity AS cabin_capacity,
          c.owner_id::text AS owner_id
        FROM public.cabin_stay_requests csr
        JOIN public.cabins c
          ON c.id = csr.cabin_id
        LEFT JOIN public.trips t
          ON t.id = csr.trip_id
        LEFT JOIN public.tiu_trips tt
          ON tt.trip_id = csr.trip_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              jsonb_build_object(
                'id', tdo.id,
                'start_time', tdo.start_time,
                'end_time', tdo.end_time,
                'is_selected', tdo.is_selected
              )
              ORDER BY tdo.start_time ASC
            ),
            '[]'::json
          ) AS trip_date_options
          FROM public.trip_date_options tdo
          WHERE tdo.trip_id = csr.trip_id
        ) dto ON true
        WHERE csr.requester_user_id = $1
          AND tt.id IS NOT NULL
        ORDER BY csr.created_at DESC
        LIMIT 200
      `,
      [userId]
    );

    return NextResponse.json(
      {
        incoming: incomingResult.rows,
        outgoing: outgoingResult.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cabin stay requests GET error:", error);
    return NextResponse.json({ error: "Kunne ikke hente foresporsler" }, { status: 500 });
  }
}

export async function POST(request) {
  let stage = "start";
  try {
    stage = "auth";
    const { user, response } = await requireAuth();
    if (response) return response;

    stage = "role";
    const roleError = requireRole(user, [ROLE_ADMIN, ROLE_TURLEDER]);
    if (roleError) return roleError;

    stage = "ensure_stay_requests_table";
    await ensureStayRequestsTable();

    stage = "parse_body";
    const body = await request.json().catch(() => ({}));
    const tripId = Number(body?.trip_id);
    const requestsRaw = Array.isArray(body?.requests) ? body.requests : [];
    const message = typeof body?.message === "string" ? body.message.trim() : null;
    const requestedStart = String(body?.requested_start || "").trim();
    const requestedEnd = String(body?.requested_end || "").trim();

    stage = "validate_payload";
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return badRequest("Mangler gyldig trip_id");
    }

    if (requestsRaw.length === 0) {
      return badRequest("Minst en hytteforesporsel ma sendes");
    }

    if (requestsRaw.length > 25) {
      return badRequest("Maks 25 hytteforesporsler per tur");
    }

    if ((requestedStart && !requestedEnd) || (!requestedStart && requestedEnd)) {
      return badRequest("Oppgi både start- og sluttdato, eller la begge stå tomme for fleksibel start");
    }

    if (requestedStart && requestedEnd && requestedStart >= requestedEnd) {
      return badRequest("Startdato må være før sluttdato");
    }

    for (const raw of requestsRaw) {
      const cabinId = String(raw?.cabin_id || "").trim();
      if (!isUuid(cabinId)) {
        return badRequest("Ugyldig cabin_id i foresporsel. Velg hytte pa nytt.");
      }
    }

    stage = "fetch_trip";
    const tripResult = await db.query(
      `
        SELECT t.id, t.navn, tt.id AS tiu_trip_id
        FROM public.trips t
        LEFT JOIN public.tiu_trips tt
          ON tt.trip_id = t.id
        WHERE t.id = $1
        LIMIT 1
      `,
      [tripId]
    );

    if (tripResult.rowCount === 0) {
      return badRequest("Turen finnes ikke");
    }

    const trip = tripResult.rows[0];
    if (!trip.tiu_trip_id) {
      return badRequest("Overnattingsforesporsler kan bare sendes for TiU-turer");
    }

    const uniqueCabinIds = [
      ...new Set(
        requestsRaw
          .map((item) => String(item?.cabin_id || "").trim())
          .filter(Boolean)
      ),
    ];

    if (uniqueCabinIds.length !== requestsRaw.length) {
      return badRequest("Du kan bare sende en foresporsel per hytte");
    }

    stage = "fetch_cabins";
    const cabinsResult = await db.query(
      `
        SELECT
          id::text AS id,
          name,
          capacity,
          owner_id::text AS owner_id
        FROM public.cabins
        WHERE id::text = ANY($1::text[])
      `,
      [uniqueCabinIds]
    );

    if (cabinsResult.rowCount !== uniqueCabinIds.length) {
      return badRequest("En eller flere valgte hytter finnes ikke");
    }

    const cabinsById = new Map(cabinsResult.rows.map((row) => [String(row.id), row]));
    const requesterUserId = String(user.id);

    stage = "prepare_requests";
    const prepared = [];
    for (const rawRequest of requestsRaw) {
      const cabinId = String(rawRequest?.cabin_id || "").trim();
      const requestedBeds = Number(rawRequest?.requested_beds);
      const cabin = cabinsById.get(cabinId);

      if (!cabin) {
        return badRequest("Ugyldig hytte i foresporsel");
      }

      if (!Number.isInteger(requestedBeds) || requestedBeds <= 0) {
        return badRequest(`Antall sengeplasser for ${cabin.name || "hytte"} ma vaere et positivt heltall`);
      }

      const capacity = Number(cabin.capacity);
      if (Number.isFinite(capacity) && requestedBeds > capacity) {
        return badRequest(`Antall sengeplasser for ${cabin.name || "hytte"} kan ikke overstige kapasitet (${capacity})`);
      }

      prepared.push({
        cabin,
        cabinId,
        requestedBeds,
      });
    }

    stage = "begin_transaction";
    await db.query("BEGIN");

    const inserted = [];

    stage = "insert_requests";
    for (const requestItem of prepared) {
      const result = await db.query(
        `
          INSERT INTO public.cabin_stay_requests
            (trip_id, cabin_id, requester_user_id, requested_beds, message, status, owner_response, responded_at, updated_at, requested_start, requested_end)
          VALUES
            ($1, $2::uuid, $3, $4, $5, 'pending', NULL, NULL, NOW(), $6::date, $7::date)
          ON CONFLICT (trip_id, cabin_id, requester_user_id)
          DO UPDATE SET
            requested_beds = EXCLUDED.requested_beds,
            message = EXCLUDED.message,
            status = 'pending',
            owner_response = NULL,
            responded_at = NULL,
            updated_at = NOW()
          RETURNING
            id,
            trip_id,
            cabin_id::text AS cabin_id,
            requester_user_id,
            requested_beds,
            message,
            status,
            owner_response,
            requested_start,
            requested_end,
            created_at,
            updated_at,
            responded_at
        `,
        [
          tripId,
          requestItem.cabinId,
          requesterUserId,
          requestItem.requestedBeds,
          message,
          requestedStart || null,
          requestedEnd || null,
        ]
      );

      const row = result.rows[0];
      inserted.push({
        ...row,
        trip_name: trip.navn,
        cabin_name: requestItem.cabin.name,
        owner_id: requestItem.cabin.owner_id,
      });
    }

    stage = "commit_transaction";
    await db.query("COMMIT");

    stage = "create_notifications";
    for (const row of inserted) {
      if (!row.owner_id || row.owner_id === requesterUserId) continue;

      const startDateText = String(row.requested_start || "").trim();
      const endDateText = String(row.requested_end || "").trim();
      const hasRequestedDates = Boolean(startDateText && endDateText);
      const stayMessage = hasRequestedDates
        ? `${String(user.username || "Turleder")} vil overnatte pa ${String(row.cabin_name || "hytta")} fra ${startDateText.slice(0, 10)} til ${endDateText.slice(0, 10)}.`
        : `${String(user.username || "Turleder")} vil overnatte pa ${String(row.cabin_name || "hytta")}. Datoer velges ved godkjenning.`;

      await createNotification({
        userId: row.owner_id,
        type: "cabin_stay_request_received",
        referenceId: `stay-request:${row.id}`,
        title: "Ny foresporsel om overnatting",
        message: stayMessage,
        actionUrl: `/reserver/foresporsler?view=incoming&requestId=${encodeURIComponent(String(row.id))}`,
        metadata: {
          stay_request_id: row.id,
          trip_id: row.trip_id,
          trip_name: row.trip_name,
          cabin_id: row.cabin_id,
          cabin_name: row.cabin_name,
          requested_beds: row.requested_beds,
          requested_start: row.requested_start,
          requested_end: row.requested_end,
          requester_user_id: requesterUserId,
        },
        force: true,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        requests: inserted,
      },
      { status: 201 }
    );
  } catch (error) {
    const failedStage = stage;
    try {
      await db.query("ROLLBACK");
    } catch {
      // ignorer rollback-feil
    }
    console.error("Cabin stay requests POST error:", error);
    const details = process.env.NODE_ENV === "production"
      ? undefined
      : `${failedStage}: ${String(error?.message || "ukjent feil")}`;
    return NextResponse.json(
      {
        error: "Kunne ikke opprette foresporsler",
        ...(details ? { details } : {}),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    await ensureStayRequestsTable();

    const body = await request.json().catch(() => ({}));
    const requestId = String(body?.requestId ?? "").trim();
    const decisionRaw = String(body?.decision || "").trim().toLowerCase();
    const ownerResponse = typeof body?.ownerResponse === "string"
      ? body.ownerResponse.trim().slice(0, 1000)
      : null;
    const approvalStart = String(body?.requested_start || "").trim();
    const approvalEnd = String(body?.requested_end || "").trim();

    if (!/^[0-9]+$/.test(requestId)) {
      return badRequest("Mangler gyldig requestId");
    }

    if (decisionRaw !== "approve" && decisionRaw !== "reject") {
      return badRequest("decision ma vaere approve eller reject");
    }

    const nextStatus = decisionRaw === "approve" ? "approved" : "rejected";

    const existingResult = await db.query(
      `
        SELECT
          csr.id,
          csr.trip_id,
          csr.cabin_id::text AS cabin_id,
          csr.requester_user_id,
          csr.requested_beds,
          csr.requested_start::text AS requested_start,
          csr.requested_end::text AS requested_end,
          csr.status,
          c.owner_id::text AS owner_id,
          c.name AS cabin_name,
          c.capacity,
          t.navn AS trip_name,
          tt.id AS tiu_trip_id,
          u.username AS requester_name,
          u.email AS requester_email
        FROM public.cabin_stay_requests csr
        JOIN public.cabins c
          ON c.id = csr.cabin_id
        LEFT JOIN public.trips t
          ON t.id = csr.trip_id
        LEFT JOIN public.tiu_trips tt
          ON tt.trip_id = csr.trip_id
        LEFT JOIN public.users u
          ON u.id::text = csr.requester_user_id
        WHERE csr.id::text = $1
        LIMIT 1
      `,
      [requestId]
    );

    if (existingResult.rowCount === 0) {
      return NextResponse.json({ error: "Foresporselen finnes ikke" }, { status: 404 });
    }

    const existing = existingResult.rows[0];
    const userId = String(user.id);

    const rawApprovedBeds = body?.approved_beds ?? body?.requested_beds;
    const approvedBeds =
      rawApprovedBeds == null || String(rawApprovedBeds).trim() === ""
        ? Number(existing.requested_beds)
        : Number(rawApprovedBeds);

    if (String(existing.owner_id || "") !== userId) {
      return NextResponse.json({ error: "Kun hytteeier kan svare pa foresporselen" }, { status: 403 });
    }

    if (existing.status !== "pending") {
      return badRequest("Foresporselen er allerede behandlet");
    }

    if (!existing.tiu_trip_id) {
      return badRequest("Kun foresporsler for TiU-turer kan behandles");
    }

    let reservationId = null;

    if (decisionRaw === "approve") {
      const startDate = approvalStart || String(existing.requested_start || "").trim();
      const endDate = approvalEnd || String(existing.requested_end || "").trim();

      if (!startDate || !endDate) {
        return badRequest("Velg start- og sluttdato før godkjenning. Forespørselen kan være fleksibel, men reservasjonen må få konkrete datoer.");
      }

      if (startDate >= endDate) {
        return badRequest("Startdato må være før sluttdato");
      }

      if (approvedBeds <= 0 || !Number.isFinite(approvedBeds)) {
        return badRequest("Godkjente sengeplasser ma vaere et positivt tall");
      }

      const capacity = Number(existing.capacity);
      if (Number.isFinite(capacity) && approvedBeds > capacity) {
        return badRequest(`Godkjente sengeplasser kan ikke overstige kapasitet (${capacity})`);
      }

      await db.query("BEGIN");

      let updateResult;

      try {
        const overlapResult = await db.query(
          `
            SELECT 1
            FROM public.reservations
            WHERE cabin_id = $1
              AND status <> 'cancelled'
              AND NOT (end_date <= $2::date OR start_date >= $3::date)
            LIMIT 1
          `,
          [existing.cabin_id, startDate, endDate]
        );

        if (overlapResult.rowCount > 0) {
          await db.query("ROLLBACK");
          return NextResponse.json(
            { error: "Hytta er allerede reservert i den perioden. Kan ikke godkjenne." },
            { status: 409 }
          );
        }

        const requesterName = String(existing.requester_name || existing.requester_user_id || "Turleder").substring(0, 50);
        const guestEmail = String(existing.requester_email || existing.requester_user_id || "guest@example.com").substring(0, 100);

        const reservationResult = await db.query(
          `
            INSERT INTO public.reservations
              (cabin_id, guest_user_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status)
            VALUES
              ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'active')
            RETURNING id
          `,
          [
            existing.cabin_id,
            existing.requester_user_id,
            requesterName,
            guestEmail,
            startDate,
            endDate,
            approvedBeds,
            `Automatisk reservasjon fra hytteforespørsel (request ID: ${requestId})`,
          ]
        );

        reservationId = String(reservationResult.rows[0]?.id || "");

        updateResult = await db.query(
          `
            UPDATE public.cabin_stay_requests
            SET status = $2,
                owner_response = $3,
                responded_at = NOW(),
                updated_at = NOW(),
                approved_beds = $4,
                reservation_id = $5,
                approved_start = $6::date,
                approved_end = $7::date
            WHERE id::text = $1
            RETURNING
              id,
              trip_id,
              cabin_id::text AS cabin_id,
              requester_user_id,
              requested_beds,
              message,
              status,
              owner_response,
              approved_beds,
              approved_start::text AS approved_start,
              approved_end::text AS approved_end,
              reservation_id,
              requested_start::text AS requested_start,
              requested_end::text AS requested_end,
              created_at,
              updated_at,
              responded_at
          `,
          [requestId, nextStatus, ownerResponse || null, approvedBeds, reservationId, startDate, endDate]
        );

        await db.query("COMMIT");
      } catch (txError) {
        try {
          await db.query("ROLLBACK");
        } catch {}
        throw txError;
      }

      var updated = {
        ...updateResult.rows[0],
        trip_name: existing.trip_name,
        cabin_name: existing.cabin_name,
      };
    } else {
      const updateResult = await db.query(
        `
          UPDATE public.cabin_stay_requests
          SET status = $2,
              owner_response = $3,
              responded_at = NOW(),
              updated_at = NOW()
          WHERE id::text = $1
          RETURNING
            id,
            trip_id,
            cabin_id::text AS cabin_id,
            requester_user_id,
            requested_beds,
            message,
            status,
            owner_response,
            approved_beds,
            reservation_id,
            requested_start::text AS requested_start,
            requested_end::text AS requested_end,
            created_at,
            updated_at,
            responded_at
        `,
        [requestId, nextStatus, ownerResponse || null]
      );

      var updated = {
        ...updateResult.rows[0],
        trip_name: existing.trip_name,
        cabin_name: existing.cabin_name,
      };
    }

    if (String(existing.requester_user_id || "").trim()) {
      const statusLabel = nextStatus === "approved" ? "godkjent" : "avslatt";
      let message = `Foresporselen om overnatting pa ${String(existing.cabin_name || "hytta")} ble ${statusLabel}.`;
      
      if (nextStatus === "approved") {
        const aStart = String(updated.approved_start || "").slice(0, 10);
        const aEnd = String(updated.approved_end || "").slice(0, 10);
        message = `Overnatting godkjent! Reservasjon opprettet fra ${aStart} til ${aEnd}.`;
      }

      await createNotification({
        userId: existing.requester_user_id,
        type: "cabin_stay_request_decision",
        referenceId: `stay-request:${updated.id}:decision:${nextStatus}`,
        title: "Svar pa overnattingsforesporsel",
        message: message,
        actionUrl: `/reserver/foresporsler?view=outgoing&requestId=${encodeURIComponent(String(updated.id))}`,
        metadata: {
          stay_request_id: updated.id,
          trip_id: updated.trip_id,
          trip_name: existing.trip_name,
          cabin_id: updated.cabin_id,
          cabin_name: existing.cabin_name,
          requested_beds: updated.requested_beds,
          approved_beds: updated.approved_beds,
          status: updated.status,
          owner_response: updated.owner_response,
          reservation_id: updated.reservation_id,
        },
      });
    }

    return NextResponse.json({ ok: true, request: updated }, { status: 200 });
  } catch (error) {
    console.error("Cabin stay requests PATCH error:", error);
    const detail = process.env.NODE_ENV !== "production"
      ? String(error?.message || "ukjent feil")
      : undefined;
    return NextResponse.json(
      { error: "Kunne ikke oppdatere foresporsel", ...(detail ? { detail } : {}) },
      { status: 500 }
    );
  }
}
