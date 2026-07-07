"use client";

/**
 * Detail-dialog sections for the enquiry inbox (BACKOFHOUSE-IA E2): the
 * customer's mood-board references (image thumbnails linking out, with a
 * graceful non-image fallback) and the past message thread from MessageLog.
 */
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "../_shared/labels";
import { looksLikeImageUrl, type ThreadEntry } from "./enquiry-helpers";

export function MoodboardSection({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <section className="space-y-2">
      <Label>Mood board</Label>
      <ul className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <li key={`${url}-${i}`}>
            <a href={url} target="_blank" rel="noreferrer" className="block">
              {looksLikeImageUrl(url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`Mood board reference ${i + 1}`}
                  className="size-20 rounded-md border border-border-default object-cover"
                />
              ) : (
                <span className="inline-flex rounded-md border border-border-default bg-bg-base px-3 py-2 text-xs text-text-secondary underline">
                  Reference {i + 1}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ThreadSection({ thread }: { thread: ThreadEntry[] }) {
  if (thread.length === 0) return null;
  return (
    <section className="space-y-2">
      <Label>Message history</Label>
      <ul className="divide-y divide-border-default rounded-md border border-border-default">
        {thread.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="capitalize text-text-primary">
              {t.type.replace(/_/g, " ")}
            </span>
            {t.subject && (
              <span className="line-clamp-1 text-text-muted">{t.subject}</span>
            )}
            <span className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {t.status}
              </Badge>
              <span className="text-xs text-text-muted">
                {formatDateTime(t.whenISO)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
