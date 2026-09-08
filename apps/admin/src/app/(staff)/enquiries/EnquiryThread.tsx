"use client";

/**
 * The enquiry thread: every message in chronological order. Inbound sits left,
 * outbound right, internal notes are muted and full width, and each bubble
 * carries its channel + timestamp so a mixed email/Messenger/web history reads
 * unambiguously. Replaces the old flat MessageLog "Message history" list.
 */
import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  ShieldAlert,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@bnb/core/utils";
import { formatDateTime } from "../_shared/labels";
import { attachmentHref } from "./enquiry-helpers";

export interface ThreadAttachmentItem {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  hasBytes: boolean;
}

export interface ThreadItem {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  channel: "web" | "email" | "messenger" | "instagram" | "note";
  authorName: string | null;
  fromName: string | null;
  subject: string | null;
  bodyText: string;
  deliveryStatus: string;
  createdAtISO: string;
  attachments: ThreadAttachmentItem[];
  /**
   * Did the sending MTA authenticate the sender? null = unknown, which is
   * every web and Meta message — those channels authenticate the account.
   */
  senderVerified: boolean | null;
}

export const CHANNEL_LABEL: Record<ThreadItem["channel"], string> = {
  web: "Web form",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
  note: "Internal note",
};

// lucide-react dropped brand/social-logo icons a while back — there is no
// Facebook or Instagram glyph in this dependency's icon set — so Messenger
// and Instagram are represented with generic chat/photo icons instead.
export const CHANNEL_ICON: Record<ThreadItem["channel"], LucideIcon> = {
  web: Globe,
  email: Mail,
  messenger: MessageCircle,
  instagram: Camera,
  note: StickyNote,
};

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function Attachments({ items }: { items: ThreadAttachmentItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-2">
      {items.map((a) => {
        const href = attachmentHref(a);
        const name = a.filename ?? `Attachment ${a.id.slice(0, 6)}`;
        if (!href) {
          return (
            <li key={a.id} className="text-xs text-text-muted">
              {name} (unavailable)
            </li>
          );
        }
        return (
          <li key={a.id}>
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {a.hasBytes && isImage(a.mime) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt={name}
                  className="size-20 rounded-md border border-border-default object-cover"
                />
              ) : (
                <span className="inline-flex rounded-md border border-border-default bg-bg-base px-3 py-2 text-xs text-text-secondary underline">
                  {name}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function EnquiryThread({
  items,
  heading = true,
}: {
  items: ThreadItem[];
  /** False when the surrounding control already carries the count. */
  heading?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      {heading && <Label>Thread ({items.length})</Label>}
      <ol className="space-y-2">
        {items.map((m) => {
          const internal = m.direction === "internal";
          const outbound = m.direction === "outbound";
          const who = outbound || internal ? m.authorName : m.fromName;
          return (
            <li
              key={m.id}
              className={cn(
                "flex",
                internal
                  ? "justify-center"
                  : outbound
                    ? "justify-end"
                    : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[min(85%,68ch)] rounded-lg border px-3 py-2 text-sm",
                  internal
                    ? "w-full border-dashed border-border-default bg-bg-base text-text-muted"
                    : outbound
                      ? "border-bb-teal/40 bg-bb-teal/10 text-text-secondary"
                      : "border-border-default bg-bg-card text-text-secondary",
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <Badge variant="outline" className="gap-1">
                    {(() => {
                      const Icon = CHANNEL_ICON[m.channel];
                      return <Icon className="h-3 w-3" aria-hidden />;
                    })()}
                    {CHANNEL_LABEL[m.channel]}
                  </Badge>
                  {/*
                    Only ever on INBOUND mail, and only when the MTA actually
                    said "no" — an unknown verdict (web, Meta, an MTA that
                    added no header) must not look like a warning. Nothing is
                    ever dropped on this: it is a label, not a filter.
                  */}
                  {!outbound && !internal && m.senderVerified === false && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-bb-gold/50 text-bb-gold"
                      title="This message failed SPF/DKIM/DMARC checks — the From address may be forged."
                    >
                      <ShieldAlert className="h-3 w-3" aria-hidden />
                      Unverified sender
                    </Badge>
                  )}
                  {who && <span className="text-text-primary">{who}</span>}
                  {outbound && m.deliveryStatus !== "sent" && (
                    <Badge variant="outline" className="capitalize">
                      {m.deliveryStatus}
                    </Badge>
                  )}
                  <span className="ml-auto">
                    {formatDateTime(m.createdAtISO)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.bodyText}</p>
                <Attachments items={m.attachments} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
