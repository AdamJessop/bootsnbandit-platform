import { booksLabel, type BooksStatus } from "./books";

/**
 * Coloured "books" availability pill (teal=open, gold=limited, muted=closed)
 * with a status dot. Label text comes from the shared `booksLabel` map.
 */
export function BooksBadge({ status }: { status: BooksStatus }) {
  return (
    <span className={`books-badge ${status}`}>
      <span className={`dot dot-${status}`} />
      {booksLabel(status)}
    </span>
  );
}
