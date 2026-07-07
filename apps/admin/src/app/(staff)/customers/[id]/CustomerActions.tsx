"use client";

/**
 * Client island for the customer detail page: edit notes + marketing consent,
 * and send a manual email. Calls the colocated server actions and surfaces the
 * result via a toast.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerNotes, sendManualEmail } from "./actions";

export interface CustomerActionsProps {
  customerId: string;
  initialNotes: string;
  initialConsent: boolean;
  hasEmail: boolean;
}

export function CustomerActions({
  customerId,
  initialNotes,
  initialConsent,
  hasEmail,
}: CustomerActionsProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [consent, setConsent] = useState(initialConsent);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function onSaveNotes() {
    start(async () => {
      const res = await saveCustomerNotes(customerId, {
        notes,
        marketingConsent: consent,
      });
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  }

  function onSendEmail() {
    start(async () => {
      const res = await sendManualEmail(customerId, { subject, body });
      if (res.ok) {
        setSubject("");
        setBody("");
      }
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="font-termina text-xs uppercase tracking-wide text-text-muted">
          Notes &amp; consent
        </h2>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Allergies, preferences, deposits…"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border-default px-3 py-2">
            <Label htmlFor="consent" className="cursor-pointer">
              Marketing consent
            </Label>
            <Switch
              id="consent"
              checked={consent}
              onCheckedChange={setConsent}
            />
          </div>
          <Button onClick={onSaveNotes} disabled={pending} size="sm">
            Save
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="font-termina text-xs uppercase tracking-wide text-text-muted">
          Send email
        </h2>
        {!hasEmail ? (
          <p className="mt-3 text-sm text-text-muted">
            No email on file — add one to message this customer.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              onClick={onSendEmail}
              disabled={pending || !subject.trim() || !body.trim()}
              size="sm"
            >
              Send &amp; log
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
