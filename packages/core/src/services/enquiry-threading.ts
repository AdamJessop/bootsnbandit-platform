import type { EnquiryChannel, EnquirySource, EnquiryStatus } from "@prisma/client";
import { prisma } from "@bnb/core/db";

/**
 * Where does an inbound message belong?
 *
 *   token match → the same customer's most recent enquiry with status in
 *   (new, replied, customer_replied) whose lastMessageAt/createdAt is within
 *   30 days → otherwise a brand-new enquiry.
 *
 * Closed and converted enquiries are NEVER reopened — a follow-up on a closed
 * thread becomes a new enquiry linked to the same customer. The reply token is
 * authoritative when it points at a still-open thread, so it deliberately
 * skips the 30-day window: the customer replied to our email, however late.
 *
 * `chooseThread` is pure so the rule is testable without a database;
 * `resolveThread` is the thin DB wrapper around it.
 */

export const THREAD_WINDOW_DAYS = 30;

export const THREADABLE_STATUSES: readonly EnquiryStatus[] = [
  "new",
  "replied",
  "customer_replied",
];

export function isThreadable(status: EnquiryStatus): boolean {
  return THREADABLE_STATUSES.includes(status);
}

export interface ThreadCandidate {
  id: string;
  status: EnquiryStatus;
  lastMessageAt: Date | null;
  createdAt: Date;
}

/** Last activity on the thread: the newest message, else when it was raised. */
export function activityAt(candidate: ThreadCandidate): Date {
  return candidate.lastMessageAt ?? candidate.createdAt;
}

export interface ChooseThreadInput {
  tokenMatch?: ThreadCandidate | null;
  candidates: ThreadCandidate[];
  now?: Date;
}

export type ThreadChoice =
  | { kind: "existing"; enquiryId: string }
  | { kind: "new" };

export function chooseThread(input: ChooseThreadInput): ThreadChoice {
  const now = input.now ?? new Date();
  const token = input.tokenMatch;
  if (token && isThreadable(token.status)) {
    return { kind: "existing", enquiryId: token.id };
  }

  const cutoff = now.getTime() - THREAD_WINDOW_DAYS * 24 * 3600_000;
  const eligible = input.candidates
    .filter((c) => isThreadable(c.status) && activityAt(c).getTime() >= cutoff)
    .sort((a, b) => activityAt(b).getTime() - activityAt(a).getTime());

  const best = eligible[0];
  return best ? { kind: "existing", enquiryId: best.id } : { kind: "new" };
}

/**
 * `Enquiry.source` predates channels and only knows the three web forms; an
 * email or Meta thread has no form, so it records the neutral `web` source and
 * carries its real origin in `Enquiry.channel`.
 */
export function sourceForChannel(channel: EnquiryChannel): EnquirySource {
  if (channel === "flash") return "flash";
  if (channel === "inkling") return "inkling";
  return "web";
}

export interface ResolveThreadInput {
  customerId: string;
  channel: EnquiryChannel;
  threadToken?: string | null;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  subject?: string | null;
  preferredArtistId?: string | null;
  now?: Date;
}

export interface ResolvedThread {
  enquiryId: string;
  created: boolean;
}

const CANDIDATE_SELECT = {
  id: true,
  status: true,
  lastMessageAt: true,
  createdAt: true,
} as const;

export async function resolveThread(
  input: ResolveThreadInput,
): Promise<ResolvedThread> {
  const now = input.now ?? new Date();

  const tokenMatch = input.threadToken
    ? await prisma.enquiry.findUnique({
        where: { threadToken: input.threadToken },
        select: { ...CANDIDATE_SELECT, customerId: true },
      })
    : null;

  // A token from another customer's thread is not a match — treat it as absent.
  const usableToken =
    tokenMatch && tokenMatch.customerId === input.customerId ? tokenMatch : null;

  const candidates = await prisma.enquiry.findMany({
    where: {
      customerId: input.customerId,
      status: { in: [...THREADABLE_STATUSES] },
    },
    select: CANDIDATE_SELECT,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const choice = chooseThread({ tokenMatch: usableToken, candidates, now });
  if (choice.kind === "existing") {
    return { enquiryId: choice.enquiryId, created: false };
  }

  const created = await prisma.enquiry.create({
    data: {
      customerId: input.customerId,
      contactName: input.contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      preferredArtistId: input.preferredArtistId ?? null,
      subject: input.subject ?? null,
      channel: input.channel,
      source: sourceForChannel(input.channel),
      status: "new",
    },
    select: { id: true },
  });
  return { enquiryId: created.id, created: true };
}
