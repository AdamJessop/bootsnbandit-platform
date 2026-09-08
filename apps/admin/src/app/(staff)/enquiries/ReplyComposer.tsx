"use client";

/**
 * The composer: a reply that goes to the customer, and an internal note that
 * never does. Replying is what marks an enquiry `replied` (and, for an artist
 * on an unassigned enquiry, claims it) — the server decides both.
 */
import { useState } from "react";
import type { EnquirySource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./inbox-shared";
import { addInternalNote, replyToEnquiry } from "./actions";

export interface ReplyComposerProps {
  enquiryId: string;
  /** Inkling boards say "Respond" rather than "Send reply". */
  source: EnquirySource;
  /** True when this viewer replying would also take the enquiry. */
  claimsOnReply: boolean;
  /** Called after a successful reply, so the dialog can close. */
  onSent: () => void;
}

export function ReplyComposer({
  enquiryId,
  source,
  claimsOnReply,
  onSent,
}: ReplyComposerProps) {
  const { pending, run } = useAction();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  return (
    <>
      {/* Reply */}
      <section className="space-y-2">
        <Label htmlFor={`reply-${enquiryId}`}>
          {claimsOnReply
            ? "Reply (emails customer — responding to an unassigned enquiry assigns it to you)"
            : "Reply (emails customer)"}
        </Label>
        <Textarea
          id={`reply-${enquiryId}`}
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Thanks for getting in touch…"
        />
        <Button
          disabled={pending || !reply.trim()}
          onClick={() =>
            run(() => replyToEnquiry(enquiryId, { message: reply }), {
              onSuccess: onSent,
            })
          }
        >
          {source === "inkling" ? "Respond" : "Send reply"}
        </Button>
      </section>

      {/* Internal note */}
      <section className="space-y-2">
        <Label htmlFor={`note-${enquiryId}`}>
          Internal note (staff only — never sent)
        </Label>
        <Textarea
          id={`note-${enquiryId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context for whoever picks this up…"
        />
        <Button
          variant="outline"
          disabled={pending || !note.trim()}
          onClick={() =>
            // Several notes in a row is normal, so this one does NOT close the
            // dialog — it just clears the box.
            run(async () => {
              const res = await addInternalNote(enquiryId, { body: note });
              if (res.ok) setNote("");
              return res;
            })
          }
        >
          Add note
        </Button>
      </section>
    </>
  );
}
