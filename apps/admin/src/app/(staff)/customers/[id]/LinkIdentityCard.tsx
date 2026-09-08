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
 * Loaded on demand. Finding linkable handles is a scan across every stub
 * customer in the studio, and this repair is used a handful of times a year;
 * running that query on every owner render of every customer detail page paid
 * for a control almost nobody opens. The button IS the request.
 *
 * A native <select> (the convention in Studio and Content) rather than the
 * base-ui one: its options are real markup, so the handles on offer are
 * present in the rendered HTML and readable without hydration.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { linkIdentityAction, loadLinkableIdentitiesAction } from "./actions";

export interface LinkableIdentityOption {
  id: string;
  channel: "messenger" | "instagram";
  /** e.g. "amy.ink · Instagram (from Amy Rowe)". */
  label: string;
}

export function LinkIdentityCard({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [identities, setIdentities] = useState<
    LinkableIdentityOption[] | null
  >(null);

  return (
    <section className="mt-6 space-y-2 rounded-lg border border-border-default bg-bg-card p-4">
      <Label htmlFor="link-identity">Link a Messenger / Instagram handle</Label>
      {identities === null ? (
        <>
          <p className="text-sm text-text-muted">
            For when someone we already know messages from a handle we have
            never seen — their DMs land on an empty record of their own.
          </p>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  setIdentities(await loadLinkableIdentitiesAction(customerId));
                } catch {
                  toast.error("Could not load the linkable handles.");
                }
              })
            }
          >
            {pending ? "Looking…" : "Find a handle to link"}
          </Button>
        </>
      ) : (
        <IdentityPicker customerId={customerId} identities={identities} />
      )}
    </section>
  );
}

/**
 * The loaded half — split out so both states of the card render (and are
 * asserted) on their own, without a click.
 */
export function IdentityPicker({
  customerId,
  identities,
}: {
  customerId: string;
  identities: LinkableIdentityOption[];
}) {
  const [pending, start] = useTransition();
  const [identityId, setIdentityId] = useState("");

  if (identities.length === 0) {
    return (
      <p className="text-sm text-text-muted">No linkable handles right now.</p>
    );
  }

  return (
    <>
      <p className="text-sm text-text-muted">
        Moves the handle, and everything it has sent, onto this customer. The
        empty record it came from is deleted.
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
  );
}
