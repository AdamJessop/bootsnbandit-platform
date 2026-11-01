import type { ReviewStatus } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import {
  REVIEW_MODERATION,
  type ReviewModerationAction,
} from "./review-moderation";

export * from "./review-moderation";

/**
 * Review moderation. A Review is seeded `pending` by the review-request cron,
 * flips to `submitted` when the customer fills in /review/[token], and only
 * reaches the public homepage once an owner moves it to `published`. `hidden`
 * is the "not on our site" bin — kept, never deleted, so the decision can be
 * reversed. The allowed moves live in `review-moderation.ts`.
 *
 * Every move is a conditional update on the status the owner was looking at:
 * two owners acting on the same review at once cannot both win, and a stale
 * screen gets told so rather than silently overwriting.
 */

export type ModerateReviewResult =
  | { ok: true; status: ReviewStatus }
  | { ok: false; reason: "not_found" | "stale"; status?: ReviewStatus };

export async function moderateReview(
  reviewId: string,
  action: ReviewModerationAction,
): Promise<ModerateReviewResult> {
  const { from, to } = REVIEW_MODERATION[action];
  const { count } = await prisma.review.updateMany({
    where: { id: reviewId, status: { in: [...from] } },
    data: { status: to },
  });
  if (count === 1) return { ok: true, status: to };

  const current = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { status: true },
  });
  return current
    ? { ok: false, reason: "stale", status: current.status }
    : { ok: false, reason: "not_found" };
}

/** Reviews waiting on an owner: submitted by a customer, not yet decided. */
export async function countReviewsAwaitingModeration(): Promise<number> {
  return prisma.review.count({ where: { status: "submitted" } });
}

export interface ModerationReview {
  id: string;
  status: ReviewStatus;
  rating: number | null;
  body: string | null;
  customerName: string | null;
  artistName: string | null;
  submittedAt: Date | null;
}

/** Every customer-written review (anything past `pending`), newest first. */
export async function listReviewsForModeration(): Promise<ModerationReview[]> {
  const rows = await prisma.review.findMany({
    where: { status: { in: ["submitted", "published", "hidden"] } },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      status: true,
      rating: true,
      body: true,
      submittedAt: true,
      customer: { select: { name: true } },
      booking: { select: { artist: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    rating: r.rating,
    body: r.body,
    customerName: r.customer?.name ?? null,
    artistName: r.booking?.artist?.name ?? null,
    submittedAt: r.submittedAt,
  }));
}
