/**
 * Artist "books" availability status — the public signal of whether an artist
 * is taking work. Shared by BooksBadge, artist filters and the enquiry flow.
 */
export const BOOKS_STATUS = ["open", "limited", "closed"] as const;
export type BooksStatus = (typeof BOOKS_STATUS)[number];

const LABELS: Record<BooksStatus, string> = {
  open: "Books open",
  limited: "Limited slots",
  closed: "Waitlist only",
};

/** Human label for a books status; unknown values read as the closed label. */
export function booksLabel(status: BooksStatus): string {
  return LABELS[status] ?? LABELS.closed;
}
