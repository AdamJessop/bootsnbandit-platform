/**
 * Pure logic for the public review-capture page (`/review/[token]`).
 * Validation + request-body shaping for `POST /api/reviews`, testable without
 * rendering React.
 */

export interface ReviewDraft {
  rating: number;
  body: string;
}

export function isReviewValid(draft: ReviewDraft): boolean {
  return (
    Number.isInteger(draft.rating) && draft.rating >= 1 && draft.rating <= 5
  );
}

export interface ReviewPayload {
  token: string;
  rating: number;
  body: string | null;
}

export function buildReviewPayload(
  token: string,
  draft: ReviewDraft,
): ReviewPayload {
  const body = draft.body.trim();
  return {
    token,
    rating: draft.rating,
    body: body.length ? body : null,
  };
}
