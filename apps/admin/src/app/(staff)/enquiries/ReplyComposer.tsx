"use client";

/**
 * The composer. One body box, one explicit channel: Email, Messenger,
 * Instagram or an internal note. Channels this thread cannot use are listed
 * but disabled, with the reason in plain sight — a Meta 24-hour window that
 * shut at 14:05 is something staff need to READ, not something to hide, and
 * the answer ("email them instead") is one click away in the same control.
 *
 * The selector is a convenience: `replyToEnquiry` re-decides the channel
 * server-side from rows the browser cannot see.
 */
import { useState } from "react";
import type { EnquirySource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerChannel, ReplyChannelOption } from "./enquiry-helpers";
import { useAction } from "./inbox-shared";
import { addInternalNote, replyToEnquiry } from "./actions";

export interface ReplyComposerProps {
  enquiryId: string;
  /** Inkling boards say "Respond" rather than "Send reply". */
  source: EnquirySource;
  /** True when this viewer replying would also take the enquiry. */
  claimsOnReply: boolean;
  /** Every channel, reachable or not, with its reason. */
  options: ReplyChannelOption[];
  /** Where the selector starts — the customer's channel when it is usable. */
  defaultChannel: ComposerChannel;
  /** Called after a successful send, so the dialog can close. */
  onSent: () => void;
}

/**
 * How one channel is named in the selector. The closed trigger and the open
 * list have to agree exactly — two copies of this string is how they stop
 * agreeing.
 */
function optionLabel(o: ReplyChannelOption): string {
  return o.available ? o.label : `${o.label} — unavailable`;
}

export function ReplyComposer({
  enquiryId,
  source,
  claimsOnReply,
  options,
  defaultChannel,
  onSent,
}: ReplyComposerProps) {
  const { pending, run } = useAction();
  // `channel` and `body` are seeded from props once and then belong to the
  // composer. The staff shell calls router.refresh() every 60 s, and re-syncing
  // either from the new props would retype someone's half-written reply or
  // move the channel under their cursor mid-sentence.
  // `selected` is derived on every render instead, so a Meta window that shuts
  // while the dialog is open still greys out the send button.
  const [channel, setChannel] = useState<ComposerChannel>(defaultChannel);
  const [body, setBody] = useState("");
  const selected = options.find((o) => o.channel === channel) ?? null;
  const isNote = channel === "note";
  // The closed trigger renders a label, never the raw channel value.
  const selectItems = options.map((o) => ({
    value: o.channel,
    label: optionLabel(o),
  }));

  const label = isNote
    ? "Internal note (staff only — never sent)"
    : claimsOnReply
      ? "Reply (responding to an unassigned enquiry assigns it to you)"
      : "Reply";

  return (
    <section className="space-y-2">
      <Label htmlFor={`reply-${enquiryId}`}>{label}</Label>
      <Select
        items={selectItems}
        value={channel}
        onValueChange={(v) =>
          setChannel((v as ComposerChannel) ?? defaultChannel)
        }
      >
        <SelectTrigger className="w-56" aria-label="Reply channel">
          <SelectValue placeholder="Choose a channel" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.channel}
              value={o.channel}
              disabled={!o.available}
            >
              {optionLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <p
          className={
            selected.available
              ? "text-xs text-text-muted"
              : "text-xs text-bb-gold"
          }
        >
          {selected.hint}
        </p>
      )}
      {/*
        Every unavailable reason, always visible. The selected channel's hint
        above answers "what will this do?"; this list answers "why can't I use
        the one I wanted?" without making staff open the dropdown to find out —
        the dropdown is a portal, so on a phone it hides the page to say it.
      */}
      <ul className="space-y-0.5">
        {options
          .filter((o) => !o.available && o.channel !== channel)
          .map((o) => (
            <li key={o.channel} className="text-xs text-text-muted">
              {o.label}: {o.hint}
            </li>
          ))}
      </ul>
      <Textarea
        id={`reply-${enquiryId}`}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isNote
            ? "Context for whoever picks this up…"
            : "Thanks for getting in touch…"
        }
      />
      <Button
        disabled={pending || !body.trim() || !selected?.available}
        onClick={() =>
          isNote
            ? // A note is not a reply: no claim, no status change, and the
              // dialog stays open because several notes in a row is normal.
              run(async () => {
                const res = await addInternalNote(enquiryId, { body });
                if (res.ok) setBody("");
                return res;
              })
            : run(() => replyToEnquiry(enquiryId, { message: body, channel }), {
                onSuccess: onSent,
              })
        }
      >
        {isNote ? "Add note" : source === "inkling" ? "Respond" : "Send reply"}
      </Button>
    </section>
  );
}
