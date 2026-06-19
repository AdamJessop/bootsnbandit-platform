import { cn } from "@/lib/utils";
import { booksLabel, type BooksStatus } from "./books";

/**
 * Public-site status badge. For artist availability it reuses the books map
 * (open/limited/closed). A free-text `label` may override for other contexts.
 * Tone defaults from the status; pass `tone` to force a colour.
 */
export type StatusTone = "open" | "limited" | "closed";

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BooksStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("books-badge", status, className)}>
      <span className={`dot dot-${status}`} />
      {label ?? booksLabel(status)}
    </span>
  );
}
