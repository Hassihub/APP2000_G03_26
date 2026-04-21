import { NextResponse } from "next/server";
import db from "../../../../../lib/db";
import { getCurrentUser, requireAuth } from "../../../../../lib/auth";

let cabinReviewsTableReady = false;
let reservationUserIdColumnReady = false;

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
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

async function getReviewEligibility({ userId, cabinId }) {
  await ensureReservationUserIdColumn();

  const result = await db.query(
    `
      SELECT 1
      FROM public.reservations r
      WHERE r.cabin_id::text = $1
        AND r.status <> 'cancelled'
        AND r.guest_user_id = $2
      LIMIT 1
    `,
    [String(cabinId), String(userId)]
  );

  const canReview = result.rowCount > 0;
  return {
    can_review: canReview,
    review_block_reason: canReview
      ? null
      : "Du kan anmelde når du har en gyldig reservasjon på denne hytta.",
  };
}

async function ensureCabinExists(cabinId) {
  const result = await db.query(
    `SELECT 1 FROM public.cabins WHERE id = $1 LIMIT 1`,
    [String(cabinId)]
  );
  return result.rowCount > 0;
}

async function getReviewStats(cabinId) {
  const statsRes = await db.query(
    `
      SELECT
        ROUND(AVG(rating)::numeric, 1) AS average_rating,
        COUNT(*)::int AS review_count
      FROM public.cabin_reviews
      WHERE cabin_id = $1
    `,
    [String(cabinId)]
  );

  const stats = statsRes.rows[0] ?? {};
  return {
    average_rating:
      stats.average_rating === null || stats.average_rating === undefined
        ? null
        : Number.parseFloat(String(stats.average_rating)),
    review_count: Number(stats.review_count) || 0,
  };
}

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    if (!id) return badRequest("Mangler cabin-id");

    const hasTable = await ensureCabinReviewsTable();
    if (!hasTable) {
      return NextResponse.json(
        {
          reviews: [],
          average_rating: null,
          review_count: 0,
          user_review: null,
        },
        { status: 200 }
      );
    }

    const hasCabin = await ensureCabinExists(id);
    if (!hasCabin) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    const reviewsRes = await db.query(
      `
        SELECT id, cabin_id, user_id, username, rating, comment, created_at, updated_at
        FROM public.cabin_reviews
        WHERE cabin_id = $1
        ORDER BY updated_at DESC, created_at DESC
      `,
      [String(id)]
    );

    const stats = await getReviewStats(id);

    let currentUser = null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      currentUser = null;
    }

    const user_review = currentUser
      ? reviewsRes.rows.find((r) => String(r.user_id) === String(currentUser.id)) ?? null
      : null;

    const eligibility = currentUser
      ? await getReviewEligibility({
          userId: currentUser.id,
          cabinId: id,
        })
      : {
          can_review: false,
          review_block_reason: "Logg inn for å anmelde hytta.",
        };

    return NextResponse.json(
      {
        reviews: reviewsRes.rows,
        ...stats,
        user_review,
        ...eligibility,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    if (!id) return badRequest("Mangler cabin-id");

    const { user, response } = await requireAuth();
    if (response) return response;

    const hasTable = await ensureCabinReviewsTable();
    if (!hasTable) {
      return NextResponse.json(
        { error: "Kunne ikke initialisere anmeldelsestabell" },
        { status: 500 }
      );
    }

    const hasCabin = await ensureCabinExists(id);
    if (!hasCabin) {
      return NextResponse.json({ error: "Fant ikke hytta" }, { status: 404 });
    }

    const eligibility = await getReviewEligibility({
      userId: user.id,
      cabinId: id,
    });
    if (!eligibility.can_review) {
      return NextResponse.json(
        { error: eligibility.review_block_reason || "Du kan ikke anmelde denne hytta enda." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const rating = Number(body?.rating);
    const commentRaw = body?.comment;
    const commentText =
      commentRaw === undefined || commentRaw === null
        ? null
        : String(commentRaw).trim();
    const comment = commentText ? commentText.slice(0, 1000) : null;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return badRequest("rating må være et heltall mellom 1 og 5");
    }

    const username =
      String(user?.username ?? "").trim() ||
      String(user?.email ?? "").trim() ||
      `Bruker ${String(user?.id ?? "")}`;

    const upsertResult = await db.query(
      `
        INSERT INTO public.cabin_reviews (cabin_id, user_id, username, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (cabin_id, user_id)
        DO UPDATE
        SET username = EXCLUDED.username,
            rating = EXCLUDED.rating,
            comment = EXCLUDED.comment,
            updated_at = NOW()
        RETURNING id, cabin_id, user_id, username, rating, comment, created_at, updated_at
      `,
      [String(id), String(user.id), username, rating, comment]
    );

    const stats = await getReviewStats(id);

    return NextResponse.json(
      {
        review: upsertResult.rows[0],
        ...stats,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Ukjent feil" }, { status: 500 });
  }
}
