// Skrevet av Sigurd

import { NextResponse } from "next/server";
import db from "../../../lib/db"; // default Pool
import { requireAuth } from "../../../lib/auth";

let reservationUserIdColumnReady = false;
let notificationsTableReady = false;
const autoDeleteCompletedReservations = String(process.env.AUTO_DELETE_COMPLETED_RESERVATIONS ?? "").toLowerCase() === "true";
const parsedRetentionDays = Number.parseInt(String(process.env.RESERVATION_RETENTION_DAYS ?? "180"), 10);
const reservationRetentionDays = Number.isFinite(parsedRetentionDays) ? Math.max(parsedRetentionDays, 7) : 180;

async function ensureReservationUserIdColumn() {
  if (reservationUserIdColumnReady) return true;

  try {
    await db.query(`
      ALTER TABLE public.reservations
      ADD COLUMN IF NOT EXISTS guest_user_id TEXT
    `);
    reservationUserIdColumnReady = true;
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

async function markCompletedReservations() {
  await db.query(
    `
      UPDATE public.reservations
      SET status = 'completed'
      WHERE status = 'active'
        AND end_date < CURRENT_DATE
    `
  );
}

async function purgeCompletedReservationsIfEnabled() {
  if (!autoDeleteCompletedReservations) return;

  const deleted = await db.query(
    `
      DELETE FROM public.reservations
      WHERE status = 'completed'
        AND end_date < (CURRENT_DATE - ($1::int * INTERVAL '1 day'))
      RETURNING id::text AS id_text
    `,
    [reservationRetentionDays]
  );

  if (deleted.rowCount === 0) return;

  const ids = deleted.rows.map((row) => String(row.id_text || "").trim()).filter(Boolean);
  if (ids.length === 0) return;

  try {
    const hasNotifications = await ensureNotificationsTable();
    if (hasNotifications) {
      await db.query(
        `
          DELETE FROM public.user_notifications
          WHERE reference_id = ANY($1::text[])
        `,
        [ids.map((id) => `reservation:${id}`)]
      );
    }
  } catch {
    // Opprydding i varslinger skal ikke stoppe hovedflyten.
  }
}

async function runReservationLifecycleHousekeeping() {
  await markCompletedReservations();
  await purgeCompletedReservationsIfEnabled();
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

async function createReservationNotification(userId, reservation) {
  try {
    const hasTable = await ensureNotificationsTable();
    if (!hasTable) return;

    let cabinName = "hytta";
    let cabinOwnerId = "";

    try {
      const cabinResult = await db.query(
        `SELECT name, owner_id FROM public.cabins WHERE id = $1 LIMIT 1`,
        [String(reservation.cabin_id)]
      );
      cabinName = String(cabinResult.rows[0]?.name || "hytta").trim();
      cabinOwnerId = String(cabinResult.rows[0]?.owner_id ?? "").trim();
    } catch {
      const fallbackCabinResult = await db.query(
        `SELECT name FROM public.cabins WHERE id = $1 LIMIT 1`,
        [String(reservation.cabin_id)]
      );
      cabinName = String(fallbackCabinResult.rows[0]?.name || "hytta").trim();
      cabinOwnerId = "";
    }

    const guestAllows = await userAllowsNotifications(userId);
    if (guestAllows) {
      await db.query(
        `
          INSERT INTO public.user_notifications
            (user_id, type, reference_id, title, message, action_url, metadata)
          VALUES
            ($1, 'reservation_pending', $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT DO NOTHING
        `,
        [
          String(userId),
          `reservation:${reservation.id}`,
          "Booking venter godkjenning",
          `Booking av ${cabinName} fra ${String(reservation.start_date).slice(0, 10)} til ${String(reservation.end_date).slice(0, 10)} venter på godkjenning fra hytteeier.`,
          `/reserver/booking?cabinId=${encodeURIComponent(String(reservation.cabin_id))}`,
          JSON.stringify({
            reservation_id: reservation.id,
            cabin_id: reservation.cabin_id,
            start_date: reservation.start_date,
            end_date: reservation.end_date,
          }),
        ]
      );
    }

    if (cabinOwnerId && String(cabinOwnerId) !== String(userId)) {
      const ownerAllows = await userAllowsNotifications(cabinOwnerId);
      if (ownerAllows) {
        const guestDisplayName =
          String(reservation.guest_name || "").trim() ||
          String(reservation.guest_email || "").trim() ||
          "En gjest";

        await db.query(
          `
            INSERT INTO public.user_notifications
              (user_id, type, reference_id, title, message, action_url, metadata)
            VALUES
              ($1, 'reservation_received', $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT DO NOTHING
          `,
          [
            cabinOwnerId,
            `reservation:${reservation.id}`,
            "Ny booking å godkjenne",
            `${guestDisplayName} ønsker å booke ${cabinName} fra ${String(reservation.start_date).slice(0, 10)} til ${String(reservation.end_date).slice(0, 10)}.`,
            `/reserver/foresporsler`,
            JSON.stringify({
              reservation_id: reservation.id,
              cabin_id: reservation.cabin_id,
              guest_name: reservation.guest_name,
              guest_email: reservation.guest_email,
              start_date: reservation.start_date,
              end_date: reservation.end_date,
            }),
          ]
        );
      }
    }
  } catch {
    // Varsling skal aldri blokkere reservasjon.
  }
}

export async function GET(req) {
  try {
    await ensureReservationUserIdColumn();
    await runReservationLifecycleHousekeeping();
    const { searchParams } = new URL(req.url);
    const cabin_id = searchParams.get("cabin_id");
    const guest_email = searchParams.get("guest_email");
    const guest_user_id = searchParams.get("guest_user_id");
    const pending_for_owner = searchParams.get("pending_for_owner") === "true";

    // Hytteeier henter innkommende bookinger som venter godkjenning
    if (pending_for_owner) {
      const { user, response } = await requireAuth();
      if (response) return response;

      const userId = String(user.id ?? "").trim();

      const result = await db.query(
        `
          SELECT
            r.id,
            r.cabin_id,
            r.guest_user_id,
            r.guest_name,
            r.guest_email,
            r.start_date,
            r.end_date,
            r.guests_count,
            r.notes,
            r.status,
            r.created_at,
            c.name AS cabin_name,
            c.location AS cabin_location
          FROM public.reservations r
          JOIN public.cabins c ON c.id = r.cabin_id
          WHERE c.owner_id = $1
            AND r.status = 'pending'
          ORDER BY r.created_at DESC
        `,
        [userId]
      );

      return NextResponse.json({ reservations: result.rows }, { status: 200 });
    }

    const where = [];
    const values = [];

    if (cabin_id) {
      values.push(cabin_id);
      where.push(`cabin_id = $${values.length}`);
    }
    if (guest_email && guest_user_id) {
      values.push(guest_user_id);
      values.push(guest_email);
      where.push(`(guest_user_id = $${values.length - 1} OR guest_email = $${values.length})`);
    } else if (guest_user_id) {
      values.push(guest_user_id);
      where.push(`guest_user_id = $${values.length}`);
    } else if (guest_email) {
      values.push(guest_email);
      where.push(`guest_email = $${values.length}`);
    }

    const sql = `
      SELECT
        r.id,
        r.cabin_id,
        r.guest_user_id,
        r.guest_name,
        r.guest_email,
        r.start_date,
        r.end_date,
        r.guests_count,
        r.notes,
        r.status,
        r.created_at,
        c.name AS cabin_name,
        c.location AS cabin_location
      FROM public.reservations r
      LEFT JOIN public.cabins c ON c.id = r.cabin_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(sql, values);
    return NextResponse.json({ reservations: result.rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureReservationUserIdColumn();
    await runReservationLifecycleHousekeeping();
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await req.json();

    const cabin_id = String(body.cabin_id ?? "").trim();
    const guest_name = String(body.guest_name ?? "").trim();
    const guest_email = String(body.guest_email ?? "").trim();

    const start_date = String(body.start_date ?? "").trim(); // "YYYY-MM-DD"
    const end_date = String(body.end_date ?? "").trim(); // "YYYY-MM-DD"

    const guests_count = Number(body.guests_count);
    const notes = body.notes ? String(body.notes).trim() : null;
    const guest_user_id = String(user.id ?? "").trim();

    if (!cabin_id) return NextResponse.json({ error: "cabin_id er påkrevd" }, { status: 400 });
    if (!guest_name) return NextResponse.json({ error: "guest_name er påkrevd" }, { status: 400 });
    if (!guest_email) return NextResponse.json({ error: "guest_email er påkrevd" }, { status: 400 });
    if (!start_date) return NextResponse.json({ error: "start_date er påkrevd" }, { status: 400 });
    if (!end_date) return NextResponse.json({ error: "end_date er påkrevd" }, { status: 400 });
    if (!Number.isFinite(guests_count) || guests_count <= 0) {
      return NextResponse.json({ error: "guests_count må være et tall > 0" }, { status: 400 });
    }

    // Dobbelbooking-sjekk:
    // Overlapp hvis NOT (existing.end <= new.start OR existing.start >= new.end)
    const overlapSql = `
      SELECT 1
      FROM public.reservations
      WHERE cabin_id = $1
        AND status NOT IN ('cancelled', 'rejected')
        AND NOT (end_date <= $2::date OR start_date >= $3::date)
      LIMIT 1
    `;
    const overlap = await db.query(overlapSql, [cabin_id, start_date, end_date]);

    if (overlap.rowCount > 0) {
      return NextResponse.json(
        { error: "Hytta er allerede reservert i den perioden. Velg andre datoer." },
        { status: 409 }
      );
    }

    const reservationName = guest_name || String(user.username ?? "").trim();
    const reservationEmail = guest_email || String(user.email ?? "").trim();

    if (!reservationName) {
      return NextResponse.json({ error: "guest_name er påkrevd" }, { status: 400 });
    }
    if (!reservationEmail) {
      return NextResponse.json({ error: "guest_email er påkrevd" }, { status: 400 });
    }
    if (!guest_user_id) {
      return NextResponse.json({ error: "Mangler bruker-ID" }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO public.reservations
        (cabin_id, guest_user_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status)
      VALUES
        ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'pending')
      RETURNING
        id, cabin_id, guest_user_id, guest_name, guest_email, start_date, end_date, guests_count, notes, status, created_at
    `;

    const values = [cabin_id, guest_user_id, reservationName, reservationEmail, start_date, end_date, guests_count, notes];
    const result = await db.query(insertSql, values);

    await createReservationNotification(user.id, result.rows[0]);

    return NextResponse.json({ reservation: result.rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await ensureReservationUserIdColumn();
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await req.json();
    const reservationId = String(body.reservationId ?? "").trim();
    const decision = String(body.decision ?? "").trim(); // "approve" | "reject"
    const ownerResponse = body.ownerResponse ? String(body.ownerResponse).trim() : null;

    if (!reservationId) return NextResponse.json({ error: "Mangler reservasjons-ID" }, { status: 400 });
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision må være 'approve' eller 'reject'" }, { status: 400 });
    }

    // Hent reservasjon og sjekk at innlogget bruker er hytteeier
    const resResult = await db.query(
      `
        SELECT r.id, r.cabin_id, r.guest_user_id, r.guest_name, r.guest_email,
               r.start_date, r.end_date, r.status, c.owner_id, c.name AS cabin_name
        FROM public.reservations r
        JOIN public.cabins c ON c.id = r.cabin_id
        WHERE r.id::text = $1
        LIMIT 1
      `,
      [reservationId]
    );

    if (resResult.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke reservasjonen" }, { status: 404 });
    }

    const reservation = resResult.rows[0];
    const userId = String(user.id ?? "").trim();

    if (String(reservation.owner_id ?? "").trim() !== userId) {
      return NextResponse.json({ error: "Ingen tilgang – du er ikke eier av denne hytta" }, { status: 403 });
    }

    if (reservation.status !== "pending") {
      return NextResponse.json({ error: "Reservasjonen er ikke lenger i ventestatus" }, { status: 409 });
    }

    const newStatus = decision === "approve" ? "active" : "rejected";

    await db.query(
      `UPDATE public.reservations SET status = $1 WHERE id::text = $2`,
      [newStatus, reservationId]
    );

    // Send varsling til gjesten
    if (reservation.guest_user_id) {
      try {
        const hasTable = await ensureNotificationsTable();
        if (hasTable) {
          const guestAllows = await userAllowsNotifications(reservation.guest_user_id);
          if (guestAllows) {
            const cabinName = String(reservation.cabin_name || "hytta").trim();
            const startDate = String(reservation.start_date).slice(0, 10);
            const endDate = String(reservation.end_date).slice(0, 10);

            if (decision === "approve") {
              await db.query(
                `
                  INSERT INTO public.user_notifications
                    (user_id, type, reference_id, title, message, action_url, metadata)
                  VALUES
                    ($1, 'reservation_approved', $2, $3, $4, $5, $6::jsonb)
                  ON CONFLICT (user_id, type, reference_id) DO UPDATE
                    SET title = EXCLUDED.title,
                        message = EXCLUDED.message,
                        is_read = false,
                        created_at = NOW()
                `,
                [
                  String(reservation.guest_user_id),
                  `reservation:${reservationId}`,
                  "Booking godkjent",
                  `Bookingen din av ${cabinName} fra ${startDate} til ${endDate} er godkjent!${ownerResponse ? ` Melding fra hytteeier: ${ownerResponse}` : ""}`,
                  `/reserver/booking?cabinId=${encodeURIComponent(String(reservation.cabin_id))}`,
                  JSON.stringify({ reservation_id: reservationId, cabin_id: reservation.cabin_id }),
                ]
              );
            } else {
              await db.query(
                `
                  INSERT INTO public.user_notifications
                    (user_id, type, reference_id, title, message, action_url, metadata)
                  VALUES
                    ($1, 'reservation_rejected', $2, $3, $4, $5, $6::jsonb)
                  ON CONFLICT (user_id, type, reference_id) DO UPDATE
                    SET title = EXCLUDED.title,
                        message = EXCLUDED.message,
                        is_read = false,
                        created_at = NOW()
                `,
                [
                  String(reservation.guest_user_id),
                  `reservation:${reservationId}`,
                  "Booking avslått",
                  `Bookingen din av ${cabinName} fra ${startDate} til ${endDate} ble dessverre avslått.${ownerResponse ? ` Melding fra hytteeier: ${ownerResponse}` : ""}`,
                  `/reserver`,
                  JSON.stringify({ reservation_id: reservationId, cabin_id: reservation.cabin_id }),
                ]
              );
            }
          }
        }
      } catch {
        // Varsling skal ikke blokkere godkjenning.
      }
    }

    return NextResponse.json({ ok: true, status: newStatus }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await ensureReservationUserIdColumn();
    const { user, response } = await requireAuth();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const reservationId = String(searchParams.get("id") ?? "").trim();

    if (!reservationId) {
      return NextResponse.json({ error: "Mangler gyldig reservasjons-ID" }, { status: 400 });
    }

    const reservationRes = await db.query(
      `
        SELECT id, guest_user_id, guest_email
        FROM public.reservations
        WHERE id::text = $1
        LIMIT 1
      `,
      [reservationId]
    );

    if (reservationRes.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke reservasjonen" }, { status: 404 });
    }

    const reservation = reservationRes.rows[0];
    const userId = String(user.id ?? "").trim();
    const userEmail = String(user.email ?? "").trim().toLowerCase();
    const ownerUserId = String(reservation.guest_user_id ?? "").trim();
    const ownerEmail = String(reservation.guest_email ?? "").trim().toLowerCase();

    const hasAccess =
      (ownerUserId && ownerUserId === userId) ||
      (!ownerUserId && ownerEmail && userEmail && ownerEmail === userEmail);

    if (!hasAccess) {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
    }

    const deleteRes = await db.query(
      `
        DELETE FROM public.reservations
        WHERE id::text = $1
        RETURNING id
      `,
      [reservationId]
    );

    if (deleteRes.rowCount === 0) {
      return NextResponse.json({ error: "Fant ikke reservasjonen" }, { status: 404 });
    }

    try {
      const hasNotifications = await ensureNotificationsTable();
      if (hasNotifications) {
        await db.query(
          `
            DELETE FROM public.user_notifications
            WHERE user_id = $1
              AND reference_id = $2
          `,
          [userId, `reservation:${reservationId}`]
        );
      }
    } catch {
      // Feil i varsling-opprydding skal ikke blokkere sletting.
    }

    return NextResponse.json({ ok: true, id: reservationId }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
