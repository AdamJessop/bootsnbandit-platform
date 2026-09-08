/**
 * Which handles reach this person: their email and phone, plus every Meta
 * account linked to the record. Presentational + a pure builder, so it tests
 * in node without the page.
 *
 * The PSID/IGSID is deliberately NOT rendered — it is an opaque number that
 * means nothing to staff and only makes the header noisier.
 */
import { AtSign, Camera, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IdentityChip {
  kind: "email" | "phone" | "messenger" | "instagram";
  label: string;
}

const CHIP_ICON: Record<IdentityChip["kind"], LucideIcon> = {
  email: AtSign,
  phone: Phone,
  messenger: MessageCircle,
  instagram: Camera,
};

const CHIP_LABEL: Record<IdentityChip["kind"], string> = {
  email: "Email",
  phone: "Phone",
  messenger: "Messenger",
  instagram: "Instagram",
};

export function buildIdentityChips(input: {
  email: string | null;
  phone: string | null;
  identities: { channel: string; displayName: string | null }[];
}): IdentityChip[] {
  const chips: IdentityChip[] = [];
  if (input.email) chips.push({ kind: "email", label: input.email });
  if (input.phone) chips.push({ kind: "phone", label: input.phone });
  for (const identity of input.identities) {
    // CustomerIdentity.channel is typed as the whole MessageChannelKind enum;
    // only these two are ever written to it, and only these two are chips.
    if (identity.channel !== "messenger" && identity.channel !== "instagram") {
      continue;
    }
    chips.push({
      kind: identity.channel,
      label: identity.displayName?.trim() || "Linked account",
    });
  }
  return chips;
}

export function IdentityChips({ chips }: { chips: IdentityChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => {
        const Icon = CHIP_ICON[chip.kind];
        return (
          <li
            key={`${chip.kind}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-card px-2.5 py-1 text-xs text-text-secondary"
          >
            <Icon className="size-3.5 text-text-muted" aria-hidden />
            <span className="sr-only">{CHIP_LABEL[chip.kind]}: </span>
            {chip.label}
          </li>
        );
      })}
    </ul>
  );
}
