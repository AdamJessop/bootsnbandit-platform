import type { ReviewStatus } from "@prisma/client";

/**
 * The review moderation rules, pure — no Prisma — so the admin screen's
 * client island can apply the same moves optimistically that the server
 * enforces (`reviews.ts`). One table, two callers: they cannot drift.
 *
 *   publish    submitted | hidden    → published
 *   unpublish  published             → submitted  (back in the queue)
 *   hide       submitted | published → hidden
 *
 * `pending` reviews (requested, not yet written) have nothing to moderate.
 */

export type ReviewModerationAction = "publish" | "unpublish" | "hide";

export const REVIEW_MODERATION: Record<
  ReviewModerationAction,
  { from: readonly ReviewStatus[]; to: ReviewStatus }
> = {
  publish: { from: ["submitted", "hidden"], to: "published" },
  unpublish: { from: ["published"], to: "submitted" },
  hide: { from: ["submitted", "published"], to: "hidden" },
};

export function isReviewModerationAction(
  value: unknown,
): value is ReviewModerationAction {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(REVIEW_MODERATION, value)
  );
}

/** Actions on offer for a review in `status`, in display order. */
export function moderationActionsFor(
  status: ReviewStatus,
): ReviewModerationAction[] {
  return (Object.keys(REVIEW_MODERATION) as ReviewModerationAction[]).filter(
    (action) => REVIEW_MODERATION[action].from.includes(status),
  );
}
