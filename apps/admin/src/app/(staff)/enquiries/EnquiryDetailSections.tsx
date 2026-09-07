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
import type {
  MoodboardData,
  MoodboardItem,
} from "@bnb/core/services/moodboard-data";

const KIND_LABEL: Record<MoodboardItem["kind"], string> = {
  web: "Web",
  studio: "Studio",
  upload: "Upload",
  link: "Link",
};

const COLOUR_LABEL = {
  bw: "Black & grey",
  colour: "Colour",
  either: "Open to either",
} as const;

/** The customer's Inkling mood-board brief: styles, colour, idea, notes. */
export function MoodBoardBriefSection({
  data,
}: {
  data: MoodboardData | null;
}) {
  if (!data) return null;
  return (
    <section className="space-y-2">
      <Label>Mood board brief</Label>
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border-default bg-bg-base p-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-muted">
            Styles
          </dt>
          <dd className="text-text-secondary">
            {data.styles.join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-muted">
            Colour
          </dt>
          <dd className="text-text-secondary">
            {data.colour ? COLOUR_LABEL[data.colour] : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-text-muted">
            Idea
          </dt>
          <dd className="text-text-secondary">{data.description || "—"}</dd>
        </div>
        {data.query && (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Search we ran
            </dt>
            <dd className="text-text-muted">{data.query}</dd>
          </div>
        )}
        {data.notes && (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Notes
            </dt>
            <dd className="text-text-secondary">{data.notes}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function MoodboardSection({
  urls,
  data,
}: {
  urls: string[];
  data?: MoodboardData | null;
}) {
  if (data && data.items.length > 0) {
    return (
      <section className="space-y-2">
        <Label>Mood board ({data.items.length})</Label>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data.items.map((item, i) => (
            <li key={`${item.url}-${i}`} className="space-y-1">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl ?? item.url}
                  alt={item.title ?? `Board image ${i + 1}`}
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full rounded-md border border-border-default object-cover"
                />
              </a>
              <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted">
                <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate underline"
                  >
                    source
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
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
