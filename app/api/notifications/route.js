import { NextResponse } from "next/server";
import db from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

let notificationsTableReady = false;
let reservationsGuestUserIdReady = false;
let cabinReviewsTableReady = false;

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function ensureReservationsGuestUserIdColumn() {
  if (reservationsGuestUserIdReady) return true;

  try {
    await db.query(`
      ALTER TABLE public.reservations
      ADD COLUMN IF NOT EXISTS guest_user_id TEXT
    `);
    reservationsGuestUserIdReady = true;
    return true;
  } catch {
    return false;
  }
}

async function markCompletedReservations() {
  try {
    await db.query(
      `
        UPDATE public.reservations
        SET status = 'completed'
        WHERE status <> 'cancelled'
          AND status <> 'completed'
          AND end_date < CURRENT_DATE
      `
    );
  } catch {
    // Livssyklus-opprydding skal ikke blokkere varslinger.
  }
}

async function ensureCabinReviewsTable() {
  if (cabinReviewsTableReady) return true;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.cabin_reviews (
        id BIGSERIAL PRIMARY KEY,
        cabin_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cabin_reviews_cabin_user
      ON public.cabin_reviews (cabin_id, user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_cabin_reviews_cabin_id
      ON public.cabin_reviews (cabin_id)
    `);

    cabinReviewsTableReady = true;
    return true;
  } catch {
    return false;
  }
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

async function createReviewReminderNotifications(user) {
  await ensureReservationsGuestUserIdColumn();
  await ensureCabinReviewsTable();
  const hasTable = await ensureNotificationsTable();
  if (!hasTable) return;

  const userId = String(user.id);
  const userEmail = String(user.email ?? "").trim();

  const endedReservations = await db.query(
    `
      SELECT
        r.id AS reservation_id,
        r.cabin_id,
        c.name AS cabin_name,
        r.end_date
      FROM public.reservations r
      LEFT JOIN public.cabins c ON c.id = r.cabin_id
      LEFT JOIN public.cabin_reviews cr
        ON cr.cabin_id::text = r.cabin_id::text
       AND cr.user_id::text = $1
      LEFT JOIN public.user_notifications un
        ON un.user_id = $1
       AND un.type = 'review_reminder'
       AND un.reference_id = CONCAT('reservation:', r.id::text)
      WHERE (
              r.guest_user_id = $1
              OR ($2 <> '' AND LOWER(r.guest_email) = LOWER($2))
            )
        AND r.status <> 'cancelled'
        AND r.end_date <= CURRENT_DATE
        AND cr.id IS NULL
        AND un.id IS NULL
      ORDER BY r.end_date DESC
      LIMIT 100
    `,
    [userId, userEmail]
  );

  for (const row of endedReservations.rows) {
    const cabinId = String(row.cabin_id ?? "").trim();
    if (!cabinId) continue;

    const cabinName = String(row.cabin_name || "hytta").trim();
    const actionUrl = `/reserver/booking?cabinId=${encodeURIComponent(cabinId)}&review=1#reviews`;

    await db.query(
      `
        INSERT INTO public.user_notifications
          (user_id, type, reference_id, title, message, action_url, metadata)
        VALUES
          ($1, 'review_reminder', $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT DO NOTHING
      `,
      [
        userId,
        `reservation:${row.reservation_id}`,
        "Gi en anmeldelse",
        `Oppholdet ditt på ${cabinName} er over. Del gjerne en anmeldelse med stjerner.`,
        actionUrl,
        JSON.stringify({
          reservation_id: row.reservation_id,
          cabin_id: cabinId,
          end_date: row.end_date,
        }),
      ]
    );
  }
}

async function createReservationCreatedNotifications(user) {
  await ensureReservationsGuestUserIdColumn();
  const hasTable = await ensureNotificationsTable();
  if (!hasTable) return;

  const userId = String(user.id);
  const userEmail = String(user.email ?? "").trim();

  const reservations = await db.query(
    `
      SELECT
        r.id AS reservation_id,
        r.cabin_id,
        c.name AS cabin_name,
        r.start_date,
        r.end_date
      FROM public.reservations r
      LEFT JOIN public.cabins c ON c.id = r.cabin_id
      LEFT JOIN public.user_notifications un
        ON un.user_id = $1
       AND un.type = 'reservation_created'
       AND un.reference_id = CONCAT('reservation:', r.id::text)
      WHERE (
              r.guest_user_id = $1
              OR ($2 <> '' AND LOWER(r.guest_email) = LOWER($2))
            )
        AND r.status IN ('active', 'completed')
        AND un.id IS NULL
      ORDER BY r.created_at DESC
      LIMIT 100
    `,
    [userId, userEmail]
  );

  for (const row of reservations.rows) {
    const cabinId = String(row.cabin_id ?? "").trim();
    if (!cabinId) continue;

    const cabinName = String(row.cabin_name || "hytta").trim();
    const actionUrl = `/reserver/booking?cabinId=${encodeURIComponent(cabinId)}`;

    await db.query(
      `
        INSERT INTO public.user_notifications
          (user_id, type, reference_id, title, message, action_url, metadata)
        VALUES
          ($1, 'reservation_created', $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT DO NOTHING
      `,
      [
        userId,
        `reservation:${row.reservation_id}`,
        "Reservasjon godkjent",
        `Bookingen din av ${cabinName} fra ${String(row.start_date).slice(0, 10)} til ${String(row.end_date).slice(0, 10)} er godkjent av hytteeier.`,
        actionUrl,
        JSON.stringify({
          reservation_id: row.reservation_id,
          cabin_id: cabinId,
          start_date: row.start_date,
          end_date: row.end_date,
        }),
      ]
    );
  }
}

async function createReservationReceivedNotifications(user) {
  await ensureReservationsGuestUserIdColumn();
  const hasTable = await ensureNotificationsTable();
  if (!hasTable) return;

  const ownerId = String(user.id);

  const reservations = await db.query(
    `
      SELECT
        r.id AS reservation_id,
        r.cabin_id,
        c.name AS cabin_name,
        r.guest_name,
        r.guest_email,
        r.start_date,
        r.end_date
      FROM public.reservations r
      JOIN public.cabins c
        ON c.id = r.cabin_id
      LEFT JOIN public.user_notifications un
        ON un.user_id = $1
       AND un.type = 'reservation_received'
       AND un.reference_id = CONCAT('reservation:', r.id::text)
      WHERE c.owner_id::text = $1
        AND r.status = 'pending'
        AND un.id IS NULL
      ORDER BY r.created_at DESC
      LIMIT 100
    `,
    [ownerId]
  );

  for (const row of reservations.rows) {
    const cabinId = String(row.cabin_id ?? "").trim();
    if (!cabinId) continue;

    const guestDisplayName =
      String(row.guest_name || "").trim() ||
      String(row.guest_email || "").trim() ||
      "En gjest";
    const cabinName = String(row.cabin_name || "hytta").trim();

    await db.query(
      `
        INSERT INTO public.user_notifications
          (user_id, type, reference_id, title, message, action_url, metadata)
        VALUES
          ($1, 'reservation_received', $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT DO NOTHING
      `,
      [
        ownerId,
        `reservation:${row.reservation_id}`,
        "Ny booking å godkjenne",
        `${guestDisplayName} ønsker å booke ${cabinName} fra ${String(row.start_date).slice(0, 10)} til ${String(row.end_date).slice(0, 10)}.`,
        "/reserver/foresporsler",
        JSON.stringify({
          reservation_id: row.reservation_id,
          cabin_id: cabinId,
          guest_name: row.guest_name,
          guest_email: row.guest_email,
          start_date: row.start_date,
          end_date: row.end_date,
        }),
      ]
    );
  }
}

export async function GET(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    await markCompletedReservations();

    const enabled = await userAllowsNotifications(user.id);
    if (enabled) {
      await createReservationCreatedNotifications(user);
      await createReservationReceivedNotifications(user);
    }

    const hasTable = await ensureNotificationsTable();
    if (!hasTable) {
      return NextResponse.json({ notifications: [], unread_count: 0 }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;

    const listResult = await db.query(
      `
        SELECT id, user_id, type, reference_id, title, message, action_url, metadata, is_read, created_at, read_at
        FROM public.user_notifications
        WHERE user_id = $1
          AND type <> 'review_reminder'
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [String(user.id), limit]
    );

    const unreadResult = await db.query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM public.user_notifications
        WHERE user_id = $1
          AND is_read = false
          AND type <> 'review_reminder'
      `,
      [String(user.id)]
    );

    return NextResponse.json(
      {
        notifications: listResult.rows,
        unread_count: Number(unreadResult.rows[0]?.unread_count) || 0,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const hasTable = await ensureNotificationsTable();
    if (!hasTable) {
      return NextResponse.json({ error: "Varslinger er ikke tilgjengelig" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const markAllRead = Boolean(body?.markAllRead);
    const notificationId = body?.notificationId;

    if (!markAllRead && !notificationId) {
      return badRequest("Mangler notificationId eller markAllRead");
    }

    if (markAllRead) {
      await db.query(
        `
          UPDATE public.user_notifications
          SET is_read = true,
              read_at = COALESCE(read_at, NOW())
          WHERE user_id = $1
            AND is_read = false
        `,
        [String(user.id)]
      );
    } else {
      await db.query(
        `
          UPDATE public.user_notifications
          SET is_read = true,
              read_at = COALESCE(read_at, NOW())
          WHERE user_id = $1
            AND id = $2
        `,
        [String(user.id), Number(notificationId)]
      );
    }

    const unreadResult = await db.query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM public.user_notifications
        WHERE user_id = $1 AND is_read = false
      `,
      [String(user.id)]
    );

    return NextResponse.json(
      { ok: true, unread_count: Number(unreadResult.rows[0]?.unread_count) || 0 },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
