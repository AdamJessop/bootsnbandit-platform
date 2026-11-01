import type { EnquiryChannel } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { adminOrigin } from "@bnb/core/email/templates/theme";
import { inboundEmailDomain } from "./channels/email-format";
import { isOwnDomain } from "./channels/email-parse";

/**
 * New-enquiry alerts: a short email to every active owner when a BRAND-NEW
 * enquiry lands — public form, flash claim, Inkling, or an inbound email /
 * Messenger / Instagram message that opened a fresh thread. Replies on an
 * existing thread never alert; the inbox badge covers those.
 *
 * Owners are mailed at their own addresses (`User.email`). Anything on the
 * studio's own domain is skipped: mail TO that domain lands back in the
 * enquiry inbox, and mail FROM it is dropped there as a loop, so an alert sent
 * to studio@ would at best vanish and at worst become an enquiry about itself.
 *
 * Fire-and-forget. `notifyOwnersOfNewEnquiry` never throws and callers don't
 * await it: a slow Resend or a missing owner must never cost a customer their
 * enquiry. Each send is written to MessageLog by `sendEmail` like every other
 * mail, with no customer attached — it is staff mail, not a customer touch.
 */

/** Plain-English channel names for the alert ("Came in via …"). */
export const CHANNEL_LABEL: Record<EnquiryChannel, string> = {
  web: "Web form",
  flash: "Flash claim",
  inkling: "Inkling mood board",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};

/** Longest summary line, in characters, before it is cut with an ellipsis. */
export const SUMMARY_MAX = 140;

/** First non-blank line of the brief, flattened and cut to one short line. */
export function alertSummary(text: string | null | undefined): string | null {
  const line = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .find((l) => l.length > 0);
  if (!line) return null;
  const points = Array.from(line);
  return points.length > SUMMARY_MAX
    ? `${points
        .slice(0, SUMMARY_MAX - 1)
        .join("")
        .trimEnd()}…`
    : line;
}

/** True when `address` is on (or under) one of the studio's own domains. */
function isStudioAddress(address: string, domain: string | null): boolean {
  if (isOwnDomain(address, domain)) return true;
  const host = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return !!domain && host.endsWith(`.${domain.toLowerCase()}`);
}

/**
 * Who gets the alert: each owner's address once, minus anything blank or on
 * the studio's own domain (see the module comment for why that matters).
 */
export function alertRecipients(
  owners: { email: string }[],
  domain: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { email } of owners) {
    const address = email.trim();
    const key = address.toLowerCase();
    if (!address.includes("@") || seen.has(key)) continue;
    if (isStudioAddress(address, domain)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

/** Absolute admin link to one enquiry. */
export function enquiryAdminUrl(enquiryId: string): string {
  return `${adminOrigin()}/enquiries/${encodeURIComponent(enquiryId)}`;
}

export interface NewEnquiryAlertInput {
  enquiryId: string;
  customerName: string;
  channel: EnquiryChannel;
  /** Preferred artist's display name; looked up from the id when omitted. */
  artistName?: string | null;
  preferredArtistId?: string | null;
  /** The customer's words or brief — trimmed to one line here. */
  summary?: string | null;
}

/**
 * Email every active owner about a new enquiry. Resolves once every send has
 * been attempted; NEVER rejects — every failure is logged and swallowed.
 */
export async function notifyOwnersOfNewEnquiry(
  input: NewEnquiryAlertInput,
): Promise<void> {
  try {
    const owners = await prisma.user.findMany({
      where: { role: "OWNER", active: true },
      select: { email: true },
    });
    const recipients = alertRecipients(owners, inboundEmailDomain());
    if (recipients.length === 0) return;

    let artistName = input.artistName ?? null;
    if (!artistName && input.preferredArtistId) {
      const artist = await prisma.artist.findUnique({
        where: { id: input.preferredArtistId },
        select: { name: true },
      });
      artistName = artist?.name ?? null;
    }

    const data = {
      customerName: input.customerName,
      channelLabel: CHANNEL_LABEL[input.channel],
      artistName: artistName ?? undefined,
      summary: alertSummary(input.summary) ?? undefined,
      enquiryUrl: enquiryAdminUrl(input.enquiryId),
    };
    // Deliberately no customerId / enquiryId: this is staff mail. An enquiryId
    // would mirror it onto the customer's thread as if we had sent it to them.
    await Promise.all(
      recipients.map((to) => sendEmail({ to, type: "enquiry_alert", data })),
    );
  } catch (err) {
    console.error(
      `[enquiry-alert] could not alert owners about enquiry ${input.enquiryId}:`,
      err,
    );
  }
}
