/**
 * Pure view logic for the reviews moderation screen: which tab a review sits
 * in, the per-tab counts, the optimistic move, and the copy for each action.
 * Framework-free so it unit-tests in the node env.
 */
import type { ReviewStatus } from "@prisma/client";
import {
  REVIEW_MODERATION,
  type ReviewModerationAction,
} from "@bnb/core/services/review-moderation";

/** What the client island needs per review — dates pre-formatted server-side. */
export interface ReviewRow {
  id: string;
  status: ReviewStatus;
  rating: number | null;
  body: string | null;
  customerName: string | null;
  artistName: string | null;
  /** e.g. "12 Oct 2026", or null when the submit time is unknown. */
  submittedLabel: string | null;
}

/** The three tabs, in order. `pending` reviews are never listed. */
export type ReviewView = "submitted" | "published" | "hidden";

export const REVIEW_VIEWS: { id: ReviewView; label: string }[] = [
  { id: "submitted", label: "Awaiting" },
  { id: "published", label: "Published" },
  { id: "hidden", label: "Hidden" },
];

export function countByView(rows: ReviewRow[]): Record<ReviewView, number> {
  const counts: Record<ReviewView, number> = {
    submitted: 0,
    published: 0,
    hidden: 0,
  };
  for (const r of rows) {
    if (r.status in counts) counts[r.status as ReviewView] += 1;
  }
  return counts;
}

export interface ReviewMove {
  id: string;
  action: ReviewModerationAction;
}

/**
 * The optimistic reducer: apply the same move the server will make, so the
 * row jumps tabs on tap. A move the rules don't allow from the row's current
 * status is ignored — the server would refuse it too.
 */
export function moveReview(rows: ReviewRow[], move: ReviewMove): ReviewRow[] {
  const rule = REVIEW_MODERATION[move.action];
  return rows.map((r) =>
    r.id === move.id && rule.from.includes(r.status)
      ? { ...r, status: rule.to }
      : r,
  );
}

export const ACTION_LABEL: Record<ReviewModerationAction, string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  hide: "Hide",
};

/**
 * Actions that take a review OFF the public site (or out of the queue for
 * good) ask once more, inline. Publishing is the happy path and doesn't.
 */
export const CONFIRM_PROMPT: Partial<Record<ReviewModerationAction, string>> = {
  unpublish: "Take this review off the site and back to Awaiting?",
  hide: "Hide this review? It stays here under Hidden and never shows on the site.",
};

export const ACTION_DONE: Record<ReviewModerationAction, string> = {
  publish: "Published — it can now appear on the homepage.",
  unpublish: "Unpublished — it's back in Awaiting.",
  hide: "Hidden — it won't appear on the site.",
};

/** "★★★★☆" for 4/5; empty for an unrated review. */
export function stars(rating: number | null): string {
  if (rating == null) return "";
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
