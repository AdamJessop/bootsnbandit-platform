"use client";

/**
 * Owner-only repair for the one duplicate the CRM cannot resolve on its own: a
 * customer we know by email sends an Instagram DM, which carries no contact
 * details, so it lands on a fresh stub record. Pick the handle, link it, and
 * the stub's enquiries and messages come across.
 *
 * A list, not a text box: a PSID/IGSID is an opaque number nobody can type,
 * and only handles on stub records are offered — so the picker cannot be
 * pointed at a handle that already belongs to a real customer.
 *
 * A native <select> (the convention in Studio and Content) rather than the
 * base-ui one: its options are real markup, so the handles on offer are
 * present in the server-rendered HTML and readable without hydration.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { linkIdentityAction } from "./actions";

export interface LinkableIdentityOption {
  id: string;
  channel: "messenger" | "instagram";
  /** e.g. "amy.ink · Instagram (from Amy Rowe)". */
  label: string;
}

export function LinkIdentityCard({
  customerId,
  identities,
}: {
  customerId: string;
  identities: LinkableIdentityOption[];
}) {
  const [pending, start] = useTransition();
  const [identityId, setIdentityId] = useState("");

  return (
    <section className="mt-6 space-y-2 rounded-lg border border-border-default bg-bg-card p-4">
      <Label htmlFor="link-identity">Link a Messenger / Instagram handle</Label>
      {identities.length === 0 ? (
        <p className="text-sm text-text-muted">
          No unlinked Messenger or Instagram handles — every handle already
          belongs to a customer with contact details or bookings.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            Moves the handle, and everything it has sent, onto this customer.
            The empty record it came from is deleted.
          </p>
          <select
            id="link-identity"
            value={identityId}
            onChange={(e) => setIdentityId(e.target.value)}
            className="h-10 w-full rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary"
          >
            <option value="">Choose a handle</option>
            {identities.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={pending || !identityId}
            onClick={() =>
              start(async () => {
                const res = await linkIdentityAction(customerId, identityId);
                toast[res.ok ? "success" : "error"](res.message ?? "");
                if (res.ok) setIdentityId("");
              })
            }
          >
            Link handle
          </Button>
        </>
      )}
    </section>
  );
}
