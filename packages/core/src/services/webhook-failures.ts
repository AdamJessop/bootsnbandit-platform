import type { Prisma } from "@prisma/client";
import { prisma } from "@bnb/core/db";

/**
 * The audit trail behind Studio › Channels.
 *
 * A signed inbound webhook that we cannot process is a bug on our side, not
 * the provider's: retrying it at the provider (by answering 5xx) just storms
 * the endpoint with the same broken event. Instead the event body is stored
 * whole, the route answers 200, and an owner can replay it from the panel
 * once the cause is fixed.
 */

/** How far back the panel looks, and what "open failures" counts. */
export const WEBHOOK_FAILURE_WINDOW_DAYS = 7;

export interface RecordWebhookFailureInput {
  /** "resend" today; "meta" in Phase 3. */
  provider: string;
  /** Provider id of the event's subject, when we could read one. */
  externalId?: string | null;
  /** The event body exactly as received. */
  payload: unknown;
  error: string;
}

export interface WebhookFailureRow {
  id: string;
  provider: string;
  externalId: string | null;
  error: string;
  createdAt: Date;
  retriedAt: Date | null;
}

const ROW_SELECT = {
  id: true,
  provider: true,
  externalId: true,
  error: true,
  createdAt: true,
  retriedAt: true,
} as const;

/** The one byte Postgres jsonb refuses to hold. */
const NUL = /\u0000/g;

/**
 * Postgres jsonb rejects NUL bytes in strings; strip them defensively.
 *
 * The strip happens at VALUE level, inside the replacer, not on the
 * serialised text: a customer who writes the six characters `\u0000` in an
 * email body produces the escape sequence `\\u0000` in the JSON, and a regex
 * over the text would eat half of it and leave a stray backslash that no
 * longer parses (or, worse, parses as something else).
 */
function asJson(payload: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(
      JSON.stringify(payload ?? null, (_key, value) =>
        typeof value === "string" ? value.replace(NUL, "") : value,
      ),
    ) as Prisma.InputJsonValue;
  } catch {
    return { unserialisable: String(payload) } as Prisma.InputJsonValue;
  }
}

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600_000);
}

/**
 * Store a failure. NEVER throws: this runs inside the catch block of a webhook
 * that must still answer 200, so a database problem here is logged and
 * swallowed. Returns the row id, or null when even the write failed.
 */
export async function recordWebhookFailure(
  input: RecordWebhookFailureInput,
): Promise<string | null> {
  try {
    const row = await prisma.webhookFailure.create({
      data: {
        provider: input.provider,
        externalId: input.externalId ?? null,
        payload: asJson(input.payload),
        error: input.error.slice(0, 2000),
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[webhooks] failed to record a WebhookFailure row:", err);
    return null;
  }
}

/**
 * Newest first, within the window. Never selects `payload` (it can be large).
 * `openOnly` (default false, so existing callers are unchanged) restricts to
 * rows that have not been successfully replayed — the shape the Channels
 * panel's "failed events" list actually needs.
 */
export async function listRecentWebhookFailures(opts?: {
  provider?: string;
  sinceDays?: number;
  take?: number;
  openOnly?: boolean;
}): Promise<WebhookFailureRow[]> {
  return prisma.webhookFailure.findMany({
    where: {
      ...(opts?.provider ? { provider: opts.provider } : {}),
      ...(opts?.openOnly ? { retriedAt: null } : {}),
      createdAt: { gte: since(opts?.sinceDays ?? WEBHOOK_FAILURE_WINDOW_DAYS) },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts?.take ?? 25,
    select: ROW_SELECT,
  });
}

/** Failures in the window that have not been successfully replayed. */
export async function countOpenWebhookFailures(opts?: {
  provider?: string;
  sinceDays?: number;
}): Promise<number> {
  return prisma.webhookFailure.count({
    where: {
      ...(opts?.provider ? { provider: opts.provider } : {}),
      retriedAt: null,
      createdAt: { gte: since(opts?.sinceDays ?? WEBHOOK_FAILURE_WINDOW_DAYS) },
    },
  });
}

/** The stored event body, for a replay. */
export async function getWebhookFailure(
  id: string,
): Promise<{ id: string; provider: string; payload: unknown } | null> {
  const row = await prisma.webhookFailure.findUnique({
    where: { id },
    select: { id: true, provider: true, payload: true },
  });
  return row ? { id: row.id, provider: row.provider, payload: row.payload } : null;
}

/** The replay worked — keep the row for the audit trail, but stop counting it. */
export async function markWebhookFailureRetried(
  id: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.webhookFailure.update({
    where: { id },
    data: { retriedAt: at },
  });
}

/** The replay failed again — record why, and leave the row open. */
export async function setWebhookFailureError(
  id: string,
  error: string,
): Promise<void> {
  await prisma.webhookFailure.update({
    where: { id },
    data: { error: error.slice(0, 2000), retriedAt: null },
  });
}
