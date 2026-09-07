# Enquiries Omnichannel — Phase 2: Email Channel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make email a real two-way channel on the enquiry thread. A signed Resend `email.received` webhook lands on the admin app, fetches the full email, resolves the customer and the thread from the reply token, strips the quoted history, stores image attachments (after a magic-number sniff) and records an inbound `EnquiryMessage` — idempotently, and never with a 5xx. Outbound replies go out from `"<Artist first name> at Boots 'n' Bandit" <enquiries@<INBOUND_EMAIL_DOMAIN>>` with `Reply-To: enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>` and `In-Reply-To`/`References` of the last inbound message, so replies come straight back onto the same thread. A `WebhookFailure` table plus an owner-only **Studio › Channels** panel makes failures visible and retryable, and `docs/CHANNELS.md` is the runbook for wiring the domain, the MX record and the webhook.

**Architecture:** Four new focused modules under `packages/core/src/services/channels/` — `email-format.ts` (pure: address parsing, reply-token addressing, From/subject/Message-ID shaping, `stripQuotedReply`, `htmlToText`), `webhook-signature.ts` (pure: Standard-Webhooks/Svix HMAC-SHA256 verification with a 5-minute tolerance, implemented locally with `node:crypto` — no new dependency), `email.ts` (`parseResendInbound` in, `loadEnquiryEmailContext` + `sendEnquiryEmail` out) and `email-inbound.ts` (`ingestResendEvent`, the one orchestration both the webhook route and the Channels retry button call). `sendEnquiryEmail` does **not** duplicate `sendEmail`: `sendEmail` gains optional `from` / `replyTo` / `headers` so the existing MessageLog + `recordOutbound` + `authorUserId` machinery is reused verbatim and the `staff_reply` template is untouched. `services/webhook-failures.ts` owns the new `WebhookFailure` table. The admin app gets one unauthenticated-but-verified route (`POST /api/webhooks/resend`, modelled on `/api/cron/run`) and one owner-only settings page (`/studio/channels`).

**Tech Stack:** Node 22, npm workspaces, Next.js 15 App Router, React 19, TypeScript, Prisma 7 (Postgres 16), zod 4, vitest 4 (`renderToStaticMarkup` for components, `testdb` harness for DB suites), `resend` v6.14 (already a dependency; `emails.receiving.get` / `emails.receiving.attachments.list` are used for inbound retrieval), `node:crypto` for signature verification, shadcn/ui + Tailwind (admin).

**Spec:** `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md` (Phasing → phase 2: "Resend inbound webhook, outbound identity + Reply-To token, attachments, Channels panel (email part), runbook")

**Builds on:** `docs/superpowers/plans/2026-09-07-enquiries-phase-1-identity-and-threads.md` (merged as `feat/enquiries-phase-1`). Every Phase-1 signature this plan consumes is quoted verbatim in the task that first uses it.

## Global Constraints

- Node 22, npm workspaces. Tests: `npm test -w @bnb/core`, `npm test -w @bnb/admin`, `npm test -w @bnb/web`. Dev Postgres is `docker compose up -d` (port 5435); DB suites use the `testdb` harness (`testDb`, `dbReachable`, `closeTestDb`, `uid` from `packages/core/src/services/testdb.ts`) and **return early** when `dbReachable()` is false.
- Load env for CLI work with `set -a && . ./.env && set +a` from the repo root. Prisma CLI loads the root `.env` itself via `packages/core/prisma.config.ts`.
- Migrations: `npm -w @bnb/core run db:migrate -- --name <name>` (= `prisma migrate dev`). The one migration in this plan also ships its exact `packages/core/prisma/migrations/20260908120000_email_channel/migration.sql` so it can be written by hand and applied with `npm -w @bnb/core run db:migrate` when `migrate dev` cannot generate it. After any schema change run `npm run db:generate`.
- **No new runtime dependencies.** Signature verification is implemented locally with `node:crypto` (Task 3) — see that task's rationale for why `resend.webhooks.verify` is not used and why `standardwebhooks` (a *transitive* dependency of `resend`) must not be imported directly.
- `apps/web` is **not touched in this phase**. The webhook lives in `apps/admin` per the spec. `apps/web` must never import `@bnb/core/auth` (a guard test enforces it); nothing here changes that.
- Admin uses shadcn/ui + Tailwind design tokens (`text-text-muted`, `border-border-default`, `bg-bg-card`, `text-bb-teal`, `text-bb-gold`, …). Images are plain `<img>`, never `next/image`.
- `packages/core/package.json` already maps `"./services/*": "./src/services/*.ts"`, and Node subpath patterns match `/`, so `@bnb/core/services/channels/email`, `/channels/email-inbound`, `/channels/email-format`, `/channels/webhook-signature` and `/webhook-failures` all resolve with **no exports change**. The vitest alias `/^@bnb\/core\/(.*)$/` resolves them the same way. Do not add per-file entries.
- `packages/core/src/services/index.ts` gains `export * from "./webhook-failures";` only. The `channels/*` modules are **not** re-exported from the barrel (they are channel-specific and would collide with Phase 3's `channels/meta.ts` names); consumers import the subpath directly.
- **Attachment ingestion MUST sniff the mime before storing bytes.** Bytes are only ever stored when `sniffImageMime(bytes)` from `@bnb/core/uploads` returns a supported raster type, and the row is written with the **sniffed** mime, never the declared `content_type`. A failed sniff downgrades the attachment to a link-only (`url`) row. This is a Phase-1 review requirement carried into every ingestion path.
- **The webhook route never throws and never returns 5xx for processing errors.** Bad/absent signature → 401. Unconfigured secret → 503. Everything else → a `WebhookFailure` row plus HTTP 200, so Resend does not retry-storm.
- Inbound is **idempotent on `externalId`** (the Resend email id), which is already `@unique` on `EnquiryMessage` and already short-circuits inside `recordInbound`.
- Threading uses the Phase-1 `resolveThread`: the reply address `enq-<token>@<INBOUND_EMAIL_DOMAIN>` parsed out of **all** `to`/`cc` addresses is primary; the `References`/`In-Reply-To` headers are a secondary token source; failing both, the customer match inside `resolveThread` applies.
- Commit after every task with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
  ```
- Do not stage `docs/plans/2026-07-29-artist-showcase-screen.md` or `.superpowers/` (pre-existing unrelated changes). Every commit uses an explicit `git add` list.

---

## File map

| Path | Responsibility |
| --- | --- |
| `packages/core/prisma/schema.prisma` + 1 migration | `WebhookFailure` model; `EnquiryMessage.messageIdHeader` |
| `packages/core/src/services/webhook-failures.ts` (+test) | record / list / count / read-payload / mark-retried |
| `packages/core/src/services/enquiry-messages.ts` (+test) | `RecordMessageInput.messageIdHeader` |
| `packages/core/src/services/index.ts` | barrel export for `webhook-failures` |
| `packages/core/src/services/channels/email-format.ts` (+test) | pure address / token / header / subject shaping, `stripQuotedReply`, `htmlToText` |
| `packages/core/src/services/channels/webhook-signature.ts` (+test) | `signWebhookPayload`, `verifyWebhookSignature` (HMAC-SHA256, 5-min tolerance) |
| `packages/core/src/services/channels/__fixtures__/*.json` | Resend `email.received` event, fetched inbound email, attachment list |
| `packages/core/src/services/channels/email.ts` (+test) | `parseResendInbound`, `loadEnquiryEmailContext`, `sendEnquiryEmail` |
| `packages/core/src/services/channels/email-inbound.ts` (+test) | `ingestResendEvent` — the one inbound orchestration |
| `packages/core/src/email/index.ts` (+test) | `sendEmail` gains `from` / `replyTo` / `headers` |
| `apps/admin/src/app/api/webhooks/resend/route.ts` (+test) | signed webhook endpoint; failures → `WebhookFailure` + 200 |
| `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+test) | pure `chooseReplyChannel` |
| `apps/admin/src/app/(staff)/enquiries/actions.ts` (+test) | `replyToEnquiry` picks the channel and sends via `sendEnquiryEmail` |
| `apps/admin/src/app/(staff)/studio/channels/{page,actions}.tsx/.ts` (+tests) | owner-only Channels panel + retry action |
| `apps/admin/src/app/(staff)/studio/page.tsx` (+test) | Channels card on the studio hub |
| `docs/CHANNELS.md` | new runbook (Resend domain, MX, webhook, secrets, failures) |
| `docs/DEPLOY.md`, `.env.production.example`, `docker-compose.prod.yml` | the two new admin-only vars |
| `docs/PROJECT-BRIEF.md` | build-log entry |

---

### Task 1: `WebhookFailure` + `EnquiryMessage.messageIdHeader`

**Files:**
- Modify: `packages/core/prisma/schema.prisma`, `packages/core/src/services/enquiry-messages.ts`, `packages/core/src/services/enquiry-messages.test.ts`, `packages/core/src/services/index.ts`
- Create: `packages/core/prisma/migrations/20260908120000_email_channel/migration.sql`, `packages/core/src/services/webhook-failures.ts`, `packages/core/src/services/webhook-failures.test.ts`

**Interfaces:**
- Consumes (Phase 1, verbatim — `packages/core/src/services/enquiry-messages.ts`):
  ```ts
  export interface RecordMessageInput {
    enquiryId: string;
    customerId?: string | null;
    channel: MessageChannelKind;
    bodyText: string;
    bodyHtml?: string | null;
    subject?: string | null;
    fromName?: string | null;
    fromAddress?: string | null;
    externalId?: string | null;
    deliveryStatus?: MessageStatus;
    attachments?: StoreAttachmentInput[];
    at?: Date;
  }
  export async function recordInbound(input: RecordMessageInput): Promise<ThreadMessageRow>
  ```
- Produces:
  ```ts
  // Prisma
  model WebhookFailure { id, provider, externalId?, payload Json, error, createdAt, retriedAt? }
  EnquiryMessage gains: messageIdHeader String?

  // packages/core/src/services/webhook-failures.ts
  export interface RecordWebhookFailureInput {
    provider: string;
    externalId?: string | null;
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
  export const WEBHOOK_FAILURE_WINDOW_DAYS = 7;
  export async function recordWebhookFailure(input: RecordWebhookFailureInput): Promise<string | null>
  export async function listRecentWebhookFailures(opts?: { provider?: string; sinceDays?: number; take?: number }): Promise<WebhookFailureRow[]>
  export async function countOpenWebhookFailures(opts?: { provider?: string; sinceDays?: number }): Promise<number>
  export async function getWebhookFailure(id: string): Promise<{ id: string; provider: string; payload: unknown } | null>
  export async function markWebhookFailureRetried(id: string, at?: Date): Promise<void>
  export async function setWebhookFailureError(id: string, error: string): Promise<void>

  // packages/core/src/services/enquiry-messages.ts
  RecordMessageInput gains: messageIdHeader?: string | null
  ```

- [ ] **Step 1: Write the failing tests**

`packages/core/src/services/webhook-failures.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  countOpenWebhookFailures,
  getWebhookFailure,
  listRecentWebhookFailures,
  markWebhookFailureRetried,
  recordWebhookFailure,
  setWebhookFailureError,
} from "./webhook-failures";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

/**
 * WebhookFailure is the audit trail behind the Channels panel: every inbound
 * event we could not process is stored whole so it can be replayed, and the
 * recorder itself must never throw (it runs in the catch block of a webhook
 * that has to answer 200).
 */
describe("webhook failures (DB)", () => {
  const ids: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (ids.length)
        await db().webhookFailure.deleteMany({ where: { id: { in: ids } } });
    }
    await closeTestDb();
  });

  it("stores the whole payload and reads it back for a retry", async () => {
    if (!(await dbReachable())) return;
    const externalId = uid("email");
    const payload = { type: "email.received", data: { email_id: externalId } };
    const id = await recordWebhookFailure({
      provider: "resend",
      externalId,
      payload,
      error: "boom",
    });
    expect(id).toBeTruthy();
    ids.push(id as string);

    const stored = await getWebhookFailure(id as string);
    expect(stored?.provider).toBe("resend");
    expect(stored?.payload).toEqual(payload);
  });

  it("lists recent failures newest first and counts only un-retried ones", async () => {
    if (!(await dbReachable())) return;
    const marker = uid("ext");
    const older = await recordWebhookFailure({
      provider: "resend",
      externalId: `${marker}-a`,
      payload: { n: 1 },
      error: "first",
    });
    const newer = await recordWebhookFailure({
      provider: "resend",
      externalId: `${marker}-b`,
      payload: { n: 2 },
      error: "second",
    });
    ids.push(older as string, newer as string);

    const rows = await listRecentWebhookFailures({ provider: "resend" });
    const mine = rows.filter((r) => r.externalId?.startsWith(marker));
    expect(mine.map((r) => r.externalId)).toEqual([
      `${marker}-b`,
      `${marker}-a`,
    ]);
    expect(mine[0].retriedAt).toBeNull();

    const before = await countOpenWebhookFailures({ provider: "resend" });
    await markWebhookFailureRetried(newer as string);
    const after = await countOpenWebhookFailures({ provider: "resend" });
    expect(after).toBe(before - 1);
    const reread = await listRecentWebhookFailures({ provider: "resend" });
    expect(
      reread.find((r) => r.id === newer)?.retriedAt,
    ).toBeInstanceOf(Date);
  });

  it("records a fresh error message on a failed retry", async () => {
    if (!(await dbReachable())) return;
    const id = await recordWebhookFailure({
      provider: "resend",
      payload: { n: 3 },
      error: "first attempt",
    });
    ids.push(id as string);
    await setWebhookFailureError(id as string, "second attempt");
    const rows = await listRecentWebhookFailures({ provider: "resend" });
    expect(rows.find((r) => r.id === id)?.error).toBe("second attempt");
  });

  it("never throws when the write itself fails", async () => {
    if (!(await dbReachable())) return;
    // A payload Postgres' jsonb cannot hold (a NUL byte in a string) — the
    // recorder must swallow it, because it runs inside a webhook catch block.
    const id = await recordWebhookFailure({
      provider: "resend",
      payload: { bad: " " },
      error: "unstorable",
    });
    if (id) ids.push(id);
    expect(id === null || typeof id === "string").toBe(true);
  });
});
```

Append to `packages/core/src/services/enquiry-messages.test.ts`, inside the existing `describe("enquiry messages (DB)")` block (it already has the `seed()` helper and the `customers`/`enquiries` cleanup arrays):

```ts
  it("persists the RFC Message-ID header of an inbound email", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const messageIdHeader = `<${uid("mid")}@mail.example.com>`;
    const row = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "threaded",
      externalId: uid("ext"),
      messageIdHeader,
    });
    const stored = await db().enquiryMessage.findUniqueOrThrow({
      where: { id: row.id },
      select: { messageIdHeader: true },
    });
    expect(stored.messageIdHeader).toBe(messageIdHeader);
  });
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npm test -w @bnb/core -- src/services/webhook-failures.test.ts
```
Expected: FAIL — `Failed to load url ./webhook-failures` (cannot find module).

```bash
npm test -w @bnb/core -- src/services/enquiry-messages.test.ts
```
Expected: FAIL — `Unknown argument 'messageIdHeader'` on `enquiryMessage.create` (and `Unknown field messageIdHeader for select statement`).

- [ ] **Step 3: Edit the schema**

In `packages/core/prisma/schema.prisma`, add `messageIdHeader` to `EnquiryMessage` immediately after `externalId`:

```prisma
  externalId     String?            @unique
  // RFC 5322 Message-ID of an inbound email, kept so an outbound reply can set
  // In-Reply-To/References and land in the customer's own mail thread.
  // `externalId` holds the provider's id (a Resend email id) — a different
  // thing, and not a valid value for those headers.
  messageIdHeader String?
```

Add the `WebhookFailure` model at the end of the file (after the last model):

```prisma
// Inbound webhook events we accepted (signature valid) but could not process.
// The whole event body is kept so Studio › Channels can replay it; the route
// itself always answers 200 so the provider does not retry-storm.
model WebhookFailure {
  id         String    @id @default(cuid())
  provider   String
  externalId String?
  payload    Json
  error      String
  createdAt  DateTime  @default(now())
  retriedAt  DateTime?

  @@index([provider, createdAt])
  @@index([externalId])
}
```

- [ ] **Step 4: Create the migration**

```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate -- --name email_channel
```

Fallback — write `packages/core/prisma/migrations/20260908120000_email_channel/migration.sql` by hand with exactly:

```sql
-- AlterTable
ALTER TABLE "EnquiryMessage" ADD COLUMN     "messageIdHeader" TEXT;

-- CreateTable
CREATE TABLE "WebhookFailure" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookFailure_provider_createdAt_idx" ON "WebhookFailure"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookFailure_externalId_idx" ON "WebhookFailure"("externalId");
```

Apply and regenerate:
```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate && npm run db:generate
npx prisma validate --schema=packages/core/prisma/schema.prisma
```
Expected: migration applied, `The schema at ... is valid`.

- [ ] **Step 5: Implement the service**

`packages/core/src/services/webhook-failures.ts`:

```ts
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

/** Postgres jsonb rejects NUL bytes in strings; strip them defensively. */
function asJson(payload: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(
      JSON.stringify(payload ?? null).replace(/\\u0000/g, ""),
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

/** Newest first, within the window. Never selects `payload` (it can be large). */
export async function listRecentWebhookFailures(opts?: {
  provider?: string;
  sinceDays?: number;
  take?: number;
}): Promise<WebhookFailureRow[]> {
  return prisma.webhookFailure.findMany({
    where: {
      ...(opts?.provider ? { provider: opts.provider } : {}),
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
```

- [ ] **Step 6: Thread the new column through `recordInbound`**

In `packages/core/src/services/enquiry-messages.ts`, add to `RecordMessageInput` (immediately after `externalId`):

```ts
  externalId?: string | null;
  /**
   * RFC 5322 Message-ID of an inbound email. Stored so an outbound reply can
   * set In-Reply-To/References and land inside the customer's own mail thread;
   * `externalId` holds the provider id, which is not a valid header value.
   */
  messageIdHeader?: string | null;
```

and in `createMessage`'s `tx.enquiryMessage.create({ data: { ... } })`, immediately after `externalId: input.externalId ?? null,`:

```ts
        messageIdHeader: input.messageIdHeader ?? null,
```

Leave `MESSAGE_SELECT` / `ThreadMessageRow` alone — no render path needs the header; the reply path selects it directly (Task 7).

In `packages/core/src/services/index.ts`, add after `export * from "./enquiry-messages";`:

```ts
export * from "./webhook-failures";
```

- [ ] **Step 7: Run tests, commit**

```bash
npm test -w @bnb/core -- src/services/webhook-failures.test.ts src/services/enquiry-messages.test.ts
```
Expected: PASS.

```bash
npm test -w @bnb/core
```
Expected: PASS (the migration is purely additive).

```bash
git add packages/core/prisma/schema.prisma packages/core/prisma/migrations packages/core/src/services/webhook-failures.ts packages/core/src/services/webhook-failures.test.ts packages/core/src/services/enquiry-messages.ts packages/core/src/services/enquiry-messages.test.ts packages/core/src/services/index.ts
git commit -m "feat(core): WebhookFailure audit table and inbound Message-ID storage

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 2: `channels/email-format.ts` — addresses, tokens, headers, quoted-reply stripping

**Files:**
- Create: `packages/core/src/services/channels/email-format.ts`, `packages/core/src/services/channels/email-format.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const STUDIO_NAME = "Boots 'n' Bandit";
  export const INBOUND_LOCAL_PREFIX = "enq-";
  export const OUTBOUND_LOCAL_PART = "enquiries";

  export function inboundEmailDomain(env?: NodeJS.ProcessEnv): string | null
  export interface ParsedAddress { name: string | null; address: string }
  export function parseAddress(raw: string | null | undefined): ParsedAddress | null
  export function parseAddressList(raw: string | string[] | null | undefined): ParsedAddress[]
  export function replyAddressFor(threadToken: string, domain: string): string
  export function outboundAddressFor(domain: string): string
  export function tokenFromAddress(raw: string, domain: string): string | null
  export function threadTokenFrom(addresses: (string | null | undefined)[], domain: string | null): string | null
  export function tokenFromText(text: string | null | undefined, domain: string | null): string | null
  export function firstName(full: string | null | undefined): string | null
  export function fromDisplayName(artistName: string | null | undefined): string
  export function formatFromHeader(displayName: string, address: string): string
  export function formatMessageId(raw: string | null | undefined): string | null
  export function replySubject(subject: string | null | undefined): string
  export function headerValue(headers: Record<string, string> | null | undefined, name: string): string | null
  export function isAutoSubmitted(headers: Record<string, string> | null | undefined): boolean
  export function htmlToText(html: string | null | undefined): string
  export function stripQuotedReply(text: string | null | undefined): string
  ```

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/channels/email-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  firstName,
  formatFromHeader,
  formatMessageId,
  fromDisplayName,
  headerValue,
  htmlToText,
  inboundEmailDomain,
  isAutoSubmitted,
  outboundAddressFor,
  parseAddress,
  parseAddressList,
  replyAddressFor,
  replySubject,
  stripQuotedReply,
  threadTokenFrom,
  tokenFromAddress,
  tokenFromText,
} from "./email-format";

const DOMAIN = "mail.bootsnbandit.test";
const TOKEN = "clw9k2x0a0001qq3f8h2m5t7z";

describe("parseAddress", () => {
  it("splits a display name from the address and lowercases the address", () => {
    expect(parseAddress("Amy Jones <Amy.Jones@Example.COM>")).toEqual({
      name: "Amy Jones",
      address: "amy.jones@example.com",
    });
  });

  it("unquotes and unescapes a quoted display name", () => {
    expect(parseAddress('"Jones, Amy" <amy@example.com>')?.name).toBe(
      "Jones, Amy",
    );
    expect(parseAddress('"Amy \\"AJ\\" Jones" <amy@example.com>')?.name).toBe(
      'Amy "AJ" Jones',
    );
  });

  it("accepts a bare address and rejects junk", () => {
    expect(parseAddress("amy@example.com")).toEqual({
      name: null,
      address: "amy@example.com",
    });
    expect(parseAddress("   ")).toBeNull();
    expect(parseAddress(null)).toBeNull();
    expect(parseAddress("not an address")).toBeNull();
    expect(parseAddress("Amy Jones <not-an-address>")).toBeNull();
  });
});

describe("parseAddressList", () => {
  it("accepts an array as Resend sends it", () => {
    expect(
      parseAddressList(["a@x.test", "Bee <b@x.test>"]).map((p) => p.address),
    ).toEqual(["a@x.test", "b@x.test"]);
  });

  it("splits a comma-joined header without breaking quoted names", () => {
    expect(
      parseAddressList('"Jones, Amy" <a@x.test>, b@x.test').map(
        (p) => p.address,
      ),
    ).toEqual(["a@x.test", "b@x.test"]);
  });

  it("drops unparseable entries instead of throwing", () => {
    expect(parseAddressList(["", "nope", "c@x.test"])).toHaveLength(1);
    expect(parseAddressList(null)).toEqual([]);
  });
});

describe("reply-token addressing", () => {
  it("builds the per-enquiry reply address and the studio send address", () => {
    expect(replyAddressFor(TOKEN, DOMAIN)).toBe(`enq-${TOKEN}@${DOMAIN}`);
    expect(outboundAddressFor(DOMAIN)).toBe(`enquiries@${DOMAIN}`);
  });

  it("reads the token back out, case-insensitively and through a display name", () => {
    expect(tokenFromAddress(`ENQ-${TOKEN}@${DOMAIN.toUpperCase()}`, DOMAIN)).toBe(
      TOKEN,
    );
    expect(
      tokenFromAddress(`Studio <enq-${TOKEN}@${DOMAIN}>`, DOMAIN),
    ).toBe(TOKEN);
  });

  it("tolerates sub-addressing added by a forwarding MTA", () => {
    expect(tokenFromAddress(`enq-${TOKEN}+fwd@${DOMAIN}`, DOMAIN)).toBe(TOKEN);
  });

  it("ignores other mailboxes and other domains", () => {
    expect(tokenFromAddress(`hello@${DOMAIN}`, DOMAIN)).toBeNull();
    expect(tokenFromAddress(`enq-${TOKEN}@evil.test`, DOMAIN)).toBeNull();
    expect(tokenFromAddress("rubbish", DOMAIN)).toBeNull();
  });

  it("scans every to/cc address and returns the first token found", () => {
    expect(
      threadTokenFrom(
        ["studio@example.com", null, `enq-${TOKEN}@${DOMAIN}`],
        DOMAIN,
      ),
    ).toBe(TOKEN);
    expect(threadTokenFrom([`enq-${TOKEN}@${DOMAIN}`], null)).toBeNull();
    expect(threadTokenFrom(["studio@example.com"], DOMAIN)).toBeNull();
  });

  it("finds a token inside a References header as a secondary source", () => {
    expect(
      tokenFromText(
        `<abc@x> <enq-${TOKEN}@${DOMAIN}> <def@y>`,
        DOMAIN,
      ),
    ).toBe(TOKEN);
    expect(tokenFromText("<abc@x>", DOMAIN)).toBeNull();
    expect(tokenFromText(null, DOMAIN)).toBeNull();
  });
});

describe("inboundEmailDomain", () => {
  it("normalises and tolerates a leading @", () => {
    expect(inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: " @Mail.Example.COM " })).toBe(
      "mail.example.com",
    );
    expect(inboundEmailDomain({})).toBeNull();
    expect(inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: "  " })).toBeNull();
  });
});

describe("outbound identity", () => {
  it("uses the artist's first name in the From display name", () => {
    expect(firstName("Sarah North")).toBe("Sarah");
    expect(firstName("  ")).toBeNull();
    expect(fromDisplayName("Sarah North")).toBe("Sarah at Boots 'n' Bandit");
    expect(fromDisplayName(null)).toBe("Boots 'n' Bandit");
  });

  it("quotes and escapes the display name in the From header", () => {
    expect(
      formatFromHeader("Sarah at Boots 'n' Bandit", "enquiries@mail.test"),
    ).toBe(`"Sarah at Boots 'n' Bandit" <enquiries@mail.test>`);
    expect(formatFromHeader('He said "hi"', "a@b.test")).toBe(
      '"He said \\"hi\\"" <a@b.test>',
    );
  });

  it("angle-wraps a Message-ID exactly once", () => {
    expect(formatMessageId("abc@x.test")).toBe("<abc@x.test>");
    expect(formatMessageId("<abc@x.test>")).toBe("<abc@x.test>");
    expect(formatMessageId("  ")).toBeNull();
    expect(formatMessageId(null)).toBeNull();
  });

  it("prefixes Re: once and falls back when there is no subject", () => {
    expect(replySubject("Sleeve idea")).toBe("Re: Sleeve idea");
    expect(replySubject("Re: Sleeve idea")).toBe("Re: Sleeve idea");
    expect(replySubject("RE: Sleeve idea")).toBe("RE: Sleeve idea");
    expect(replySubject(null)).toBe("Re: your enquiry");
  });
});

describe("headers", () => {
  it("reads a header case-insensitively", () => {
    expect(headerValue({ "Message-ID": "<a@b>" }, "message-id")).toBe("<a@b>");
    expect(headerValue(null, "message-id")).toBeNull();
  });

  it("detects auto-replies and bulk mail", () => {
    expect(isAutoSubmitted({ "Auto-Submitted": "auto-replied" })).toBe(true);
    expect(isAutoSubmitted({ "auto-submitted": "no" })).toBe(false);
    expect(isAutoSubmitted({ Precedence: "bulk" })).toBe(true);
    expect(isAutoSubmitted({ "X-Autoreply": "yes" })).toBe(true);
    expect(isAutoSubmitted({ Subject: "hi" })).toBe(false);
    expect(isAutoSubmitted(null)).toBe(false);
  });
});

describe("htmlToText", () => {
  it("drops the quoted blockquote, scripts and styles, and keeps the prose", () => {
    const text = htmlToText(
      '<style>p{}</style><script>evil()</script><div>Tuesday works<br>for me</div>' +
        '<blockquote class="gmail_quote"><p>On Mon, Sarah wrote:</p></blockquote>',
    );
    expect(text).toContain("Tuesday works");
    expect(text).toContain("for me");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("Sarah wrote");
  });

  it("decodes the common entities and collapses blank runs", () => {
    expect(htmlToText("<p>Boots &amp; Bandit</p><p>&nbsp;</p><p>ok</p>")).toBe(
      "Boots & Bandit\n\nok",
    );
    expect(htmlToText(null)).toBe("");
  });
});

describe("stripQuotedReply", () => {
  it("cuts a Gmail attribution line and everything after it", () => {
    const body = [
      "Tuesday works for me.",
      "",
      "On Mon, 7 Sep 2026 at 10:04, Sarah <enquiries@mail.test> wrote:",
      "> Hi Amy, how about Tuesday?",
      "> — Sarah",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Tuesday works for me.");
  });

  it("cuts a wrapped Gmail attribution split over two lines", () => {
    const body = [
      "Sounds good.",
      "",
      "On Mon, 7 Sep 2026 at 10:04, Sarah North",
      "<enquiries@mail.test> wrote:",
      "> Hi Amy",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Sounds good.");
  });

  it("cuts an Outlook original-message block and its divider", () => {
    expect(
      stripQuotedReply("Yes please.\n\n-----Original Message-----\nFrom: Sarah"),
    ).toBe("Yes please.");
    expect(
      stripQuotedReply(`Yes please.\n\n${"_".repeat(32)}\nFrom: Sarah`),
    ).toBe("Yes please.");
  });

  it("cuts an Outlook quoted header block", () => {
    const body = [
      "Booked.",
      "",
      "From: Sarah <enquiries@mail.test>",
      "Sent: 07 September 2026 10:04",
      "To: Amy Jones",
      "Subject: Your enquiry",
      "",
      "Hi Amy",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Booked.");
  });

  it("cuts a bare quoted block", () => {
    expect(stripQuotedReply("Yes.\n> previous message")).toBe("Yes.");
  });

  it("leaves an unquoted message and a lone 'From:' sentence alone", () => {
    expect(stripQuotedReply("Hi there,\n\nCan I book in?")).toBe(
      "Hi there,\n\nCan I book in?",
    );
    expect(stripQuotedReply("From: the tattoo I sent you")).toBe(
      "From: the tattoo I sent you",
    );
    expect(stripQuotedReply("On Tuesday, I am free all day.")).toBe(
      "On Tuesday, I am free all day.",
    );
  });

  it("never returns empty — a fully-quoted reply keeps its original text", () => {
    const quoted = "> only quoted text";
    expect(stripQuotedReply(quoted)).toBe(quoted);
    expect(stripQuotedReply("   ")).toBe("");
    expect(stripQuotedReply(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts`
Expected: FAIL — `Failed to load url ./email-format` / cannot find module `./email-format`.

- [ ] **Step 3: Implement**

`packages/core/src/services/channels/email-format.ts`:

```ts
/**
 * Pure email shaping for the enquiry channel — no I/O, no Prisma, no env
 * beyond one explicit lookup, so every rule here is unit-testable.
 *
 * The load-bearing idea is the reply token: every outbound enquiry email sets
 * `Reply-To: enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>`, so when the customer
 * hits reply the inbound webhook can read the enquiry straight off the
 * recipient address instead of guessing from the sender.
 */

export const STUDIO_NAME = "Boots 'n' Bandit";
/** Local-part prefix of the per-enquiry reply address. */
export const INBOUND_LOCAL_PREFIX = "enq-";
/** Local-part every enquiry reply is sent FROM. */
export const OUTBOUND_LOCAL_PART = "enquiries";

/**
 * The subdomain whose MX points at Resend — both the inbound mailbox domain
 * and the outbound From domain. Null when unconfigured, which the callers
 * treat as "email replies fall back to the plain studio address".
 */
export function inboundEmailDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  return raw ? raw : null;
}

export interface ParsedAddress {
  name: string | null;
  address: string;
}

const BARE_ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

/** `Amy Jones <amy@x.test>` / `"Jones, Amy" <amy@x.test>` / `amy@x.test`. */
export function parseAddress(
  raw: string | null | undefined,
): ParsedAddress | null {
  const value = raw?.trim();
  if (!value) return null;

  const angled = /^(.*?)<([^<>]+)>\s*$/s.exec(value);
  if (angled) {
    const address = angled[2].trim().toLowerCase();
    if (!BARE_ADDRESS.test(address)) return null;
    const name = angled[1]
      .trim()
      .replace(/^"(.*)"$/s, "$1")
      .replace(/\\(.)/g, "$1")
      .trim();
    return { name: name || null, address };
  }

  const address = value.toLowerCase();
  if (!BARE_ADDRESS.test(address)) return null;
  return { name: null, address };
}

/** Split a header on commas that are outside quotes and angle brackets. */
function splitAddresses(raw: string): string[] {
  const out: string[] = [];
  let buf = "";
  let quoted = false;
  let depth = 0;
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") depth += 1;
    else if (!quoted && ch === ">") depth = Math.max(0, depth - 1);
    if (ch === "," && !quoted && depth === 0) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Resend hands us `to`/`cc` as arrays, but each element may still be a full
 * `Name <addr>, Other <addr>` header, so both shapes are accepted. Anything
 * unparseable is dropped rather than thrown — a malformed Cc must not lose us
 * the whole email.
 */
export function parseAddressList(
  raw: string | string[] | null | undefined,
): ParsedAddress[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: ParsedAddress[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    for (const piece of splitAddresses(item)) {
      const parsed = parseAddress(piece);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

export function replyAddressFor(threadToken: string, domain: string): string {
  return `${INBOUND_LOCAL_PREFIX}${threadToken}@${domain}`;
}

export function outboundAddressFor(domain: string): string {
  return `${OUTBOUND_LOCAL_PART}@${domain}`;
}

/**
 * The token out of one recipient address, or null. Sub-addressing (`+tag`) is
 * tolerated because forwarding MTAs add it; a different domain is never a
 * match, so another studio's token can't steer our threading.
 */
export function tokenFromAddress(raw: string, domain: string): string | null {
  const parsed = parseAddress(raw);
  if (!parsed) return null;
  const at = parsed.address.lastIndexOf("@");
  const local = parsed.address.slice(0, at).split("+")[0];
  const host = parsed.address.slice(at + 1);
  if (host !== domain.trim().toLowerCase()) return null;
  const match = /^enq-([a-z0-9]{8,})$/i.exec(local);
  return match ? match[1] : null;
}

/** First token across every to/cc address. The primary threading signal. */
export function threadTokenFrom(
  addresses: (string | null | undefined)[],
  domain: string | null,
): string | null {
  if (!domain) return null;
  for (const address of addresses) {
    if (!address) continue;
    const token = tokenFromAddress(address, domain);
    if (token) return token;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Secondary source: some clients drop our reply address from `To` but keep it
 * inside `References`/`In-Reply-To`. Used only when the recipient scan fails.
 */
export function tokenFromText(
  text: string | null | undefined,
  domain: string | null,
): string | null {
  if (!text || !domain) return null;
  const re = new RegExp(
    `enq-([a-z0-9]{8,})@${escapeRegExp(domain.trim().toLowerCase())}`,
    "i",
  );
  const match = re.exec(text);
  return match ? match[1] : null;
}

export function firstName(full: string | null | undefined): string | null {
  const trimmed = full?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

/** Decision 6: the studio address, wearing the artist's name. */
export function fromDisplayName(artistName: string | null | undefined): string {
  const first = firstName(artistName);
  return first ? `${first} at ${STUDIO_NAME}` : STUDIO_NAME;
}

/** RFC 5322 quoted-string display name — the studio name contains an apostrophe. */
export function formatFromHeader(displayName: string, address: string): string {
  const escaped = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${address}>`;
}

export function formatMessageId(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const bare = value.replace(/^<+/, "").replace(/>+$/, "").trim();
  return bare ? `<${bare}>` : null;
}

export function replySubject(subject: string | null | undefined): string {
  const value = subject?.trim();
  if (!value) return "Re: your enquiry";
  return /^re:\s/i.test(value) ? value : `Re: ${value}`;
}

export function headerValue(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

/**
 * Out-of-office replies, bounce notifications and mailing-list traffic must
 * not create enquiries or flip a thread to `customer_replied` — they are not
 * the customer talking to us.
 */
export function isAutoSubmitted(
  headers: Record<string, string> | null | undefined,
): boolean {
  const auto = headerValue(headers, "auto-submitted")?.trim().toLowerCase();
  if (auto && auto !== "no") return true;
  const precedence = headerValue(headers, "precedence")?.trim().toLowerCase();
  if (precedence && ["bulk", "list", "junk", "auto_reply"].includes(precedence)) {
    return true;
  }
  return Boolean(headerValue(headers, "x-autoreply"));
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Last-resort plain text when Resend gives us HTML only. `<blockquote>` is
 * dropped wholesale — in an HTML reply that element *is* the quoted history.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    // Every horizontal run (spaces, tabs, the NBSP that &nbsp; decoded to)
    // collapses to one space; newlines are handled separately below.
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A line that starts a quoted-history block on its own. */
const CUT_LINE: RegExp[] = [
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^_{10,}$/,
  /^on\b.*\bwrote:$/i,
  /^>/,
];

/**
 * Remove the quoted history from a plain-text reply so the inbox shows what
 * the customer actually wrote. Deliberately conservative:
 *
 * - only well-known *structural* markers cut (Gmail's "On … wrote:", Outlook's
 *   original-message divider and its `From:/Sent:/To:` block, a `>` quote run);
 * - signatures are NOT stripped — "quoted reply" means quoted reply, and a
 *   lone `--` in a body is too easy to hit by accident;
 * - if stripping would leave nothing, the original text is returned, because
 *   an empty thread bubble is worse than a quoted one.
 *
 * The untouched original always survives in `bodyHtml` (or the raw email at
 * Resend), so nothing is ever actually lost.
 */
export function stripQuotedReply(text: string | null | undefined): string {
  const source = text?.replace(/\r\n/g, "\n") ?? "";
  if (!source.trim()) return source.trim();

  const lines = source.split("\n");
  let cut = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (CUT_LINE.some((re) => re.test(line))) {
      cut = i;
      break;
    }
    // Gmail wraps a long attribution over two lines: "On <date>, <name>" then
    // "<addr> wrote:". Only treat "On …" as a cut when the continuation
    // actually ends in "wrote:".
    if (/^on\b/i.test(line)) {
      const next = lines[i + 1]?.trim() ?? "";
      if (/\bwrote:$/i.test(next)) {
        cut = i;
        break;
      }
    }
    // Outlook's quoted header block: "From: …" followed within a few lines by
    // another header. A prose sentence starting "From:" has no such follow-up.
    if (/^from:\s*\S/i.test(line)) {
      const follows = lines
        .slice(i + 1, i + 5)
        .some((l) => /^(sent|date|to|cc|subject):\s*\S/i.test(l.trim()));
      if (follows) {
        cut = i;
        break;
      }
    }
  }

  const kept = (cut === -1 ? lines : lines.slice(0, cut))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return kept || source.trim();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/channels/email-format.ts packages/core/src/services/channels/email-format.test.ts
git commit -m "feat(core): pure email shaping — reply tokens, From identity, quoted-reply stripping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 3: `channels/webhook-signature.ts` — Svix/Standard-Webhooks verification

**Files:**
- Create: `packages/core/src/services/channels/webhook-signature.ts`, `packages/core/src/services/channels/webhook-signature.test.ts`

**Why local, and not a library or the SDK.** Resend signs webhooks with the Standard Webhooks scheme (Svix): `HMAC-SHA256(secret, "<id>.<timestamp>.<body>")`, base64, sent as `svix-signature: v1,<sig> [v1,<sig>…]` with `svix-id` and `svix-timestamp`. Three options were checked in the installed tree:

1. **`svix`** — not installed; adding it violates the no-new-dependency rule for ~40 lines of HMAC.
2. **`standardwebhooks` 1.0.0** — present in `node_modules`, but only as a *transitive* dependency of `resend`. Importing it directly would be an undeclared dependency that npm may dedupe away at any time.
3. **`resend.webhooks.verify({ payload, headers, webhookSecret })`** (v6.14, wraps `standardwebhooks`) — real, but it is a method on a `Resend` instance, and `new Resend(key)` **throws** `Missing API key` when `RESEND_API_KEY` is unset. That couples signature checking to the send key, makes the unit test need an env var, and hides the `svix-*` → `webhook-*` header rename.

So verification is implemented here with `node:crypto`, and Step 5 adds an **interop test** that feeds our signature to `resend.webhooks.verify` to prove the two agree byte for byte.

**Interfaces:**
- Produces:
  ```ts
  export const WEBHOOK_TOLERANCE_SECONDS = 300;
  export type SignatureHeaders =
    | Headers
    | Record<string, string | string[] | null | undefined>;
  export interface SignWebhookInput {
    secret: string;
    id: string;
    timestamp: Date | number;
    payload: string;
  }
  export function signWebhookPayload(input: SignWebhookInput): string
  export interface VerifyWebhookInput {
    secret: string;
    payload: string;
    headers: SignatureHeaders;
    now?: Date;
    toleranceSeconds?: number;
  }
  export type WebhookVerification =
    | { ok: true }
    | { ok: false; reason: "no_secret" | "missing_headers" | "bad_timestamp"
        | "timestamp_too_old" | "timestamp_too_new" | "no_matching_signature" };
  export function verifyWebhookSignature(input: VerifyWebhookInput): WebhookVerification
  ```

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/channels/webhook-signature.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from "./webhook-signature";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_2Xk9QmQ1x7pC4bR";
const PAYLOAD = JSON.stringify({ type: "email.received", data: { n: 1 } });
const NOW = new Date("2026-09-08T09:14:02.000Z");

function headersFor(overrides: Record<string, string> = {}, at = NOW) {
  const timestamp = Math.floor(at.getTime() / 1000);
  return {
    "svix-id": ID,
    "svix-timestamp": String(timestamp),
    "svix-signature": signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp,
      payload: PAYLOAD,
    }),
    ...overrides,
  };
}

describe("signWebhookPayload", () => {
  it("is deterministic and versioned", () => {
    const a = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp: NOW,
      payload: PAYLOAD,
    });
    const b = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp: Math.floor(NOW.getTime() / 1000),
      payload: PAYLOAD,
    });
    expect(a).toBe(b);
    expect(a.startsWith("v1,")).toBe(true);
  });

  it("changes with the id, the timestamp, the body and the secret", () => {
    const base = { secret: SECRET, id: ID, timestamp: NOW, payload: PAYLOAD };
    const sig = signWebhookPayload(base);
    expect(signWebhookPayload({ ...base, id: "other" })).not.toBe(sig);
    expect(
      signWebhookPayload({ ...base, timestamp: new Date(NOW.getTime() + 1000) }),
    ).not.toBe(sig);
    expect(signWebhookPayload({ ...base, payload: `${PAYLOAD} ` })).not.toBe(sig);
    expect(
      signWebhookPayload({ ...base, secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==" }),
    ).not.toBe(sig);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor(),
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a Headers object and the webhook-* header aliases", () => {
    const h = headersFor();
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: new Headers(h),
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: {
          "webhook-id": h["svix-id"],
          "webhook-timestamp": h["svix-timestamp"],
          "webhook-signature": h["svix-signature"],
        },
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("accepts one matching signature among several", () => {
    const h = headersFor();
    const many = `v1,ZmFrZQ== ${h["svix-signature"]} v2,ignored`;
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...h, "svix-signature": many },
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a wrong id", () => {
    const h = headersFor();
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: `${PAYLOAD} `,
        headers: h,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "no_matching_signature" });
    expect(
      verifyWebhookSignature({
        secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==",
        payload: PAYLOAD,
        headers: h,
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...h, "svix-id": "msg_other" },
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("rejects missing headers and an unconfigured secret", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: {},
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "missing_headers" });
    expect(
      verifyWebhookSignature({
        secret: "",
        payload: PAYLOAD,
        headers: headersFor(),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "no_secret" });
  });

  it("enforces the five-minute replay window in both directions", () => {
    const stale = new Date(NOW.getTime() - (WEBHOOK_TOLERANCE_SECONDS + 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, stale),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "timestamp_too_old" });

    const future = new Date(NOW.getTime() + (WEBHOOK_TOLERANCE_SECONDS + 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, future),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "timestamp_too_new" });

    const edge = new Date(NOW.getTime() - (WEBHOOK_TOLERANCE_SECONDS - 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, edge),
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...headersFor(), "svix-timestamp": "soon" },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "bad_timestamp" });
  });

  it("interoperates with Resend's own verifier (standardwebhooks)", async () => {
    // Proves the wire format matches byte for byte. `new Resend()` throws
    // without a key even though verify() makes no request, hence the stub.
    const { Resend } = await import("resend");
    const resend = new Resend("re_test_key_not_used_for_verify");
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp,
      payload: PAYLOAD,
    });
    const event = resend.webhooks.verify({
      payload: PAYLOAD,
      headers: { id: ID, timestamp: String(timestamp), signature },
      webhookSecret: SECRET,
    });
    expect(event.type).toBe("email.received");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/webhook-signature.test.ts`
Expected: FAIL — `Failed to load url ./webhook-signature` / cannot find module `./webhook-signature`.

- [ ] **Step 3: Implement**

`packages/core/src/services/channels/webhook-signature.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks (Svix) signature verification — the scheme Resend uses.
 *
 *   signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`))
 *   header    = "v1,<sig>" (space-separated when a secret is being rotated)
 *
 * Implemented here rather than pulled in:
 *   - `svix` is not installed and this is ~40 lines of HMAC;
 *   - `standardwebhooks` exists only as a transitive dep of `resend` and must
 *     not be imported directly (npm may dedupe it away);
 *   - `resend.webhooks.verify` needs a `Resend` instance, and the constructor
 *     throws without RESEND_API_KEY — signature checking must not depend on
 *     the send key. (An interop test proves we agree with it anyway.)
 *
 * The body must be the RAW request text: JSON.parse/stringify round-tripping
 * changes bytes and breaks the signature.
 */

/** Replay window either side of the signed timestamp. Matches Svix's default. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SignatureHeaders =
  | Headers
  | Record<string, string | string[] | null | undefined>;

function readHeader(headers: SignatureHeaders, name: string): string | null {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(
    headers as Record<string, string | string[] | null | undefined>,
  )) {
    if (key.toLowerCase() !== wanted) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

/** Svix's own header names, with the vendor-neutral aliases as a fallback. */
function signatureHeaders(headers: SignatureHeaders): {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
} {
  return {
    id: readHeader(headers, "svix-id") ?? readHeader(headers, "webhook-id"),
    timestamp:
      readHeader(headers, "svix-timestamp") ??
      readHeader(headers, "webhook-timestamp"),
    signature:
      readHeader(headers, "svix-signature") ??
      readHeader(headers, "webhook-signature"),
  };
}

/**
 * Signing secrets are `whsec_<base64>`. The prefix is stripped and the rest
 * base64-decoded — exactly what the reference implementation does, so our
 * signatures match theirs. A secret that is not base64 falls back to its raw
 * bytes rather than silently keying on nothing.
 */
function secretKey(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const decoded = Buffer.from(raw, "base64");
  return decoded.length > 0 ? decoded : Buffer.from(raw, "utf8");
}

export interface SignWebhookInput {
  secret: string;
  id: string;
  timestamp: Date | number;
  payload: string;
}

/** `v1,<base64>` — exported so tests and the local runbook can sign payloads. */
export function signWebhookPayload(input: SignWebhookInput): string {
  const seconds =
    typeof input.timestamp === "number"
      ? Math.floor(input.timestamp)
      : Math.floor(input.timestamp.getTime() / 1000);
  const mac = createHmac("sha256", secretKey(input.secret));
  mac.update(`${input.id}.${seconds}.${input.payload}`, "utf8");
  return `v1,${mac.digest("base64")}`;
}

export interface VerifyWebhookInput {
  secret: string;
  /** The RAW body text, exactly as received. */
  payload: string;
  headers: SignatureHeaders;
  now?: Date;
  toleranceSeconds?: number;
}

export type WebhookVerification =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_secret"
        | "missing_headers"
        | "bad_timestamp"
        | "timestamp_too_old"
        | "timestamp_too_new"
        | "no_matching_signature";
    };

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyWebhookSignature(
  input: VerifyWebhookInput,
): WebhookVerification {
  if (!input.secret) return { ok: false, reason: "no_secret" };

  const { id, timestamp, signature } = signatureHeaders(input.headers);
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing_headers" };
  }

  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds)) return { ok: false, reason: "bad_timestamp" };

  const tolerance = input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS;
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (now - seconds > tolerance) return { ok: false, reason: "timestamp_too_old" };
  if (seconds - now > tolerance) return { ok: false, reason: "timestamp_too_new" };

  const expected = signWebhookPayload({
    secret: input.secret,
    id,
    timestamp: seconds,
    payload: input.payload,
  }).slice("v1,".length);

  for (const candidate of signature.split(" ")) {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) continue;
    if (constantTimeEquals(value, expected)) return { ok: true };
  }
  return { ok: false, reason: "no_matching_signature" };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/webhook-signature.test.ts`
Expected: PASS, including the Resend interop case.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/channels/webhook-signature.ts packages/core/src/services/channels/webhook-signature.test.ts
git commit -m "feat(core): Standard-Webhooks (Svix) signature verification with no new dependency

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 4: Fixtures + `parseResendInbound`

**Files:**
- Create: `packages/core/src/services/channels/__fixtures__/resend-email-received.json`, `packages/core/src/services/channels/__fixtures__/resend-inbound-email.json`, `packages/core/src/services/channels/__fixtures__/resend-inbound-attachments.json`, `packages/core/src/services/channels/email.ts`, `packages/core/src/services/channels/email.test.ts`

**Payload shapes we assume** — taken from the installed `resend@6.14.0` type declarations (`node_modules/resend/dist/index.d.mts`), so the fixtures are the SDK's own contract rather than a guess:

- Webhook body → `EmailReceivedEvent`: `{ type: "email.received", created_at, data: ReceivedEmailEventData }`, where `ReceivedEmailEventData = { email_id, created_at, from, to[], cc[], bcc[], message_id, subject, attachments: { id, filename, content_type, content_disposition, content_id }[] }`. **The event carries no body** — hence the fetch.
- `resend.emails.receiving.get(id)` → `GetReceivingEmailResponseSuccess`: `{ object: "email", id, to[], from, created_at, subject, bcc, cc, reply_to, html, text, headers, message_id, raw?, attachments: InboundAttachment[] }`, where `InboundAttachment = { id, filename, size, content_type, content_id, content_disposition }` (no download URL).
- `resend.emails.receiving.attachments.list({ emailId })` → `{ object: "list", has_more, data: AttachmentData[] }`, where `AttachmentData = { id, filename?, size, content_type, content_disposition, content_id?, download_url, expires_at }`. **This** is where bytes come from — and note `expires_at`: a link-only attachment row goes stale, which `docs/CHANNELS.md` calls out (Task 9).

**Interfaces:**
- Consumes (Phase 1, verbatim — `packages/core/src/services/assets.ts`, `packages/core/src/uploads.ts`):
  ```ts
  export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  export function isInlineableAttachment(mime: string, size: number): boolean
  export interface StoreAttachmentInput {
    mime: string;
    filename?: string | null;
    bytes?: Uint8Array | null;
    url?: string | null;
    messageId?: string | null;
  }
  export function sniffImageMime(buf: Uint8Array): string | null
  ```
- Produces:
  ```ts
  export const MAX_INBOUND_ATTACHMENTS = 20;
  export interface ResendReceivedEvent { type: string; created_at?: string; data: { email_id: string; created_at?: string; from?: string; to?: string[]; cc?: string[] | null; bcc?: string[] | null; subject?: string; message_id?: string; attachments?: { id: string; filename?: string | null; content_type?: string }[] } }
  export interface ResendInboundEmail { /* GetReceivingEmailResponseSuccess subset */ }
  export interface ResendAttachmentLink { /* AttachmentData subset */ }
  export interface ResendInboundDeps {
    getEmail(emailId: string): Promise<ResendInboundEmail>;
    listAttachments(emailId: string): Promise<ResendAttachmentLink[]>;
    download(url: string, maxBytes: number): Promise<Uint8Array | null>;
  }
  export interface ParsedInboundEmail {
    externalId: string; messageId: string | null;
    fromAddress: string; fromName: string | null;
    toAddresses: string[]; ccAddresses: string[];
    subject: string | null; bodyText: string; bodyHtml: string | null;
    threadToken: string | null; receivedAt: Date; autoSubmitted: boolean;
    attachments: StoreAttachmentInput[];
  }
  export function isEmailReceivedEvent(value: unknown): value is ResendReceivedEvent
  export function resendInboundDeps(): ResendInboundDeps
  export async function parseResendInbound(event: ResendReceivedEvent, deps?: ResendInboundDeps): Promise<ParsedInboundEmail>
  ```

- [ ] **Step 1: Write the fixtures**

`packages/core/src/services/channels/__fixtures__/resend-email-received.json` — the webhook body Resend POSTs:

```json
{
  "type": "email.received",
  "created_at": "2026-09-08T09:14:02.117Z",
  "data": {
    "email_id": "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21",
    "created_at": "2026-09-08T09:14:01.902Z",
    "from": "Amy Jones <amy.jones@example.com>",
    "to": ["enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test"],
    "cc": [],
    "bcc": [],
    "message_id": "<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>",
    "subject": "Re: Sleeve idea",
    "attachments": [
      {
        "id": "att_01HZX9Q0000000000000000001",
        "filename": "reference.png",
        "content_type": "image/png",
        "content_disposition": "attachment",
        "content_id": null
      },
      {
        "id": "att_01HZX9Q0000000000000000002",
        "filename": "consent.pdf",
        "content_type": "application/pdf",
        "content_disposition": "attachment",
        "content_id": null
      }
    ]
  }
}
```

`packages/core/src/services/channels/__fixtures__/resend-inbound-email.json` — `GET /emails/receiving/{id}`:

```json
{
  "object": "email",
  "id": "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21",
  "to": ["enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test"],
  "from": "Amy Jones <amy.jones@example.com>",
  "created_at": "2026-09-08T09:14:01.902Z",
  "subject": "Re: Sleeve idea",
  "bcc": null,
  "cc": ["Studio <hello@bootsnbandit.test>"],
  "reply_to": null,
  "html": "<div>Tuesday works for me, reference attached.</div><blockquote class=\"gmail_quote\"><p>On Mon, 7 Sep 2026 at 10:04, Sarah at Boots 'n' Bandit wrote:</p><p>Hi Amy, how about Tuesday?</p></blockquote>",
  "text": "Tuesday works for me, reference attached.\n\nOn Mon, 7 Sep 2026 at 10:04, Sarah at Boots 'n' Bandit <enquiries@mail.bootsnbandit.test> wrote:\n> Hi Amy, how about Tuesday?\n> - Sarah",
  "headers": {
    "Message-ID": "<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>",
    "In-Reply-To": "<0100019255ab@resend.dev>",
    "References": "<0100019255ab@resend.dev>",
    "Content-Type": "multipart/mixed"
  },
  "message_id": "<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>",
  "raw": null,
  "attachments": [
    {
      "id": "att_01HZX9Q0000000000000000001",
      "filename": "reference.png",
      "size": 68,
      "content_type": "image/png",
      "content_id": null,
      "content_disposition": "attachment"
    },
    {
      "id": "att_01HZX9Q0000000000000000002",
      "filename": "consent.pdf",
      "size": 240128,
      "content_type": "application/pdf",
      "content_id": null,
      "content_disposition": "attachment"
    }
  ]
}
```

`packages/core/src/services/channels/__fixtures__/resend-inbound-attachments.json` — `GET /emails/receiving/{id}/attachments`:

```json
{
  "object": "list",
  "has_more": false,
  "data": [
    {
      "id": "att_01HZX9Q0000000000000000001",
      "filename": "reference.png",
      "size": 68,
      "content_type": "image/png",
      "content_disposition": "attachment",
      "download_url": "https://attachments.resend.test/att_01HZX9Q0000000000000000001?sig=abc",
      "expires_at": "2026-09-08T10:14:01.902Z"
    },
    {
      "id": "att_01HZX9Q0000000000000000002",
      "filename": "consent.pdf",
      "size": 240128,
      "content_type": "application/pdf",
      "content_disposition": "attachment",
      "download_url": "https://attachments.resend.test/att_01HZX9Q0000000000000000002?sig=def",
      "expires_at": "2026-09-08T10:14:01.902Z"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`packages/core/src/services/channels/email.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isEmailReceivedEvent,
  parseResendInbound,
  type ResendAttachmentLink,
  type ResendInboundDeps,
  type ResendInboundEmail,
  type ResendReceivedEvent,
} from "./email";

/**
 * parseResendInbound turns a Resend `email.received` event into everything
 * recordInbound needs. The fixtures are the SDK's documented response shapes;
 * the three network calls are injected, so this suite is pure.
 */

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as T;
}

const EVENT = fixture<ResendReceivedEvent>("resend-email-received.json");
const EMAIL = fixture<ResendInboundEmail>("resend-inbound-email.json");
const ATTACHMENTS = fixture<{ data: ResendAttachmentLink[] }>(
  "resend-inbound-attachments.json",
);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const NOT_AN_IMAGE = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20]); // "<svg "

const ORIGINAL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN;

function deps(overrides: Partial<ResendInboundDeps> = {}): ResendInboundDeps {
  return {
    getEmail: vi.fn(async () => structuredClone(EMAIL)),
    listAttachments: vi.fn(async () => structuredClone(ATTACHMENTS.data)),
    download: vi.fn(async () => PNG),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.INBOUND_EMAIL_DOMAIN = "mail.bootsnbandit.test";
});

afterEach(() => {
  if (ORIGINAL_DOMAIN === undefined) delete process.env.INBOUND_EMAIL_DOMAIN;
  else process.env.INBOUND_EMAIL_DOMAIN = ORIGINAL_DOMAIN;
  vi.restoreAllMocks();
});

describe("isEmailReceivedEvent", () => {
  it("accepts the fixture and rejects everything else", () => {
    expect(isEmailReceivedEvent(EVENT)).toBe(true);
    expect(
      isEmailReceivedEvent({ type: "email.delivered", data: { email_id: "x" } }),
    ).toBe(false);
    expect(isEmailReceivedEvent({ type: "email.received", data: {} })).toBe(false);
    expect(isEmailReceivedEvent(null)).toBe(false);
    expect(isEmailReceivedEvent("email.received")).toBe(false);
  });
});

describe("parseResendInbound", () => {
  it("normalises the sender, recipients, subject and timestamps", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.externalId).toBe("9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21");
    expect(parsed.fromAddress).toBe("amy.jones@example.com");
    expect(parsed.fromName).toBe("Amy Jones");
    expect(parsed.toAddresses).toEqual([
      "enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test",
    ]);
    expect(parsed.ccAddresses).toEqual(["hello@bootsnbandit.test"]);
    expect(parsed.subject).toBe("Re: Sleeve idea");
    expect(parsed.messageId).toBe("<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>");
    expect(parsed.receivedAt.toISOString()).toBe("2026-09-08T09:14:01.902Z");
    expect(parsed.autoSubmitted).toBe(false);
  });

  it("reads the thread token off the reply address", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("falls back to the References header when the token is not a recipient", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["hello@bootsnbandit.test"];
    email.cc = null;
    email.headers = {
      References:
        "<0100019255ab@resend.dev> <enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test>",
    };
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("has no token when nothing addresses our domain", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["hello@bootsnbandit.test"];
    email.cc = null;
    email.headers = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBeNull();
  });

  it("strips the quoted history from bodyText but keeps the full html", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.bodyText).toBe("Tuesday works for me, reference attached.");
    expect(parsed.bodyText).not.toContain("wrote:");
    expect(parsed.bodyHtml).toContain("gmail_quote");
  });

  it("derives text from the html when the email is html-only", async () => {
    const email = structuredClone(EMAIL);
    email.text = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyText).toBe("Tuesday works for me, reference attached.");
  });

  it("never leaves an empty body", async () => {
    const email = structuredClone(EMAIL);
    email.text = "   ";
    email.html = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyText).toBe("(no message body)");
  });

  it("flags an auto-reply so the caller can drop it", async () => {
    const email = structuredClone(EMAIL);
    email.headers = { "Auto-Submitted": "auto-replied" };
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.autoSubmitted).toBe(true);
  });

  it("stores an image inline under the SNIFFED mime and links the rest", async () => {
    const download = vi.fn(async () => PNG);
    const parsed = await parseResendInbound(EVENT, deps({ download }));
    expect(parsed.attachments).toHaveLength(2);

    const [image, pdf] = parsed.attachments;
    expect(image.mime).toBe("image/png");
    expect(image.filename).toBe("reference.png");
    expect(image.bytes).toEqual(PNG);
    expect(image.url).toBeUndefined();

    expect(pdf.mime).toBe("application/pdf");
    expect(pdf.bytes).toBeUndefined();
    expect(pdf.url).toBe(
      "https://attachments.resend.test/att_01HZX9Q0000000000000000002?sig=def",
    );
    // Only the image was downloaded — the 240 KB PDF stays a link.
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("trusts the sniff, not the declared type: a lying image becomes a link", async () => {
    const parsed = await parseResendInbound(
      EVENT,
      deps({ download: vi.fn(async () => NOT_AN_IMAGE) }),
    );
    const image = parsed.attachments[0];
    expect(image.bytes).toBeUndefined();
    expect(image.url).toContain("att_01HZX9Q0000000000000000001");
  });

  it("re-labels an image whose declared type is wrong with the sniffed one", async () => {
    const email = structuredClone(EMAIL);
    email.attachments[0].content_type = "image/jpeg";
    const links = structuredClone(ATTACHMENTS.data);
    links[0].content_type = "image/jpeg";
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        getEmail: vi.fn(async () => email),
        listAttachments: vi.fn(async () => links),
      }),
    );
    expect(parsed.attachments[0].mime).toBe("image/png");
  });

  it("links an oversize image instead of downloading it", async () => {
    const email = structuredClone(EMAIL);
    email.attachments[0].size = 9 * 1024 * 1024;
    const download = vi.fn(async () => PNG);
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email), download }),
    );
    expect(download).not.toHaveBeenCalled();
    expect(parsed.attachments[0].bytes).toBeUndefined();
    expect(parsed.attachments[0].url).toContain("att_01HZX9Q");
  });

  it("survives a failed attachment listing and a failed download", async () => {
    const noLinks = await parseResendInbound(
      EVENT,
      deps({
        listAttachments: vi.fn(async () => {
          throw new Error("attachment API down");
        }),
      }),
    );
    // Nothing reachable, so nothing recorded — never a row with neither
    // bytes nor url.
    expect(noLinks.attachments).toEqual([]);

    const noBytes = await parseResendInbound(
      EVENT,
      deps({ download: vi.fn(async () => null) }),
    );
    expect(noBytes.attachments[0].bytes).toBeUndefined();
    expect(noBytes.attachments[0].url).toContain("att_01HZX9Q");
  });

  it("propagates a failed email fetch so the caller records a WebhookFailure", async () => {
    await expect(
      parseResendInbound(
        EVENT,
        deps({
          getEmail: vi.fn(async () => {
            throw new Error("Resend 500");
          }),
        }),
      ),
    ).rejects.toThrow(/Resend 500/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email.test.ts`
Expected: FAIL — `Failed to load url ./email` / cannot find module `./email`.

- [ ] **Step 4: Implement**

`packages/core/src/services/channels/email.ts` (the inbound half; Task 7 appends the outbound half to this same file):

```ts
import { sniffImageMime } from "@bnb/core/uploads";
import {
  isInlineableAttachment,
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
import {
  formatMessageId,
  headerValue,
  htmlToText,
  inboundEmailDomain,
  isAutoSubmitted,
  parseAddress,
  parseAddressList,
  stripQuotedReply,
  threadTokenFrom,
  tokenFromText,
} from "./email-format";

/**
 * The email channel.
 *
 * INBOUND: Resend's `email.received` webhook carries metadata only, so the
 * body and the attachment download URLs are fetched from the API. Everything
 * network-facing sits behind `ResendInboundDeps`, so the parsing rules are
 * testable without a key, a socket or a mock server.
 */

/** Cap on attachments processed per email — a mail bomb must not stall the route. */
export const MAX_INBOUND_ATTACHMENTS = 20;

/** Subset of resend@6's `EmailReceivedEvent` that we rely on. */
export interface ResendReceivedEvent {
  type: string;
  created_at?: string;
  data: {
    email_id: string;
    created_at?: string;
    from?: string;
    to?: string[];
    cc?: string[] | null;
    bcc?: string[] | null;
    subject?: string;
    message_id?: string;
    attachments?: {
      id: string;
      filename?: string | null;
      content_type?: string;
    }[];
  };
}

/** Subset of `GetReceivingEmailResponseSuccess` (GET /emails/receiving/{id}). */
export interface ResendInboundEmail {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string | null;
  cc: string[] | null;
  bcc: string[] | null;
  reply_to: string[] | null;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  message_id: string;
  attachments: {
    id: string;
    filename: string | null;
    size: number;
    content_type: string;
    content_id: string | null;
    content_disposition: string | null;
  }[];
}

/** Subset of `AttachmentData` (GET /emails/receiving/{id}/attachments). */
export interface ResendAttachmentLink {
  id: string;
  filename?: string | null;
  size: number;
  content_type: string;
  content_disposition?: string | null;
  download_url: string;
  expires_at?: string;
}

export interface ResendInboundDeps {
  getEmail(emailId: string): Promise<ResendInboundEmail>;
  listAttachments(emailId: string): Promise<ResendAttachmentLink[]>;
  /** Resolves null when the body is missing, too large or unreadable. */
  download(url: string, maxBytes: number): Promise<Uint8Array | null>;
}

export interface ParsedInboundEmail {
  /** Resend's email id — the idempotency key on EnquiryMessage.externalId. */
  externalId: string;
  /** RFC 5322 Message-ID, angle-wrapped, for our reply's In-Reply-To. */
  messageId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  /** Quoted history removed — what the customer actually wrote. */
  bodyText: string;
  /** The original HTML, untouched. */
  bodyHtml: string | null;
  threadToken: string | null;
  receivedAt: Date;
  autoSubmitted: boolean;
  attachments: StoreAttachmentInput[];
}

export function isEmailReceivedEvent(
  value: unknown,
): value is ResendReceivedEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as { type?: unknown; data?: { email_id?: unknown } };
  return (
    event.type === "email.received" &&
    typeof event.data === "object" &&
    event.data !== null &&
    typeof event.data.email_id === "string" &&
    event.data.email_id.length > 0
  );
}

function requireApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not configured — inbound email cannot be fetched.",
    );
  }
  return key;
}

/** The real network deps. Only ever constructed on the webhook/retry path. */
export function resendInboundDeps(): ResendInboundDeps {
  return {
    async getEmail(emailId) {
      const { Resend } = await import("resend");
      const resend = new Resend(requireApiKey());
      const { data, error } = await resend.emails.receiving.get(emailId);
      if (error || !data) {
        throw new Error(
          `Resend inbound fetch failed for ${emailId}: ${error?.message ?? "no data"}`,
        );
      }
      return data as unknown as ResendInboundEmail;
    },
    async listAttachments(emailId) {
      const { Resend } = await import("resend");
      const resend = new Resend(requireApiKey());
      const { data, error } = await resend.emails.receiving.attachments.list({
        emailId,
      });
      if (error || !data) {
        throw new Error(
          `Resend attachment listing failed for ${emailId}: ${error?.message ?? "no data"}`,
        );
      }
      return data.data as unknown as ResendAttachmentLink[];
    },
    async download(url, maxBytes) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > maxBytes) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return bytes.byteLength > 0 && bytes.byteLength <= maxBytes ? bytes : null;
    },
  };
}

/** `image/png; charset=x` → `image/png`. */
function baseMime(raw: string | null | undefined): string {
  const value = raw?.split(";")[0]?.trim().toLowerCase();
  return value || "application/octet-stream";
}

/**
 * Images become inline rows, everything else a link.
 *
 * The security rule (carried from the Phase-1 review): bytes are stored ONLY
 * when `sniffImageMime` recognises them, and the row records the **sniffed**
 * mime, never the sender's `content_type` — an `image/png` label on an SVG or
 * an HTML payload must not end up served back to staff as an image.
 *
 * A row with neither bytes nor url is unreachable in the inbox, so it is
 * dropped rather than written.
 */
async function collectAttachments(
  email: ResendInboundEmail,
  deps: ResendInboundDeps,
): Promise<StoreAttachmentInput[]> {
  const metas = (email.attachments ?? []).slice(0, MAX_INBOUND_ATTACHMENTS);
  if (metas.length === 0) return [];

  let links: ResendAttachmentLink[] = [];
  try {
    links = await deps.listAttachments(email.id);
  } catch (err) {
    console.error(
      `[email] attachment listing failed for ${email.id} — recording none:`,
      err,
    );
    return [];
  }
  const byId = new Map(links.map((link) => [link.id, link]));

  const out: StoreAttachmentInput[] = [];
  for (const meta of metas) {
    const link = byId.get(meta.id) ?? null;
    const url = link?.download_url ?? null;
    const declared = baseMime(meta.content_type ?? link?.content_type);
    const filename = meta.filename ?? link?.filename ?? null;
    const size = meta.size ?? link?.size ?? 0;

    let bytes: Uint8Array | null = null;
    let mime = declared;
    if (url && isInlineableAttachment(declared, size)) {
      let downloaded: Uint8Array | null = null;
      try {
        downloaded = await deps.download(url, MAX_INLINE_ATTACHMENT_BYTES);
      } catch (err) {
        console.error(`[email] attachment download failed for ${meta.id}:`, err);
      }
      const sniffed = downloaded ? sniffImageMime(downloaded) : null;
      if (downloaded && sniffed) {
        bytes = downloaded;
        mime = sniffed;
      }
    }

    if (bytes) out.push({ mime, filename, bytes });
    else if (url) out.push({ mime: declared, filename, url });
    // else: neither reachable nor storable — skip it entirely.
  }
  return out;
}

export async function parseResendInbound(
  event: ResendReceivedEvent,
  deps: ResendInboundDeps = resendInboundDeps(),
): Promise<ParsedInboundEmail> {
  const email = await deps.getEmail(event.data.email_id);

  const sender = parseAddress(email.from) ?? parseAddress(event.data.from ?? "");
  if (!sender) {
    throw new Error(
      `Inbound email ${email.id} has an unparseable From header: ${email.from}`,
    );
  }

  const toAddresses = parseAddressList(email.to).map((a) => a.address);
  const ccAddresses = parseAddressList(email.cc).map((a) => a.address);

  const domain = inboundEmailDomain();
  // The reply address is authoritative; References is the fallback for
  // clients that rewrite the recipient list on reply.
  const threadToken =
    threadTokenFrom([...toAddresses, ...ccAddresses], domain) ??
    tokenFromText(
      `${headerValue(email.headers, "references") ?? ""} ${
        headerValue(email.headers, "in-reply-to") ?? ""
      }`,
      domain,
    );

  const text = email.text?.trim() ? email.text : htmlToText(email.html);
  const bodyText = stripQuotedReply(text) || "(no message body)";

  const receivedRaw =
    email.created_at ?? event.data.created_at ?? event.created_at;
  const receivedAt = receivedRaw ? new Date(receivedRaw) : new Date();

  return {
    externalId: email.id,
    messageId: formatMessageId(
      email.message_id ??
        headerValue(email.headers, "message-id") ??
        event.data.message_id,
    ),
    fromAddress: sender.address,
    fromName: sender.name,
    toAddresses,
    ccAddresses,
    subject: email.subject?.trim() || null,
    bodyText,
    bodyHtml: email.html,
    threadToken,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    autoSubmitted: isAutoSubmitted(email.headers),
    attachments: await collectAttachments(email, deps),
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/email.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/channels/email.ts packages/core/src/services/channels/email.test.ts packages/core/src/services/channels/__fixtures__
git commit -m "feat(core): parse Resend inbound email — token threading, quoted-reply stripping, sniffed attachments

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 5: `channels/email-inbound.ts` — `ingestResendEvent`

The one inbound orchestration. Both the webhook route (Task 6) and the Channels retry button (Task 8) call exactly this, so a replay from a stored payload behaves identically to the original delivery.

**Files:**
- Create: `packages/core/src/services/channels/email-inbound.ts`, `packages/core/src/services/channels/email-inbound.test.ts`

**Interfaces:**
- Consumes (Phase 1, verbatim):
  ```ts
  // packages/core/src/services/contact-identity.ts
  export async function findOrCreateCustomer(input: FindOrCreateCustomerInput): Promise<Customer>
  export interface FindOrCreateCustomerInput {
    name?: string | null; email?: string | null; phone?: string | null;
    marketingConsent?: boolean; notes?: string | null; tags?: string[];
    identity?: ContactIdentityInput | null;
  }
  // packages/core/src/services/enquiry-threading.ts
  export interface ResolveThreadInput {
    customerId: string; channel: EnquiryChannel; threadToken?: string | null;
    contactName: string; contactEmail?: string | null; contactPhone?: string | null;
    subject?: string | null; preferredArtistId?: string | null; now?: Date;
  }
  export interface ResolvedThread { enquiryId: string; created: boolean }
  export async function resolveThread(input: ResolveThreadInput): Promise<ResolvedThread>
  // packages/core/src/services/enquiry-messages.ts
  export async function recordInbound(input: RecordMessageInput): Promise<ThreadMessageRow>
  ```
  and from Task 4: `isEmailReceivedEvent`, `parseResendInbound`, `ResendInboundDeps`.
- Produces:
  ```ts
  export type IngestOutcome =
    | { status: "recorded"; enquiryId: string; messageId: string; createdEnquiry: boolean }
    | { status: "duplicate"; enquiryId: string; messageId: string }
    | { status: "ignored"; reason: "unsupported_event" | "auto_reply" | "self_addressed" };
  export async function ingestResendEvent(
    event: unknown,
    deps?: ResendInboundDeps,
  ): Promise<IngestOutcome>
  ```

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/channels/email-inbound.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@bnb/core/db";
import { closeTestDb, dbReachable, testDb, uid } from "../testdb";
import { ingestResendEvent } from "./email-inbound";
import type {
  ResendAttachmentLink,
  ResendInboundDeps,
  ResendInboundEmail,
  ResendReceivedEvent,
} from "./email";

/**
 * The full inbound path against the real database: identity resolution,
 * threading by reply token, the message row, its attachments, the status
 * flip and idempotency on a replayed delivery.
 */

const db = () => testDb();

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as T;
}

const BASE_EVENT = fixture<ResendReceivedEvent>("resend-email-received.json");
const BASE_EMAIL = fixture<ResendInboundEmail>("resend-inbound-email.json");
const BASE_LINKS = fixture<{ data: ResendAttachmentLink[] }>(
  "resend-inbound-attachments.json",
);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const DOMAIN = "mail.bootsnbandit.test";
const ORIGINAL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN;

/** An event + matching fetched email, uniquely keyed so runs never collide. */
function scenario(overrides: {
  emailId?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  headers?: Record<string, string> | null;
  attachments?: ResendInboundEmail["attachments"];
}) {
  const emailId = overrides.emailId ?? uid("email");
  const event: ResendReceivedEvent = {
    ...structuredClone(BASE_EVENT),
    data: { ...structuredClone(BASE_EVENT.data), email_id: emailId },
  };
  const email: ResendInboundEmail = {
    ...structuredClone(BASE_EMAIL),
    id: emailId,
    from: overrides.from ?? BASE_EMAIL.from,
    to: overrides.to ?? BASE_EMAIL.to,
    cc: null,
    subject: overrides.subject ?? BASE_EMAIL.subject,
    text: overrides.text ?? BASE_EMAIL.text,
    headers:
      overrides.headers === undefined ? BASE_EMAIL.headers : overrides.headers,
    message_id: `<${emailId}@mail.gmail.com>`,
    attachments: overrides.attachments ?? [],
  };
  const deps: ResendInboundDeps = {
    getEmail: vi.fn(async () => email),
    listAttachments: vi.fn(async () => structuredClone(BASE_LINKS.data)),
    download: vi.fn(async () => PNG),
  };
  return { event, email, deps };
}

describe("ingestResendEvent (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  beforeEach(() => {
    process.env.INBOUND_EMAIL_DOMAIN = DOMAIN;
  });

  afterEach(() => {
    if (ORIGINAL_DOMAIN === undefined) delete process.env.INBOUND_EMAIL_DOMAIN;
    else process.env.INBOUND_EMAIL_DOMAIN = ORIGINAL_DOMAIN;
  });

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("ignores an event that is not email.received", async () => {
    expect(
      await ingestResendEvent({ type: "email.delivered", data: { email_id: "x" } }),
    ).toEqual({ status: "ignored", reason: "unsupported_event" });
    expect(await ingestResendEvent(null)).toEqual({
      status: "ignored",
      reason: "unsupported_event",
    });
  });

  it("creates the customer and a new enquiry when there is no token", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("amy")}@example.com`;
    const { event, deps } = scenario({
      from: `Amy Jones <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      subject: "Sleeve idea",
      text: "Hi, can I book a sleeve?",
    });

    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    expect(outcome.createdEnquiry).toBe(true);
    enquiries.push(outcome.enquiryId);

    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: {
        channel: true,
        source: true,
        status: true,
        subject: true,
        contactName: true,
        contactEmail: true,
        customerId: true,
        lastInboundAt: true,
      },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);
    expect(enquiry.channel).toBe("email");
    expect(enquiry.source).toBe("web");
    expect(enquiry.status).toBe("new");
    expect(enquiry.subject).toBe("Sleeve idea");
    expect(enquiry.contactName).toBe("Amy Jones");
    expect(enquiry.contactEmail).toBe(address);
    expect(enquiry.lastInboundAt).toBeInstanceOf(Date);

    const customer = await db().customer.findUniqueOrThrow({
      where: { id: enquiry.customerId as string },
      select: { email: true, name: true },
    });
    expect(customer.email).toBe(address);
    expect(customer.name).toBe("Amy Jones");

    const message = await db().enquiryMessage.findUniqueOrThrow({
      where: { externalId: event.data.email_id },
      select: {
        direction: true,
        channel: true,
        bodyText: true,
        bodyHtml: true,
        fromAddress: true,
        fromName: true,
        subject: true,
        messageIdHeader: true,
        enquiryId: true,
      },
    });
    expect(message.direction).toBe("inbound");
    expect(message.channel).toBe("email");
    expect(message.enquiryId).toBe(outcome.enquiryId);
    expect(message.bodyText).toBe("Hi, can I book a sleeve?");
    expect(message.bodyHtml).toBeTruthy();
    expect(message.fromAddress).toBe(address);
    expect(message.fromName).toBe("Amy Jones");
    expect(message.messageIdHeader).toBe(`<${event.data.email_id}@mail.gmail.com>`);
  });

  it("threads onto the token's enquiry and flips replied → customer_replied", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("bea")}@example.com`;
    const customer = await db().customer.create({
      data: { name: "Bea Existing", email: address },
    });
    customers.push(customer.id);
    const enquiry = await db().enquiry.create({
      data: {
        customerId: customer.id,
        contactName: "Bea Existing",
        contactEmail: address,
        channel: "email",
        status: "replied",
      },
      select: { id: true, threadToken: true },
    });
    enquiries.push(enquiry.id);

    const { event, deps } = scenario({
      from: `Bea Existing <${address}>`,
      to: [`enq-${enquiry.threadToken}@${DOMAIN}`],
      text: "Tuesday suits, thanks!",
    });
    const outcome = await ingestResendEvent(event, deps);
    expect(outcome).toMatchObject({
      status: "recorded",
      enquiryId: enquiry.id,
      createdEnquiry: false,
    });

    const after = await db().enquiry.findUniqueOrThrow({
      where: { id: enquiry.id },
      select: { status: true, lastInboundAt: true },
    });
    expect(after.status).toBe("customer_replied");
    expect(after.lastInboundAt).toBeInstanceOf(Date);
    expect(await db().enquiry.count({ where: { customerId: customer.id } })).toBe(1);
  });

  it("is idempotent on a replayed delivery", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("cass")}@example.com`;
    const { event, deps } = scenario({
      from: `Cass <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      text: "First and only",
    });

    const first = await ingestResendEvent(event, deps);
    expect(first.status).toBe("recorded");
    if (first.status !== "recorded") return;
    enquiries.push(first.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: first.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    const second = await ingestResendEvent(event, deps);
    expect(second).toEqual({
      status: "duplicate",
      enquiryId: first.enquiryId,
      messageId: first.messageId,
    });
    // The replay must not re-fetch, and must not duplicate the row.
    expect(deps.getEmail).toHaveBeenCalledTimes(1);
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: first.enquiryId } }),
    ).toBe(1);
  });

  it("stores a sniffed image inline and a non-image as a link", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("dee")}@example.com`;
    const { event, deps } = scenario({
      from: `Dee <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      attachments: structuredClone(BASE_EMAIL.attachments),
    });
    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    const rows = await db().attachment.findMany({
      where: { messageId: outcome.messageId },
      orderBy: { createdAt: "asc" },
      select: { mime: true, size: true, filename: true, url: true, bytes: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].mime).toBe("image/png");
    expect(rows[0].bytes).not.toBeNull();
    expect(rows[0].size).toBe(PNG.byteLength);
    expect(rows[1].mime).toBe("application/pdf");
    expect(rows[1].bytes).toBeNull();
    expect(rows[1].url).toContain("att_01HZX9Q0000000000000000002");
  });

  it("drops auto-replies and mail from our own inbound domain", async () => {
    if (!(await dbReachable())) return;
    const auto = scenario({
      from: `Robot <${uid("robot")}@example.com>`,
      to: [`hello@${DOMAIN}`],
      headers: { "Auto-Submitted": "auto-replied" },
    });
    expect(await ingestResendEvent(auto.event, auto.deps)).toEqual({
      status: "ignored",
      reason: "auto_reply",
    });

    const loop = scenario({
      from: `Studio <enquiries@${DOMAIN}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
    });
    expect(await ingestResendEvent(loop.event, loop.deps)).toEqual({
      status: "ignored",
      reason: "self_addressed",
    });

    expect(
      await prisma.enquiryMessage.count({
        where: { externalId: { in: [auto.event.data.email_id, loop.event.data.email_id] } },
      }),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-inbound.test.ts`
Expected: FAIL — `Failed to load url ./email-inbound` / cannot find module `./email-inbound`.

- [ ] **Step 3: Implement**

`packages/core/src/services/channels/email-inbound.ts`:

```ts
import { prisma } from "@bnb/core/db";
import { findOrCreateCustomer } from "../contact-identity";
import { recordInbound } from "../enquiry-messages";
import { resolveThread } from "../enquiry-threading";
import {
  isEmailReceivedEvent,
  parseResendInbound,
  type ResendInboundDeps,
} from "./email";
import { inboundEmailDomain } from "./email-format";

/**
 * The single inbound-email orchestration: fetch → parse → identity → thread →
 * message. The webhook route and the Studio › Channels retry button both call
 * exactly this, so replaying a stored payload behaves identically to the
 * original delivery.
 *
 * Idempotency is enforced twice: a fast lookup on `EnquiryMessage.externalId`
 * before any network call (a replay must not re-hit the Resend API), and
 * `recordInbound`'s own unique-constraint handling for a genuine race.
 *
 * Errors are NOT swallowed here — the caller turns them into a WebhookFailure
 * row so the failure is visible and replayable.
 */

export type IngestOutcome =
  | {
      status: "recorded";
      enquiryId: string;
      messageId: string;
      createdEnquiry: boolean;
    }
  | { status: "duplicate"; enquiryId: string; messageId: string }
  | {
      status: "ignored";
      reason: "unsupported_event" | "auto_reply" | "self_addressed";
    };

export async function ingestResendEvent(
  event: unknown,
  deps?: ResendInboundDeps,
): Promise<IngestOutcome> {
  if (!isEmailReceivedEvent(event)) {
    return { status: "ignored", reason: "unsupported_event" };
  }

  const externalId = event.data.email_id;
  const existing = await prisma.enquiryMessage.findUnique({
    where: { externalId },
    select: { id: true, enquiryId: true },
  });
  if (existing) {
    return {
      status: "duplicate",
      enquiryId: existing.enquiryId,
      messageId: existing.id,
    };
  }

  const parsed = deps
    ? await parseResendInbound(event, deps)
    : await parseResendInbound(event);

  // An out-of-office or a bounce is not the customer talking to us: recording
  // it would flip a thread to `customer_replied` and badge the inbox.
  if (parsed.autoSubmitted) return { status: "ignored", reason: "auto_reply" };

  // Anything from our own send domain is our own mail coming back (a loop, a
  // forward, a mailer-daemon). Never thread it as customer traffic.
  const domain = inboundEmailDomain();
  if (domain && parsed.fromAddress.endsWith(`@${domain}`)) {
    return { status: "ignored", reason: "self_addressed" };
  }

  const customer = await findOrCreateCustomer({
    email: parsed.fromAddress,
    name: parsed.fromName,
  });

  const thread = await resolveThread({
    customerId: customer.id,
    channel: "email",
    threadToken: parsed.threadToken,
    contactName: parsed.fromName ?? customer.name,
    contactEmail: parsed.fromAddress,
    contactPhone: customer.phone,
    subject: parsed.subject,
    now: parsed.receivedAt,
  });

  const row = await recordInbound({
    enquiryId: thread.enquiryId,
    customerId: customer.id,
    channel: "email",
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    subject: parsed.subject,
    fromName: parsed.fromName,
    fromAddress: parsed.fromAddress,
    externalId: parsed.externalId,
    messageIdHeader: parsed.messageId,
    attachments: parsed.attachments,
    at: parsed.receivedAt,
  });

  return {
    status: "recorded",
    enquiryId: thread.enquiryId,
    messageId: row.id,
    createdEnquiry: thread.created,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
docker compose up -d
npm test -w @bnb/core -- src/services/channels/email-inbound.test.ts
```
Expected: PASS. (Without Postgres the DB cases return early and only the `unsupported_event` case asserts — bring the container up so this task is actually verified.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/channels/email-inbound.ts packages/core/src/services/channels/email-inbound.test.ts
git commit -m "feat(core): ingest Resend inbound email onto the enquiry thread, idempotently

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 6: `POST /api/webhooks/resend`

**Files:**
- Create: `apps/admin/src/app/api/webhooks/resend/route.ts`, `apps/admin/src/app/api/webhooks/resend/route.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature` (T3), `ingestResendEvent` / `IngestOutcome` (T5), `recordWebhookFailure` (T1), and `json` / `jsonError` from `@bnb/core/http`:
  ```ts
  export function json(data: unknown, status = 200): Response
  export function jsonError(status: number, error: string): Response
  ```
- Produces:
  ```ts
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  export async function POST(req: Request): Promise<Response>
  ```
- Status contract: `503` unconfigured secret · `401` bad/absent signature · `200` everything else (including processing failures, which also write a `WebhookFailure` row).

- [ ] **Step 1: Write the failing test**

`apps/admin/src/app/api/webhooks/resend/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signWebhookPayload } from "@bnb/core/services/channels/webhook-signature";

/**
 * The inbound webhook is unauthenticated but signature-verified, and must
 * never answer 5xx for a processing failure — Resend retries on 5xx, and a
 * broken event would storm the endpoint. Failures become a WebhookFailure row
 * plus a 200.
 */

const ingestResendEvent = vi.fn();
const recordWebhookFailure = vi.fn();

vi.mock("@bnb/core/services/channels/email-inbound", () => ({
  ingestResendEvent: (...a: unknown[]) => ingestResendEvent(...a),
}));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  recordWebhookFailure: (...a: unknown[]) => recordWebhookFailure(...a),
}));

import { POST } from "./route";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ORIGINAL = process.env.RESEND_WEBHOOK_SECRET;
const EVENT = {
  type: "email.received",
  data: { email_id: "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21" },
};

function signedRequest(
  body: unknown,
  opts: { secret?: string; id?: string; at?: Date; signBody?: string } = {},
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const id = opts.id ?? "msg_2Xk9QmQ1x7pC4bR";
  const timestamp = Math.floor((opts.at ?? new Date()).getTime() / 1000);
  const signature = signWebhookPayload({
    secret: opts.secret ?? SECRET,
    id,
    timestamp,
    payload: opts.signBody ?? payload,
  });
  return new Request("http://admin.test/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": signature,
    },
    body: payload,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  ingestResendEvent.mockResolvedValue({
    status: "recorded",
    enquiryId: "e1",
    messageId: "m1",
    createdEnquiry: false,
  });
  recordWebhookFailure.mockResolvedValue("wf1");
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL;
});

describe("POST /api/webhooks/resend", () => {
  it("processes a correctly signed event and reports the outcome", async () => {
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body).toMatchObject({ ok: true, status: "recorded" });
    expect(ingestResendEvent).toHaveBeenCalledWith(EVENT);
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("503s when the signing secret is not configured, without processing", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(503);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("401s an unsigned request", async () => {
    const res = await POST(
      new Request("http://admin.test/api/webhooks/resend", {
        method: "POST",
        body: JSON.stringify(EVENT),
      }),
    );
    expect(res.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("401s a wrongly signed request and a tampered body", async () => {
    const wrongSecret = await POST(
      signedRequest(EVENT, { secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==" }),
    );
    expect(wrongSecret.status).toBe(401);

    const tampered = await POST(
      signedRequest(EVENT, { signBody: JSON.stringify({ type: "other" }) }),
    );
    expect(tampered.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("401s a replayed request outside the tolerance window", async () => {
    const res = await POST(
      signedRequest(EVENT, { at: new Date(Date.now() - 10 * 60_000) }),
    );
    expect(res.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("200s with a WebhookFailure row when processing throws", async () => {
    ingestResendEvent.mockRejectedValue(new Error("Resend 500"));
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: false,
      status: "failed",
    });
    expect(recordWebhookFailure).toHaveBeenCalledWith({
      provider: "resend",
      externalId: "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21",
      payload: EVENT,
      error: "Resend 500",
    });
  });

  it("200s with a WebhookFailure row when the signed body is not JSON", async () => {
    const res = await POST(signedRequest("not json at all"));
    expect(res.status).toBe(200);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "resend", error: expect.stringMatching(/json/i) }),
    );
  });

  it("still answers 200 when even the failure write fails", async () => {
    ingestResendEvent.mockRejectedValue(new Error("boom"));
    recordWebhookFailure.mockRejectedValue(new Error("db down"));
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
  });

  it("reports an ignored event without recording a failure", async () => {
    ingestResendEvent.mockResolvedValue({
      status: "ignored",
      reason: "auto_reply",
    });
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: true,
      status: "ignored",
      reason: "auto_reply",
    });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/admin -- src/app/api/webhooks/resend/route.test.ts`
Expected: FAIL — `Failed to load url ./route` (the route file does not exist).

- [ ] **Step 3: Implement**

`apps/admin/src/app/api/webhooks/resend/route.ts`:

```ts
import { json, jsonError } from "@bnb/core/http";
import { ingestResendEvent } from "@bnb/core/services/channels/email-inbound";
import { verifyWebhookSignature } from "@bnb/core/services/channels/webhook-signature";
import { recordWebhookFailure } from "@bnb/core/services/webhook-failures";

/**
 * POST /api/webhooks/resend — inbound email.
 *
 * Unauthenticated but verified, exactly like /api/cron/run: the caller proves
 * itself with a Standard-Webhooks (Svix) signature over the RAW body, checked
 * against `RESEND_WEBHOOK_SECRET`. Unsigned or wrongly signed requests get a
 * 401 and are never processed; there is no rate limit because there is no
 * unsigned work to do.
 *
 * Everything past verification answers **200**, even on failure. Resend
 * retries 5xx, so returning one for a broken event storms this endpoint with
 * the same broken event; instead the whole event is written to
 * `WebhookFailure` and Studio › Channels offers a replay.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Best-effort id for the failure row, so the panel can name the email. */
function externalIdOf(event: unknown): string | null {
  const id = (event as { data?: { email_id?: unknown } } | null)?.data?.email_id;
  return typeof id === "string" ? id : null;
}

/** Never lets a failed audit write turn into a 500. */
async function noteFailure(input: {
  externalId: string | null;
  payload: unknown;
  error: string;
}): Promise<void> {
  try {
    await recordWebhookFailure({
      provider: "resend",
      externalId: input.externalId,
      payload: input.payload,
      error: input.error,
    });
  } catch (err) {
    console.error("[webhooks/resend] could not record the failure:", err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return jsonError(503, "RESEND_WEBHOOK_SECRET is not configured");
  }

  // The raw text, not req.json(): re-serialising changes bytes and breaks
  // the signature.
  const raw = await req.text();
  const verified = verifyWebhookSignature({
    secret,
    payload: raw,
    headers: req.headers,
  });
  if (!verified.ok) {
    console.warn(`[webhooks/resend] rejected a delivery: ${verified.reason}`);
    return jsonError(401, "Invalid signature");
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    await noteFailure({
      externalId: null,
      payload: { raw: raw.slice(0, 4000) },
      error: "Malformed JSON body on a correctly signed request",
    });
    return json({ ok: false, status: "failed" }, 200);
  }

  try {
    const outcome = await ingestResendEvent(event);
    return json({ ok: true, ...outcome }, 200);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/resend] processing failed:", err);
    await noteFailure({ externalId: externalIdOf(event), payload: event, error });
    return json({ ok: false, status: "failed" }, 200);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -w @bnb/admin -- src/app/api/webhooks/resend/route.test.ts`
Expected: PASS (all nine cases).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api/webhooks/resend
git commit -m "feat(admin): signed Resend inbound webhook — verify, ingest, never 5xx

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 7: Outbound identity — `sendEnquiryEmail` and the reply channel

**Files:**
- Modify: `packages/core/src/email/index.ts`, `packages/core/src/email/index.test.ts`, `packages/core/src/services/channels/email.ts`, `packages/core/src/services/channels/email.test.ts`, `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`, `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`, `apps/admin/src/app/(staff)/enquiries/actions.ts`, `apps/admin/src/app/(staff)/enquiries/actions.test.ts`

**Interfaces:**
- Consumes (Phase 1, verbatim — `packages/core/src/email/index.ts`):
  ```ts
  export interface SendEmailInput {
    to: string; type: EmailType; customerId?: string | null;
    relatedBookingId?: string | null; enquiryId?: string | null;
    authorUserId?: string | null; data: Record<string, unknown>;
  }
  export interface SendEmailResult { id: string; status: "sent" | "skipped" | "failed" }
  export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult>
  ```
  `sendEmail` already writes the `MessageLog` row **and** mirrors the send onto the thread with `recordOutbound({ ..., authorUserId, externalId: providerId })`, so `sendEnquiryEmail` reuses all of it rather than duplicating it. The `staff_reply` template and `renderEmail` are untouched — the subject still comes from `data.subject`.
- Produces:
  ```ts
  // packages/core/src/email/index.ts — SendEmailInput gains:
  from?: string | null;
  replyTo?: string | null;
  headers?: Record<string, string> | null;

  // packages/core/src/services/channels/email.ts
  export interface EnquiryEmailContext {
    enquiryId: string; threadToken: string; customerId: string | null;
    contactName: string; contactEmail: string | null; subject: string | null;
    artistName: string | null;
    lastInboundChannel: MessageChannelKind | null;
    lastInboundMessageId: string | null;
    lastInboundSubject: string | null;
  }
  export async function loadEnquiryEmailContext(enquiryId: string): Promise<EnquiryEmailContext | null>
  export interface SendEnquiryEmailInput {
    context: EnquiryEmailContext; body: string;
    authorUserId: string; authorDisplayName?: string | null;
  }
  export async function sendEnquiryEmail(input: SendEnquiryEmailInput): Promise<SendEmailResult>

  // apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts
  export type ReplyChannel = "email" | "none";
  export function chooseReplyChannel(input: {
    lastInboundChannel: MessageChannelKind | null;
    hasEmail: boolean;
  }): ReplyChannel
  ```

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/email/index.test.ts`. That file already hoists `const resendSend = vi.hoisted(() => vi.fn(async () => ({ data: { id: "re_123" }, error: null })));` and mocks `resend` with `Resend: class { emails = { send: resendSend }; }`, plus `@bnb/core/db` (`createMock`) and `@bnb/core/services/enquiry-messages` (`recordOutbound`) — this block reuses `resendSend` and adds nothing new:

```ts
describe("sendEmail — enquiry reply identity", () => {
  const savedKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
  });

  it("passes a custom From, Reply-To and threading headers to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail } = await import("./index");
    await sendEmail({
      to: "amy@example.com",
      type: "staff_reply",
      from: `"Sarah at Boots 'n' Bandit" <enquiries@mail.test>`,
      replyTo: "enq-tok123456@mail.test",
      headers: { "In-Reply-To": "<abc@x>", References: "<abc@x>" },
      data: { customerName: "Amy", body: "Tuesday works", subject: "Re: Sleeve" },
    });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: `"Sarah at Boots 'n' Bandit" <enquiries@mail.test>`,
        to: "amy@example.com",
        replyTo: "enq-tok123456@mail.test",
        headers: { "In-Reply-To": "<abc@x>", References: "<abc@x>" },
        subject: "Re: Sleeve",
      }),
    );
  });

  it("keeps the default studio From and sends no empty header bag", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendEmail } = await import("./index");
    await sendEmail({
      to: "amy@example.com",
      type: "aftercare",
      data: { customerName: "Amy" },
    });
    const payload = resendSend.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    // Not hard-coded: a developer .env may set EMAIL_FROM, and the point of
    // this case is that transactional mail keeps whatever that default is.
    expect(payload.from).toBe(
      process.env.EMAIL_FROM ?? "Boots 'n' Bandit <hello@bootsnbandit.co.uk>",
    );
    expect(payload).not.toHaveProperty("replyTo");
    expect(payload).not.toHaveProperty("headers");
  });
});
```

Append to `packages/core/src/services/channels/email.test.ts` (the outbound half — it mocks `@bnb/core/email` and `@bnb/core/db`, so add these mocks at the TOP of that file, above the existing imports):

```ts
const sendEmail = vi.fn();
const findUnique = vi.fn();
vi.mock("@bnb/core/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: { enquiry: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
```

and this describe block at the end of the file:

```ts
describe("loadEnquiryEmailContext", () => {
  it("flattens the enquiry, its artist and its last inbound message", async () => {
    const { loadEnquiryEmailContext } = await import("./email");
    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy Jones",
      contactEmail: "amy@example.com",
      subject: "Sleeve idea",
      preferredArtist: { name: "Sarah North" },
      messages: [
        {
          channel: "email",
          subject: "Re: Sleeve idea",
          messageIdHeader: "<abc@x.test>",
        },
      ],
    });
    expect(await loadEnquiryEmailContext("e1")).toEqual({
      enquiryId: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy Jones",
      contactEmail: "amy@example.com",
      subject: "Sleeve idea",
      artistName: "Sarah North",
      lastInboundChannel: "email",
      lastInboundMessageId: "<abc@x.test>",
      lastInboundSubject: "Re: Sleeve idea",
    });
  });

  it("nulls the last-inbound fields when the thread has none, and 404s cleanly", async () => {
    const { loadEnquiryEmailContext } = await import("./email");
    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: null,
      contactName: "Amy",
      contactEmail: null,
      subject: null,
      preferredArtist: null,
      messages: [],
    });
    const ctx = await loadEnquiryEmailContext("e1");
    expect(ctx?.artistName).toBeNull();
    expect(ctx?.lastInboundChannel).toBeNull();
    expect(ctx?.lastInboundMessageId).toBeNull();

    findUnique.mockResolvedValue(null);
    expect(await loadEnquiryEmailContext("gone")).toBeNull();
  });
});

describe("sendEnquiryEmail", () => {
  const CONTEXT = {
    enquiryId: "e1",
    threadToken: "tok123456",
    customerId: "c1",
    contactName: "Amy Jones",
    contactEmail: "amy@example.com",
    subject: "Sleeve idea",
    artistName: "Sarah North",
    lastInboundChannel: "email" as const,
    lastInboundMessageId: "<abc@x.test>",
    lastInboundSubject: "Re: Sleeve idea",
  };

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue({ id: "m1", status: "sent" });
  });

  it("sends as the artist from the studio address, with the reply token", async () => {
    const { sendEnquiryEmail } = await import("./email");
    const result = await sendEnquiryEmail({
      context: CONTEXT,
      body: "Tuesday works",
      authorUserId: "u1",
      authorDisplayName: "Owner Olive",
    });
    expect(result).toEqual({ id: "m1", status: "sent" });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      enquiryId: "e1",
      authorUserId: "u1",
      from: `"Sarah at Boots 'n' Bandit" <enquiries@mail.bootsnbandit.test>`,
      replyTo: "enq-tok123456@mail.bootsnbandit.test",
      headers: { "In-Reply-To": "<abc@x.test>", References: "<abc@x.test>" },
      data: {
        customerName: "Amy Jones",
        body: "Tuesday works",
        subject: "Re: Sleeve idea",
      },
    });
  });

  it("falls back to the replying staff member's name when no artist is assigned", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({
      context: { ...CONTEXT, artistName: null },
      body: "Hi",
      authorUserId: "u1",
      authorDisplayName: "Olive Boots",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: `"Olive at Boots 'n' Bandit" <enquiries@mail.bootsnbandit.test>`,
      }),
    );
  });

  it("omits the threading headers when there is no inbound message id", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({
      context: { ...CONTEXT, lastInboundMessageId: null, lastInboundSubject: null },
      body: "Hi",
      authorUserId: "u1",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: undefined,
        data: expect.objectContaining({ subject: "Re: Sleeve idea" }),
      }),
    );
  });

  it("falls back to the plain studio identity when no inbound domain is set", async () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({ context: CONTEXT, body: "Hi", authorUserId: "u1" });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ from: null, replyTo: null }),
    );
  });

  it("refuses to send to an enquiry with no email address", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await expect(
      sendEnquiryEmail({
        context: { ...CONTEXT, contactEmail: null },
        body: "Hi",
        authorUserId: "u1",
      }),
    ).rejects.toThrow(/no email address/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
```

Append to `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`:

```ts
describe("chooseReplyChannel", () => {
  it("replies by email whenever there is an address, whatever came in last", () => {
    for (const lastInboundChannel of [
      "email",
      "web",
      "note",
      "messenger",
      "instagram",
      null,
    ] as const) {
      expect(chooseReplyChannel({ lastInboundChannel, hasEmail: true })).toBe(
        "email",
      );
    }
  });

  it("has no reachable channel without an address", () => {
    expect(
      chooseReplyChannel({ lastInboundChannel: "email", hasEmail: false }),
    ).toBe("none");
    expect(chooseReplyChannel({ lastInboundChannel: null, hasEmail: false })).toBe(
      "none",
    );
  });
});
```
(add `chooseReplyChannel` to that file's existing import from `./enquiry-helpers`.)

Rewrite these cases in `apps/admin/src/app/(staff)/enquiries/actions.test.ts` — the reply path now goes through `sendEnquiryEmail`, and a customer with no reachable channel gets an internal note instead of a log-only "reply":

1. Add to the mock block, after the `@bnb/core/email` mock:
```ts
vi.mock("@bnb/core/services/channels/email", () => ({
  loadEnquiryEmailContext: vi.fn(),
  sendEnquiryEmail: vi.fn(),
}));
```
2. Add to the imports:
```ts
const { loadEnquiryEmailContext, sendEnquiryEmail } = await import(
  "@bnb/core/services/channels/email"
);

const CONTEXT = {
  enquiryId: "e1",
  threadToken: "tok123456",
  customerId: "c1",
  contactName: "Amy",
  contactEmail: "amy@example.com",
  subject: "Sleeve idea",
  artistName: "Sarah North",
  lastInboundChannel: "email" as const,
  lastInboundMessageId: "<abc@x.test>",
  lastInboundSubject: "Re: Sleeve idea",
};
```
3. Extend `beforeEach`:
```ts
  vi.mocked(loadEnquiryEmailContext).mockResolvedValue(CONTEXT);
  vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "m1", status: "sent" });
```
4. Replace the four `sendEmail`-based cases in `describe("replyToEnquiry")`:
```ts
  it("sends via sendEnquiryEmail with the enquiry's context and marks replied", async () => {
    const res = await replyToEnquiry("e1", { message: "Hi Amy, yes we can!" });
    expect(res.ok).toBe(true);
    expect(sendEnquiryEmail).toHaveBeenCalledWith({
      context: CONTEXT,
      body: "Hi Amy, yes we can!",
      authorUserId: "u1",
      authorDisplayName: "Owner",
    });
    // sendEmail writes the MessageLog itself — no double-logging here.
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("reports a log-only outcome when email delivery is not configured", async () => {
    vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "m1", status: "skipped" });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/logged/i);
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("saves an internal note when the customer has no reachable channel", async () => {
    vi.mocked(loadEnquiryEmailContext).mockResolvedValue({
      ...CONTEXT,
      contactEmail: null,
    });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/no reachable channel/i);
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: expect.stringContaining("Hello"),
    });
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: expect.stringContaining("Not sent"),
    });
    // Nothing was sent, so the enquiry is not "replied".
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("surfaces a failed send and does not mark the enquiry replied", async () => {
    vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "m1", status: "failed" });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/failed/i);
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("rejects an empty reply without loading or sending anything", async () => {
    const res = await replyToEnquiry("e1", { message: "   " });
    expect(res.ok).toBe(false);
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });
```
   and in the RBAC case, swap `expect(sendEmail).not.toHaveBeenCalled()` for `expect(sendEnquiryEmail).not.toHaveBeenCalled()`.
5. In `describe("reply threading, notes, read markers and close authorisation")`, replace the two thread cases:
```ts
  it("threads the reply onto the enquiry via sendEnquiryEmail", async () => {
    await replyToEnquiry("e1", { message: "Tuesday works!" });
    expect(sendEnquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ enquiryId: "e1" }),
      }),
    );
  });

  it("records an internal note when there is no email to send to", async () => {
    vi.mocked(loadEnquiryEmailContext).mockResolvedValue({
      ...CONTEXT,
      contactEmail: null,
    });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(recordOutbound).not.toHaveBeenCalled();
    expect(recordNote).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npm test -w @bnb/core -- src/email/index.test.ts src/services/channels/email.test.ts
```
Expected: FAIL — `resendSend` called without `replyTo`/`headers`; `loadEnquiryEmailContext`/`sendEnquiryEmail` are not exported from `./email`.

```bash
npm test -w @bnb/admin -- "src/app/(staff)/enquiries"
```
Expected: FAIL — `chooseReplyChannel` is not exported; `Cannot find module '@bnb/core/services/channels/email'` mocks resolve but `replyToEnquiry` still calls `sendEmail`.

- [ ] **Step 3: Extend `sendEmail`**

In `packages/core/src/email/index.ts`, add to `SendEmailInput` after `authorUserId`:

```ts
  /**
   * Overrides the default studio From. Enquiry replies use it to put the
   * artist's name on the studio address (spec decision 6); everything
   * transactional leaves it unset.
   */
  from?: string | null;
  /** Reply-To — the per-enquiry inbound token address. */
  replyTo?: string | null;
  /** Extra RFC headers (In-Reply-To / References for mail-client threading). */
  headers?: Record<string, string> | null;
```

and replace the `resend.emails.send({...})` call with:

```ts
      const { data, error } = await resend.emails.send({
        from: input.from?.trim() || FROM_ADDRESS,
        to: input.to,
        subject,
        html,
        // Only send the optional fields when they carry something: an empty
        // `headers: {}` is noise in the API log and in every test assertion.
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.headers && Object.keys(input.headers).length > 0
          ? { headers: input.headers }
          : {}),
      });
```

Nothing else in `sendEmail` changes: the MessageLog write, the `recordOutbound` mirror, `authorUserId` attribution and the `externalId: providerId` idempotency key all stay exactly as Phase 1 left them.

- [ ] **Step 4: Add the outbound half of `channels/email.ts`**

Append to `packages/core/src/services/channels/email.ts`, and extend its import block with:

```ts
import type { MessageChannelKind } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail, type SendEmailResult } from "@bnb/core/email";
import {
  firstName,
  formatFromHeader,
  fromDisplayName,
  outboundAddressFor,
  replyAddressFor,
  replySubject,
} from "./email-format";
```
(`formatMessageId`, `inboundEmailDomain`, `headerValue` etc. are already imported by the inbound half — merge, do not duplicate.)

```ts
/**
 * OUTBOUND: everything a staff reply needs, flattened in one query.
 *
 * `messageIdHeader` is deliberately selected here rather than carried on
 * `ThreadMessageRow` — no render path needs it, and the inbox pulls hundreds
 * of rows per page.
 */
export interface EnquiryEmailContext {
  enquiryId: string;
  threadToken: string;
  customerId: string | null;
  contactName: string;
  contactEmail: string | null;
  subject: string | null;
  /** The assigned artist, whose first name goes on the From line. */
  artistName: string | null;
  lastInboundChannel: MessageChannelKind | null;
  /** RFC Message-ID of the last inbound message, for In-Reply-To. */
  lastInboundMessageId: string | null;
  lastInboundSubject: string | null;
}

export async function loadEnquiryEmailContext(
  enquiryId: string,
): Promise<EnquiryEmailContext | null> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      threadToken: true,
      customerId: true,
      contactName: true,
      contactEmail: true,
      subject: true,
      preferredArtist: { select: { name: true } },
      messages: {
        where: { direction: "inbound" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { channel: true, subject: true, messageIdHeader: true },
      },
    },
  });
  if (!enquiry) return null;

  const last = enquiry.messages[0] ?? null;
  return {
    enquiryId: enquiry.id,
    threadToken: enquiry.threadToken,
    customerId: enquiry.customerId,
    contactName: enquiry.contactName,
    contactEmail: enquiry.contactEmail,
    subject: enquiry.subject,
    artistName: enquiry.preferredArtist?.name ?? null,
    lastInboundChannel: last?.channel ?? null,
    lastInboundMessageId: last?.messageIdHeader ?? null,
    lastInboundSubject: last?.subject ?? null,
  };
}

export interface SendEnquiryEmailInput {
  context: EnquiryEmailContext;
  body: string;
  authorUserId: string;
  /** Used for the From name when no artist is assigned yet. */
  authorDisplayName?: string | null;
}

/**
 * The studio reply, wearing the artist's name (spec decision 6):
 *
 *   From:     "Sarah at Boots 'n' Bandit" <enquiries@mail.example.com>
 *   Reply-To: enq-<threadToken>@mail.example.com
 *   In-Reply-To/References: the last inbound Message-ID
 *
 * The Reply-To token is what makes the round trip work — the customer's reply
 * comes back addressed to the enquiry, so the inbound webhook threads it with
 * no guessing. Sending is delegated to `sendEmail`, which keeps the MessageLog
 * row, the outbound `EnquiryMessage` and the `authorUserId` attribution.
 *
 * With no `INBOUND_EMAIL_DOMAIN` configured there is nowhere for a reply to
 * land, so the send falls back to the plain `EMAIL_FROM` identity with no
 * Reply-To rather than advertising an address that does not exist.
 */
export async function sendEnquiryEmail(
  input: SendEnquiryEmailInput,
): Promise<SendEmailResult> {
  const { context } = input;
  if (!context.contactEmail) {
    throw new Error(
      `sendEnquiryEmail: enquiry ${context.enquiryId} has no email address`,
    );
  }

  const domain = inboundEmailDomain();
  if (!domain) {
    console.warn(
      "[email] INBOUND_EMAIL_DOMAIN is not set — replying from the default studio address with no reply token.",
    );
  }

  const name = firstName(context.artistName) ?? firstName(input.authorDisplayName);
  const from = domain
    ? formatFromHeader(fromDisplayName(name), outboundAddressFor(domain))
    : null;
  const replyTo = domain ? replyAddressFor(context.threadToken, domain) : null;

  const inReplyTo = formatMessageId(context.lastInboundMessageId);
  const headers = inReplyTo
    ? { "In-Reply-To": inReplyTo, References: inReplyTo }
    : undefined;

  return sendEmail({
    to: context.contactEmail,
    type: "staff_reply",
    customerId: context.customerId,
    enquiryId: context.enquiryId,
    authorUserId: input.authorUserId,
    from,
    replyTo,
    headers,
    data: {
      customerName: context.contactName,
      body: input.body,
      subject: replySubject(context.lastInboundSubject ?? context.subject),
    },
  });
}
```

- [ ] **Step 5: Add `chooseReplyChannel`**

In `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`, add `MessageChannelKind` to the `@prisma/client` type import and append:

```ts
export type ReplyChannel = "email" | "none";

/**
 * Which channel a staff reply goes out on. The spec's rule is "the channel of
 * the last inbound message"; in Phase 2 the only outbound channel that exists
 * is email, so every thread with an address on file replies by email and one
 * without has no reachable channel at all (the action saves an internal note
 * instead of pretending to send).
 *
 * Phase 3 adds the Meta branch here: `messenger`/`instagram` last-inbound with
 * a live ChannelConnection replies on that channel, falling back to email.
 */
export function chooseReplyChannel(input: {
  lastInboundChannel: MessageChannelKind | null;
  hasEmail: boolean;
}): ReplyChannel {
  return input.hasEmail ? "email" : "none";
}
```

- [ ] **Step 6: Rewrite `replyToEnquiry`**

In `apps/admin/src/app/(staff)/enquiries/actions.ts`, replace the `sendEmail` import with:

```ts
import {
  loadEnquiryEmailContext,
  sendEnquiryEmail,
} from "@bnb/core/services/channels/email";
```
and add `chooseReplyChannel` to the `./enquiry-helpers` import. Delete the now-unused `sendEmail` import. Replace the whole `replyToEnquiry` body with:

```ts
export async function replyToEnquiry(
  enquiryId: string,
  input: { message: string },
): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  const valid = validateReply(input);
  if (!valid.ok) return { ok: false, message: valid.error };

  const context = await loadEnquiryEmailContext(enquiryId);
  if (!context) return { ok: false, message: "That enquiry no longer exists." };

  const channel = chooseReplyChannel({
    lastInboundChannel: context.lastInboundChannel,
    hasEmail: Boolean(context.contactEmail),
  });

  if (channel === "none") {
    // Nothing to send on: keep the words on the thread as a staff note rather
    // than logging a "reply" the customer will never receive, and leave the
    // status alone — the enquiry has not actually been replied to.
    await recordNote({
      enquiryId,
      authorUserId: user.id,
      bodyText: `${valid.message}\n\n— Not sent: this customer has no reachable channel (no email address on file).`,
    });
    const claim = await claimIfUnassigned(user, enquiry);
    revalidatePath("/enquiries");
    return {
      ok: true,
      message: withClaimNote(
        "No reachable channel — saved as an internal note (nothing was sent).",
        claim,
      ),
    };
  }

  // sendEnquiryEmail delegates to sendEmail, which writes the MessageLog row
  // and the outbound thread message itself — no extra logging here.
  const result = await sendEnquiryEmail({
    context,
    body: valid.message,
    authorUserId: user.id,
    authorDisplayName: user.displayName,
  });
  if (result.status === "failed") {
    return {
      ok: false,
      message: "The reply email failed to send — check the email integration.",
    };
  }

  await updateEnquiryStatus(enquiryId, "replied");
  const claim = await claimIfUnassigned(user, enquiry);
  revalidatePath("/enquiries");
  return {
    ok: true,
    message: withClaimNote(
      result.status === "sent"
        ? "Reply emailed to the customer and enquiry marked replied."
        : "Reply logged (email delivery not configured) and enquiry marked replied.",
      claim,
    ),
  };
}
```

`recordOutbound` is no longer called directly by this module — remove it from the `@bnb/core/services/enquiry-messages` import if nothing else in the file uses it (the actions test still mocks it, which is harmless and keeps the "no direct outbound write" assertion honest).

- [ ] **Step 7: Run everything green**

```bash
npm test -w @bnb/core -- src/email/index.test.ts src/services/channels/email.test.ts
npm test -w @bnb/admin -- "src/app/(staff)/enquiries"
npm test -w @bnb/core && npm test -w @bnb/admin
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/email/index.ts packages/core/src/email/index.test.ts packages/core/src/services/channels/email.ts packages/core/src/services/channels/email.test.ts "apps/admin/src/app/(staff)/enquiries"
git commit -m "feat(enquiries): reply as the artist from the studio address with a per-enquiry Reply-To token

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 8: Studio › Channels panel (email) + retry

**Files:**
- Create: `apps/admin/src/app/(staff)/studio/channels/page.tsx`, `apps/admin/src/app/(staff)/studio/channels/page.test.tsx`, `apps/admin/src/app/(staff)/studio/channels/actions.ts`, `apps/admin/src/app/(staff)/studio/channels/actions.test.ts`
- Modify: `apps/admin/src/app/(staff)/studio/page.tsx`, `apps/admin/src/app/(staff)/studio/page.test.tsx`

The panel follows `studio/integrations/page.tsx` exactly: a server component, `await requireRole("OWNER")`, `export const dynamic = "force-dynamic"`, `CheckCircle2` / `XCircle` status rows in `rounded-lg border border-border-default bg-bg-card` sections. The retry button is a plain `<form action={…}>` posting to a `"use server"` FormData action, matching `studio/_lib/actions.ts` — no client component is needed.

**Interfaces:**
- Consumes: `listRecentWebhookFailures`, `countOpenWebhookFailures`, `getWebhookFailure`, `markWebhookFailureRetried`, `setWebhookFailureError`, `WEBHOOK_FAILURE_WINDOW_DAYS` (T1); `ingestResendEvent` (T5); `inboundEmailDomain`, `replyAddressFor`, `outboundAddressFor` (T2); `requireRole` and `prisma`.
- Produces:
  ```ts
  // channels/actions.ts
  export async function retryWebhookFailureAction(fd: FormData): Promise<void>
  // channels/page.tsx
  export const dynamic = "force-dynamic";
  export default async function ChannelsPage(): Promise<React.ReactElement>
  ```

- [ ] **Step 1: Write the failing tests**

`apps/admin/src/app/(staff)/studio/channels/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retrying a stored webhook failure replays the exact event through the same
 * ingest path the live webhook uses. Owner-only, and never throws out of the
 * server action — a second failure is written back onto the row instead.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  getWebhookFailure: vi.fn(),
  markWebhookFailureRetried: vi.fn(),
  setWebhookFailureError: vi.fn(),
}));
vi.mock("@bnb/core/services/channels/email-inbound", () => ({
  ingestResendEvent: vi.fn(),
}));

const { requireRole } = await import("@bnb/core/auth");
const {
  getWebhookFailure,
  markWebhookFailureRetried,
  setWebhookFailureError,
} = await import("@bnb/core/services/webhook-failures");
const { ingestResendEvent } = await import(
  "@bnb/core/services/channels/email-inbound"
);
const { retryWebhookFailureAction } = await import("./actions");

const EVENT = { type: "email.received", data: { email_id: "abc" } };

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    email: "o@x",
    role: "OWNER",
    displayName: "Owner",
  } as never);
  vi.mocked(getWebhookFailure).mockResolvedValue({
    id: "wf1",
    provider: "resend",
    payload: EVENT,
  });
  vi.mocked(ingestResendEvent).mockResolvedValue({
    status: "recorded",
    enquiryId: "e1",
    messageId: "m1",
    createdEnquiry: false,
  });
});

describe("retryWebhookFailureAction", () => {
  it("requires an owner", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    await expect(retryWebhookFailureAction(form("wf1"))).rejects.toThrow();
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("replays the stored payload and marks the row retried", async () => {
    await retryWebhookFailureAction(form("wf1"));
    expect(ingestResendEvent).toHaveBeenCalledWith(EVENT);
    expect(markWebhookFailureRetried).toHaveBeenCalledWith("wf1");
    expect(setWebhookFailureError).not.toHaveBeenCalled();
  });

  it("records the new error and leaves the row open when the replay fails", async () => {
    vi.mocked(ingestResendEvent).mockRejectedValue(new Error("still broken"));
    await expect(retryWebhookFailureAction(form("wf1"))).resolves.toBeUndefined();
    expect(setWebhookFailureError).toHaveBeenCalledWith("wf1", "still broken");
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
  });

  it("does nothing for a missing row, a missing id or a foreign provider", async () => {
    await retryWebhookFailureAction(new FormData());
    vi.mocked(getWebhookFailure).mockResolvedValue(null);
    await retryWebhookFailureAction(form("gone"));
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf2",
      provider: "meta",
      payload: EVENT,
    });
    await retryWebhookFailureAction(form("wf2"));
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });
});
```

`apps/admin/src/app/(staff)/studio/channels/page.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("./actions", () => ({ retryWebhookFailureAction: vi.fn() }));

const findFirst = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: { enquiryMessage: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

const listRecentWebhookFailures = vi.fn();
const countOpenWebhookFailures = vi.fn();
vi.mock("@bnb/core/services/webhook-failures", () => ({
  WEBHOOK_FAILURE_WINDOW_DAYS: 7,
  listRecentWebhookFailures: (...a: unknown[]) =>
    listRecentWebhookFailures(...a),
  countOpenWebhookFailures: (...a: unknown[]) => countOpenWebhookFailures(...a),
}));

const ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INBOUND_EMAIL_DOMAIN = "mail.bootsnbandit.test";
  process.env.RESEND_WEBHOOK_SECRET = "whsec_x";
  process.env.RESEND_API_KEY = "re_x";
  process.env.APP_ORIGIN = "https://admin.bootsnbandit.test";
  findFirst.mockResolvedValue({
    createdAt: new Date("2026-09-08T09:14:01.902Z"),
  });
  listRecentWebhookFailures.mockResolvedValue([]);
  countOpenWebhookFailures.mockResolvedValue(0);
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("ChannelsPage", () => {
  it("shows the inbound address pattern, the webhook URL and a healthy config", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Channels");
    expect(html).toContain("enq-&lt;token&gt;@mail.bootsnbandit.test");
    expect(html).toContain("enquiries@mail.bootsnbandit.test");
    expect(html).toContain(
      "https://admin.bootsnbandit.test/api/webhooks/resend",
    );
    expect(html).toContain("No failed events");
    expect(html).toContain("8 September 2026");
  });

  it("flags missing configuration instead of pretending email works", async () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    delete process.env.RESEND_WEBHOOK_SECRET;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("INBOUND_EMAIL_DOMAIN");
    expect(html).toContain("RESEND_WEBHOOK_SECRET");
    expect(html).toContain("Not set");
  });

  it("lists failed events with a retry button", async () => {
    countOpenWebhookFailures.mockResolvedValue(2);
    listRecentWebhookFailures.mockResolvedValue([
      {
        id: "wf1",
        provider: "resend",
        externalId: "9f1c2f7a",
        error: "Resend 500",
        createdAt: new Date("2026-09-08T09:20:00.000Z"),
        retriedAt: null,
      },
      {
        id: "wf2",
        provider: "resend",
        externalId: null,
        error: "Malformed JSON body",
        createdAt: new Date("2026-09-07T09:20:00.000Z"),
        retriedAt: new Date("2026-09-07T10:00:00.000Z"),
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("2 failed events");
    expect(html).toContain("Resend 500");
    expect(html).toContain("9f1c2f7a");
    expect(html).toContain('value="wf1"');
    expect(html).toContain("Retry");
    expect(html).toContain("Retried");
  });

  it("says so when no inbound email has ever arrived", async () => {
    findFirst.mockResolvedValue(null);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Nothing received yet");
  });
});
```

Add to `apps/admin/src/app/(staff)/studio/page.test.tsx`, inside the existing `it(...)`:

```tsx
    expect(html).toContain("/studio/channels");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio"`
Expected: FAIL — `Failed to load url ./actions` / `./page` under `studio/channels`, and the hub test cannot find `/studio/channels`.

- [ ] **Step 3: Implement the action**

`apps/admin/src/app/(staff)/studio/channels/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { ingestResendEvent } from "@bnb/core/services/channels/email-inbound";
import {
  getWebhookFailure,
  markWebhookFailureRetried,
  setWebhookFailureError,
} from "@bnb/core/services/webhook-failures";

/**
 * Owner-gated replay of a stored inbound webhook event.
 *
 * The retry runs the SAME `ingestResendEvent` the live webhook runs, so a
 * replay behaves identically to the original delivery (including its
 * idempotency check — replaying an event that did land is a no-op).
 *
 * It never throws on a failed replay: the fresh error is written back onto
 * the row so the panel shows what happened this time, rather than dumping the
 * owner into an error boundary.
 */

const CHANNELS_PATH = "/studio/channels";

export async function retryWebhookFailureAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;

  const row = await getWebhookFailure(id);
  // Phase 3 adds a "meta" branch here; today only Resend events are replayable.
  if (!row || row.provider !== "resend") return;

  try {
    await ingestResendEvent(row.payload);
    await markWebhookFailureRetried(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[channels] retry of ${id} failed again:`, err);
    await setWebhookFailureError(id, message);
  }
  revalidatePath(CHANNELS_PATH);
}
```

- [ ] **Step 4: Implement the page**

`apps/admin/src/app/(staff)/studio/channels/page.tsx`:

```tsx
import { AlertTriangle, CheckCircle2, Mail, Inbox, XCircle } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  inboundEmailDomain,
  outboundAddressFor,
} from "@bnb/core/services/channels/email-format";
import {
  countOpenWebhookFailures,
  listRecentWebhookFailures,
  WEBHOOK_FAILURE_WINDOW_DAYS,
} from "@bnb/core/services/webhook-failures";
import { retryWebhookFailureAction } from "./actions";

/**
 * Studio › Channels (owner-only). The operational view of the email channel:
 * what address customers reach us on, whether the two secrets are actually
 * configured, when we last received anything, and which inbound events failed
 * — with a one-click replay. Meta channels join this page in Phase 3.
 *
 * Setup steps live in docs/CHANNELS.md; this page only reports state.
 */
export const dynamic = "force-dynamic";

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-bb-teal" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-bb-gold" />
      )}
      <span className="text-text-secondary">{children}</span>
    </span>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export default async function ChannelsPage() {
  await requireRole("OWNER");

  const domain = inboundEmailDomain();
  const secretSet = Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim());
  const apiKeySet = Boolean(process.env.RESEND_API_KEY?.trim());
  const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const webhookUrl = `${origin || "https://<admin-origin>"}/api/webhooks/resend`;

  const [lastInbound, failures, openFailures] = await Promise.all([
    prisma.enquiryMessage.findFirst({
      where: { direction: "inbound", channel: "email" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    listRecentWebhookFailures({ provider: "resend" }),
    countOpenWebhookFailures({ provider: "resend" }),
  ]);

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Channels
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        How customers reach the inbox, and whether it is working. Setup steps
        are in <code>docs/CHANNELS.md</code>.
      </p>

      <section className="mb-8 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Mail className="h-4 w-4" /> Email (Resend)
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-text-muted">Inbound address</dt>
          <dd className="text-text-secondary">
            {domain ? (
              <code className="break-all">{`enq-<token>@${domain}`}</code>
            ) : (
              <span className="text-text-muted">
                Not set — every reply lands nowhere.
              </span>
            )}
          </dd>

          <dt className="text-text-muted">Replies sent from</dt>
          <dd className="text-text-secondary">
            {domain ? (
              <code className="break-all">{outboundAddressFor(domain)}</code>
            ) : (
              <span className="text-text-muted">
                The default studio address (no reply token).
              </span>
            )}
          </dd>

          <dt className="text-text-muted">Webhook URL</dt>
          <dd className="text-text-secondary">
            <code className="break-all">{webhookUrl}</code>
          </dd>

          <dt className="text-text-muted">Last inbound email</dt>
          <dd className="text-text-secondary">
            {lastInbound ? (
              DATE.format(lastInbound.createdAt)
            ) : (
              <span className="text-text-muted">Nothing received yet.</span>
            )}
          </dd>
        </dl>

        <ul className="mt-4 space-y-2 border-t border-border-default pt-4">
          <li>
            <Status ok={Boolean(domain)}>
              <code>INBOUND_EMAIL_DOMAIN</code>{" "}
              {domain ? `= ${domain}` : "— Not set"}
            </Status>
          </li>
          <li>
            <Status ok={secretSet}>
              <code>RESEND_WEBHOOK_SECRET</code>{" "}
              {secretSet
                ? "— set (inbound deliveries are verified)"
                : "— Not set; the webhook answers 503"}
            </Status>
          </li>
          <li>
            <Status ok={apiKeySet}>
              <code>RESEND_API_KEY</code>{" "}
              {apiKeySet
                ? "— set (inbound bodies and outbound sends work)"
                : "— Not set; inbound bodies cannot be fetched"}
            </Status>
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Inbox className="h-4 w-4" /> Failed events
        </h2>
        <p className="mb-3 flex items-center gap-2 text-sm">
          {openFailures > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 text-bb-gold" />
              <span className="text-text-secondary">
                {openFailures} failed events in the last{" "}
                {WEBHOOK_FAILURE_WINDOW_DAYS} days — fix the cause, then retry.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-bb-teal" />
              <span className="text-text-secondary">
                No failed events in the last {WEBHOOK_FAILURE_WINDOW_DAYS} days.
              </span>
            </>
          )}
        </p>

        {failures.length > 0 ? (
          <ul className="divide-y divide-border-default">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-text-secondary">{f.error}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {DATE.format(f.createdAt)}
                    {f.externalId ? ` · ${f.externalId}` : ""}
                    {f.retriedAt ? ` · Retried ${DATE.format(f.retriedAt)}` : ""}
                  </span>
                </span>
                <form action={retryWebhookFailureAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md border border-border-default px-3 text-sm text-text-secondary transition-colors hover:border-bb-crimson/50"
                  >
                    Retry
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Link it from the studio hub**

In `apps/admin/src/app/(staff)/studio/page.tsx`, add `Inbox` to the `lucide-react` import and this entry to `SECTIONS`, after the Integrations entry:

```tsx
  {
    href: "/studio/channels",
    label: "Channels",
    desc: "Inbound email address, webhook status and failed events.",
    icon: Inbox,
  },
```

- [ ] **Step 6: Run tests, commit**

```bash
npm test -w @bnb/admin -- "src/app/(staff)/studio"
npm test -w @bnb/admin
```
Expected: PASS.

```bash
git add "apps/admin/src/app/(staff)/studio"
git commit -m "feat(admin): Studio Channels panel — inbound address, config status, failed events with retry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 9: Runbook + deploy configuration

**Files:**
- Create: `docs/CHANNELS.md`
- Modify: `.env.production.example`, `docker-compose.prod.yml`, `docs/DEPLOY.md`

- [ ] **Step 1: Write `docs/CHANNELS.md`**

```markdown
# Channels — inbound and outbound email

The enquiry inbox is two-way on email: replies from customers land back on the
same enquiry thread, and staff replies go out wearing the assigned artist's
name. This is the setup and operations runbook. The live status view is
**Studio › Channels** (owner-only) in the admin app.

Facebook Messenger and Instagram are Phase 3 and are not covered here.

## How it works

1. A staff reply is sent by Resend as
   `"Sarah at Boots 'n' Bandit" <enquiries@<INBOUND_EMAIL_DOMAIN>>` with
   `Reply-To: enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>` and the `In-Reply-To` /
   `References` of the last inbound message.
2. The customer hits reply. Their mail client uses the Reply-To, so the message
   arrives addressed to that enquiry's own token.
3. Resend receives it (the domain's MX points at Resend) and POSTs an
   `email.received` event to `https://<admin-origin>/api/webhooks/resend`,
   signed with `RESEND_WEBHOOK_SECRET`.
4. Admin verifies the signature, fetches the full email from the Resend API,
   strips the quoted history, resolves the customer and the enquiry from the
   token, and records an inbound message with its attachments.

An email that arrives **without** a token (someone mailing the studio address
directly) still lands: the sender's address resolves to a customer, and the
Phase-1 threading rule attaches it to their most recent open enquiry from the
last 30 days, or opens a new one.

## One-time setup

### 1. Choose the domain

Use a dedicated subdomain, not the apex — `mail.bootsnbandit.co.uk`. Its MX
record points at Resend, which you do not want to do to the domain that
receives your normal business mail.

### 2. Verify the domain in Resend

1. Resend dashboard → **Domains** → **Add Domain** → enter the subdomain,
   pick the region closest to the studio (`eu-west-1`).
2. Enable **Receiving** for the domain (the capability that adds the inbound
   MX record).
3. Add every DNS record Resend lists at your DNS provider:
   - **DKIM** (CNAME or TXT) — outbound signing.
   - **SPF** (TXT, and an MX for the return path) — outbound.
   - **Receiving** (MX, priority 10) — this is the inbound one. Without it,
     replies bounce.
4. Wait for the dashboard to show the domain **verified** and receiving
   **enabled**. DNS propagation is usually minutes, occasionally hours.

### 3. Create the webhook

1. Resend dashboard → **Webhooks** → **Add Webhook**.
2. Endpoint: `https://<admin-origin>/api/webhooks/resend`
   (Studio › Channels prints the exact URL for the deployed environment.)
3. Events: **`email.received`** only. The delivery/bounce events are not
   consumed and would just create noise.
4. Copy the **signing secret** (`whsec_…`). It is shown once.

### 4. Set the secrets

In Coolify, on the compose resource's Environment Variables (admin only — the
web and reception apps neither receive nor send enquiry mail):

| Var | Value |
| --- | --- |
| `INBOUND_EMAIL_DOMAIN` | the verified subdomain, e.g. `mail.bootsnbandit.co.uk` (no `@`, no scheme) |
| `RESEND_WEBHOOK_SECRET` | the `whsec_…` signing secret from step 3 |

`RESEND_API_KEY` must also be set: inbound bodies and attachments are fetched
from the Resend API with it, so inbound email does not work without it.

Redeploy, then open **Studio › Channels** and confirm all three rows are green.

### 5. Smoke test

1. From a personal mailbox, send a message to
   `enq-anything@<INBOUND_EMAIL_DOMAIN>` — no such token exists, so it should
   create a **new** enquiry from your address.
2. Open it in the admin inbox and reply. Check the received mail shows the
   artist's name on the From line and a `enq-<token>@…` Reply-To.
3. Reply from your mail client. Within seconds the same enquiry should show
   your reply as an inbound bubble and flip to **Customer replied**.
4. Attach a photo and repeat: the image renders inline in the thread; a PDF
   shows as a download link.

## Operations

### Failed events

Studio › Channels lists inbound events that were correctly signed but could
not be processed (a Resend API blip, a database error). The endpoint always
answers `200` for these — returning `5xx` makes Resend retry the same broken
event in a loop — and stores the whole event so it can be replayed.

**Retry** replays the stored event through exactly the same code path as a live
delivery, and is safe to press repeatedly: processing is idempotent on the
Resend email id, so an event that did land is a no-op.

If a retry fails again, the row keeps the newest error message. Common causes:

| Error | Cause |
| --- | --- |
| `RESEND_API_KEY is not configured` | the key is missing on the admin service |
| `Resend inbound fetch failed …` | the API key lacks access, or Resend was down |
| `has an unparseable From header` | genuinely malformed mail; nothing to do |
| `Malformed JSON body …` | a signed request whose body was not JSON — report it |

### What is deliberately dropped

- **Auto-replies and bulk mail** (`Auto-Submitted`, `Precedence: bulk`,
  `X-Autoreply`) — an out-of-office is not the customer replying, and would
  otherwise flip the thread to *Customer replied* and badge the inbox.
- **Mail from our own send domain** — loops, forwards and mailer-daemons.
- **Anything but `email.received`** — other event types are ignored, not failed.

### Attachments

Images up to 8 MB are copied into Postgres and served by the staff-gated
`/api/attachments/[id]`; the stored mime is the one sniffed from the actual
bytes, never the sender's declared `Content-Type`. Everything else (and any
image that fails the sniff) is stored as a **link to Resend's download URL**,
which **expires** — an old thread's PDF link will eventually 404. Anything that
must be kept should be downloaded and attached to the booking at the time.

### Rotating the signing secret

Create a second webhook endpoint in Resend pointing at the same URL, set
`RESEND_WEBHOOK_SECRET` to the new secret, redeploy, confirm inbound still
arrives, then delete the old endpoint. (Resend can send both signatures during
an overlap; the verifier accepts any matching `v1,` entry in the header.)

### Testing the endpoint by hand

Signed requests only. From a checkout with the secret to hand:

```bash
SECRET='whsec_…'
BODY='{"type":"email.received","data":{"email_id":"<a real Resend email id>"}}'
node -e '
const {createHmac}=require("node:crypto");
const [secret,body]=process.argv.slice(1);
const id="msg_manual", ts=Math.floor(Date.now()/1000);
const key=Buffer.from(secret.replace(/^whsec_/,""),"base64");
const sig=createHmac("sha256",key).update(`${id}.${ts}.${body}`).digest("base64");
console.log(`${id} ${ts} v1,${sig}`);
' "$SECRET" "$BODY"
# → paste the three values into:
curl -i -X POST https://<admin-origin>/api/webhooks/resend \
  -H 'content-type: application/json' \
  -H 'svix-id: msg_manual' -H 'svix-timestamp: <ts>' -H 'svix-signature: v1,<sig>' \
  -d "$BODY"
```

Expected: `200` with `{"ok":true,"status":"recorded"|"duplicate"|"ignored",…}`.
`401` means the signature, the secret or the clock is wrong (the timestamp
tolerance is five minutes). `503` means `RESEND_WEBHOOK_SECRET` is unset.

## Local development

Inbound needs a public URL, so either point a tunnel (`cloudflared`, `ngrok`)
at `http://localhost:3001` and register that as a second Resend webhook, or
skip inbound locally and exercise `ingestResendEvent` through its test suite.
Outbound works locally with `RESEND_API_KEY` unset — sends are logged, not
delivered, and still appear on the thread.
```

- [ ] **Step 2: Add the two vars to the deploy configuration**

In `.env.production.example`, after the `RESEND_API_KEY` / `EMAIL_FROM` block:

```bash
# Inbound + outbound enquiry email (admin only). INBOUND_EMAIL_DOMAIN is the
# subdomain whose MX points at Resend — it is both the address customers reply
# to (enq-<token>@<domain>) and the domain replies are sent from
# (enquiries@<domain>). RESEND_WEBHOOK_SECRET is the whsec_… signing secret of
# the Resend `email.received` webhook. Both are optional: without them the
# inbound webhook answers 503 and replies fall back to EMAIL_FROM with no
# reply token. Full setup: docs/CHANNELS.md.
INBOUND_EMAIL_DOMAIN=""
RESEND_WEBHOOK_SECRET=""
```

In `docker-compose.prod.yml`, in the **admin** service's `environment` block
only (web and reception neither send nor receive enquiry mail), after
`EMAIL_FROM`:

```yaml
      INBOUND_EMAIL_DOMAIN: ${INBOUND_EMAIL_DOMAIN:-}
      RESEND_WEBHOOK_SECRET: ${RESEND_WEBHOOK_SECRET:-}
```

Both use the `:-` default so an existing deployment keeps booting without them.

In `docs/DEPLOY.md`, add to the constraints list in step 3 (**Environment
variables**), after the `BRAVE_SEARCH_KEY` bullet:

```markdown
   - `INBOUND_EMAIL_DOMAIN` / `RESEND_WEBHOOK_SECRET` (optional, admin only) —
     the two-way email channel. Without them the enquiry inbox still sends
     (from `EMAIL_FROM`) but cannot receive: `/api/webhooks/resend` answers
     503 and replies carry no reply token. Setup, DNS records and the smoke
     test are in `docs/CHANNELS.md`; live status is in Studio › Channels.
```

and to the **Operational notes** list at the end:

```markdown
- Inbound email (`POST /api/webhooks/resend`) answers 200 for processing
  failures on purpose — Resend retries 5xx, which would storm the endpoint
  with the same broken event. Failures are stored and replayable from
  Studio › Channels.
```

- [ ] **Step 3: Full verification**

```bash
npm test -w @bnb/core
npm test -w @bnb/admin
npm test -w @bnb/web
npm run lint
npx tsc --noEmit -p apps/admin && npx tsc --noEmit -p apps/web && npx tsc --noEmit -p apps/reception
npm run build -w @bnb/admin && npm run build -w @bnb/web
npx prettier --check "packages/core/src/**" "apps/admin/src/app/(staff)/**" "apps/admin/src/app/api/webhooks/**" docs/superpowers docs/CHANNELS.md
```
All green; fix formatting with `npx prettier --write <paths>` if needed.

Manual pass (`npm run dev:admin`, sign in with `npm run admin:link` if needed) —
inbound needs a tunnel, so with none configured verify at least:
1. **Studio › Channels** renders, shows the inbound address pattern for your
   local `INBOUND_EMAIL_DOMAIN` (set it in `.env` to try), and reports
   `RESEND_WEBHOOK_SECRET` as not set.
2. Reply to an enquiry with `RESEND_API_KEY` unset: the toast says the reply was
   logged, the thread shows an outbound bubble, the status becomes Replied.
3. Reply to an enquiry whose customer has no email: the toast says "No
   reachable channel", the thread shows a muted internal note containing the
   message and "Not sent", and the status does **not** change.
4. `curl` the webhook without a signature → `401`; with `RESEND_WEBHOOK_SECRET`
   unset → `503`.

- [ ] **Step 4: Commit**

```bash
git add docs/CHANNELS.md docs/DEPLOY.md .env.production.example docker-compose.prod.yml
git commit -m "docs(channels): Resend inbound runbook, deploy vars for the email channel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

## Build log entry (append to `docs/PROJECT-BRIEF.md` after the last entry)

```
## Enquiries omnichannel — Phase 2: email channel (2026-09-07) — DONE
Email is now two-way. A signed Resend `email.received` webhook (`POST /api/webhooks/resend`, admin) verifies a Standard-Webhooks/Svix signature against `RESEND_WEBHOOK_SECRET` with a locally-implemented HMAC-SHA256 verifier (no new dependency), fetches the full email through `resend.emails.receiving`, strips the quoted history, resolves the customer and thread from the `enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>` reply address (References as a fallback), and records an inbound `EnquiryMessage` — idempotent on the Resend email id, dropping auto-replies and our own mail. Image attachments up to 8 MB are stored inline under their SNIFFED mime (`sniffImageMime`), everything else as a link. Staff replies go out via `sendEnquiryEmail` from `"<Artist> at Boots 'n' Bandit" <enquiries@<domain>>` with the per-enquiry Reply-To and `In-Reply-To`/`References` of the last inbound message (`EnquiryMessage.messageIdHeader`, new); `sendEmail` gained `from`/`replyTo`/`headers` so the MessageLog + thread + attribution machinery is reused. `replyToEnquiry` picks the channel of the last inbound message and, with nothing reachable, saves an internal note instead of a fake send. Processing failures never 5xx: they land in the new `WebhookFailure` table and are replayable from the owner-only **Studio › Channels** panel, which also shows the inbound address, the config status and the last inbound time. Runbook: `docs/CHANNELS.md`. Meta channels are Phase 3. Spec: `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md`.
```

Commit with the standard trailer, staging only `docs/PROJECT-BRIEF.md`.

---

## Self-review notes

**Spec coverage (Phasing → phase 2: "Resend inbound webhook, outbound identity + Reply-To token, attachments, Channels panel (email part), runbook")**

| Spec item | Where | Task |
| --- | --- | --- |
| `channels/email.ts` — `parseResendInbound(payload)` → normalised inbound message (§2) | `packages/core/src/services/channels/email.ts` | 4 |
| …"+ attachment fetch via Resend API" (§2) | `collectAttachments` via `emails.receiving.attachments.list` | 4 |
| `channels/email.ts` — `sendEnquiryEmail(enquiry, staffUser, body)` (§2) | same file, outbound half (`{ context, body, authorUserId, authorDisplayName }`) | 7 |
| `POST /api/webhooks/resend`, Svix signature via `RESEND_WEBHOOK_SECRET` (§3) | `apps/admin/src/app/api/webhooks/resend/route.ts` + `channels/webhook-signature.ts` | 3, 6 |
| `email.received` → fetch full email via Resend API (§3) | `parseResendInbound` → `resendInboundDeps().getEmail` | 4 |
| → `findOrCreateCustomer` → `resolveThread` → `recordInbound` (+attachments) (§3) | `ingestResendEvent` | 5 |
| "Idempotent on `externalId`" (§3) | pre-fetch `enquiryMessage.findUnique({ externalId })` + `recordInbound`'s own P2002 path | 5 |
| "Rate limits unnecessary for signed webhooks; unsigned requests get 401" (§3) | route: 401 before any work, no failure row | 6 |
| `replyToEnquiry` picks the channel of the last inbound message (§4) | `chooseReplyChannel` + `loadEnquiryEmailContext` | 7 |
| email → `sendEnquiryEmail`; web/no inbound → email if the customer has one, else internal note with a notice (§4) | `replyToEnquiry` | 7 |
| From `"<Artist first name> at Boots 'n' Bandit" <enquiries@<INBOUND_EMAIL_DOMAIN>>` (§4, decision 6) | `fromDisplayName` + `formatFromHeader` + `outboundAddressFor` | 2, 7 |
| Reply-To `enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>` (§4, decision 6) | `replyAddressFor`; read back by `tokenFromAddress`/`threadTokenFrom` | 2, 4, 7 |
| `In-Reply-To` of the last inbound message id (§4) | `EnquiryMessage.messageIdHeader` → `In-Reply-To` + `References` | 1, 7 |
| Attachments: images ≤ 8 MB in Postgres, non-image/oversize as `url` (decision 7, Error handling) | `collectAttachments` + Phase-1 `storeAttachment` | 4 |
| Mime sniffed before storing bytes (Phase-1 review requirement) | `sniffImageMime`; sniffed mime is what is written | 4 |
| `INBOUND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET` (§8) | `.env.production.example`, `docker-compose.prod.yml` (admin only), `docs/DEPLOY.md` | 9 |
| "Webhook processing failures are logged … and return 200; a `WebhookFailure` row is written" (Error handling) | route `catch` → `recordWebhookFailure` → 200 | 1, 6 |
| Channels panel shows "3 failed events" with a retry button (Error handling, §6) | `/studio/channels` + `retryWebhookFailureAction` (replays through `ingestResendEvent`) | 8 |
| Channels panel: inbound address, secret/domain status, last inbound time | same page | 8 |
| Runbook `docs/CHANNELS.md`: Resend domain + inbound setup, MX record, webhook URL (§8) | new doc | 9 |
| Testing: "pure units for webhook parsing/verification", "route tests for the webhook with fixture payloads and bad signatures", "action tests for reply channel selection" | T2/T3 pure suites, T4 fixture suite, T6 route suite, T7 action suite | 2–7 |
| **Explicitly deferred to Phase 3/4:** Meta webhooks, `ChannelConnection`, `secrets.ts`, "Connect Facebook Page", the test "send yourself a message" button, composer channel indicator, `CustomerTimeline` message entries | — | Phases 3–4 |

The Channels panel's "Meta connection status" and "send yourself a message" (spec §6) are Meta-side and ship with Phase 3; this phase builds the email half of the same page, which is exactly what the phase bullet scopes ("Channels panel (email part)").

**Placeholder scan:** scanned the plan for `TBD`, `similar to`, `as above`, `<your`, `FIXME`, `TODO`, `the rest`, `placeholder` — the only two `the rest` hits are prose inside code comments ("the prefix is stripped and the rest base64-decoded", and a test title "links the rest"). No step says "and so on"; every file is given in full. Every function a later task consumes is defined with its exact signature in an earlier task's **Interfaces** block: `recordWebhookFailure`/`listRecentWebhookFailures`/`countOpenWebhookFailures`/`getWebhookFailure`/`markWebhookFailureRetried`/`setWebhookFailureError`/`WEBHOOK_FAILURE_WINDOW_DAYS` → T1; `inboundEmailDomain`/`parseAddress`/`parseAddressList`/`replyAddressFor`/`outboundAddressFor`/`tokenFromAddress`/`threadTokenFrom`/`tokenFromText`/`firstName`/`fromDisplayName`/`formatFromHeader`/`formatMessageId`/`replySubject`/`headerValue`/`isAutoSubmitted`/`htmlToText`/`stripQuotedReply` → T2; `signWebhookPayload`/`verifyWebhookSignature`/`WEBHOOK_TOLERANCE_SECONDS` → T3; `isEmailReceivedEvent`/`parseResendInbound`/`resendInboundDeps`/`ResendInboundDeps`/`ParsedInboundEmail`/`MAX_INBOUND_ATTACHMENTS` → T4; `ingestResendEvent`/`IngestOutcome` → T5; `loadEnquiryEmailContext`/`sendEnquiryEmail`/`EnquiryEmailContext`/`chooseReplyChannel`/`ReplyChannel` → T7.

**Type-name consistency (checked against the real Phase-1 source, not from memory):**
- `RecordMessageInput`, `ThreadMessageRow`, `InboxViewer` live in `enquiry-messages.ts`; only `RecordMessageInput` is extended (`messageIdHeader?: string | null`), and the field is deliberately kept off `MESSAGE_SELECT`/`ThreadMessageRow` so the inbox render does not pay for it.
- `StoreAttachmentInput` / `AttachmentMeta` / `isInlineableAttachment` / `MAX_INLINE_ATTACHMENT_BYTES` / `DbClient` are `assets.ts`'s — `parseResendInbound` returns `StoreAttachmentInput[]` exactly as `recordInbound` accepts it, so no adapter type exists.
- `ResolveThreadInput` / `ResolvedThread` are `enquiry-threading.ts`'s; `ingestResendEvent` passes `channel: "email"` (an `EnquiryChannel`) and `now: parsed.receivedAt`, both real fields.
- `SendEmailInput` / `SendEmailResult` / `EmailType` stay `email/index.ts`'s; `sendEnquiryEmail` returns `SendEmailResult` unchanged rather than inventing a parallel result type.
- `MessageChannelKind` (web|email|messenger|instagram|note) is the Prisma enum used by `EnquiryEmailContext.lastInboundChannel` and `chooseReplyChannel`; `EnquiryChannel` (web|flash|inkling|email|messenger|instagram) is the enquiry-level one. They are not interchangeable and are never mixed here.
- `SessionUser` really has `displayName: string` and `artistId?: string | null`, so `authorDisplayName: user.displayName` in `replyToEnquiry` type-checks.
- New names introduced by this phase and used consistently: `ResendReceivedEvent`, `ResendInboundEmail`, `ResendAttachmentLink`, `ResendInboundDeps`, `ParsedInboundEmail`, `IngestOutcome`, `WebhookVerification`, `SignatureHeaders`, `WebhookFailureRow`, `RecordWebhookFailureInput`, `EnquiryEmailContext`, `SendEnquiryEmailInput`, `ReplyChannel`.

**Issues found and fixed while reviewing:**
- The first draft planned to put the RFC `Message-ID` in `EnquiryMessage.externalId`. That column already holds the Resend email id and is the idempotency key — using it for two different identifiers would have broken replay detection. The migration now also adds `messageIdHeader`, and Task 1 tests that `recordInbound` persists it.
- The first draft assumed the SDK had no inbound retrieval and planned raw `fetch` calls. `resend@6.14` does expose `emails.receiving.get` / `emails.receiving.attachments.list`, so Task 4 uses them, and the fixtures were rewritten to the SDK's declared response shapes (including the two *different* attachment types: `InboundAttachment` inside the email, `AttachmentData` with `download_url` from the attachments endpoint — the plan now fetches both and joins them by id).
- The first draft planned a local verifier on the assumption `resend.webhooks.verify` did not exist. It does. The rationale in Task 3 was rewritten to the real reason (the `Resend` constructor throws without `RESEND_API_KEY`, and `standardwebhooks` is only a transitive dep), and an interop test against `resend.webhooks.verify` was added so the wire format is proven rather than asserted.
- `sendEnquiryEmail` originally duplicated the Resend call, which would have lost the MessageLog row, the outbound `EnquiryMessage` and the `authorUserId` attribution. It now delegates to `sendEmail`, which grew three optional fields instead.
- `stripQuotedReply` originally cut at a bare `From:` line and at the `--` signature delimiter; both truncate innocent bodies ("From: the tattoo I sent you"). `From:` now requires a following `Sent:/Date:/To:/Cc:/Subject:` line, signature stripping was dropped as out of scope, and a fully-quoted message falls back to its original text so no bubble is ever blank.
- `htmlToText`'s whitespace collapse used a character class containing a stray NBSP; it is now `/[^\S\n]+/g`, which is what it meant.
- The Task 7 `sendEmail` test asserted a hard-coded default `from`, which fails on any machine whose `.env` sets `EMAIL_FROM`; it now compares against `process.env.EMAIL_FROM ?? <default>` and restores `RESEND_API_KEY` in an `afterEach`. It also names the existing hoisted mock (`resendSend`) rather than inventing one.
- The webhook route originally recorded a `WebhookFailure` for unsigned requests too, turning the panel into a spam log. Only accepted-then-failed events are recorded.
- `collectAttachments` originally wrote a row when neither bytes nor a URL were available; `attachmentHref` returns `null` for that, so it would render as an unreachable attachment. Such rows are skipped.
- Changing the no-email reply branch to an internal note breaks two Phase-1 action tests; Task 7 spells out the exact rewrites rather than leaving them to be discovered.

**Ambiguities resolved (also listed in the hand-off):**
1. The spec's `In-Reply-To` requires an RFC `Message-ID`, which Phase 1 never stored — the additive migration also adds the nullable `EnquiryMessage.messageIdHeader` (Task 1).
2. `resend@6.14` *does* ship Svix verification (`webhooks.verify`, via a bundled `standardwebhooks`) and inbound retrieval — inbound retrieval is used, but verification is local `node:crypto` because `new Resend()` throws without `RESEND_API_KEY` and the transitive `standardwebhooks` must not be imported directly (Task 3).
3. "Artist's name" on the From line when nobody is assigned → the assigned artist's first name, else the replying staff member's first name, else plain `Boots 'n' Bandit` (Task 7).
4. `INBOUND_EMAIL_DOMAIN` unset → outbound still sends, falling back to `EMAIL_FROM` with no Reply-To (a reply is more valuable than a token); inbound answers 503 (Tasks 6, 7).
5. "Internal note with a notice" replaces Phase 1's log-only `MessageLog` + outbound row, and the status stays put because nothing was sent (Task 7).
6. The spec is silent on loops and auto-replies → `Auto-Submitted` / `Precedence: bulk|list|junk` / `X-Autoreply` and mail from our own send domain are ignored with a 200 and no thread write (Tasks 2, 5).
7. Non-image attachments are stored as Resend `download_url` references per the spec, but those URLs carry an `expires_at`; the limitation is documented in `docs/CHANNELS.md` rather than silently mirroring bytes the spec says not to store (Tasks 4, 9).
8. Idempotency is checked *before* the Resend API fetch, not only at insert time, so a replayed delivery costs no API call (Task 5).
9. An unsigned or badly signed request gets a 401 and **no** `WebhookFailure` row — the panel records events we accepted and failed, not rejected traffic (Task 6).
10. `resolveThread` needs a non-null `contactName`, but an inbound email may carry no display name → the sender's display name, else the resolved customer's `name` (Task 5).
11. "Count of recent `WebhookFailure` rows" = un-retried rows inside a 7-day window; retried rows stay listed (marked "Retried") for the audit trail (Tasks 1, 8).
12. `EnquirySource` has no `email` value, so an email-born enquiry records `source: "web"` (via Phase 1's `sourceForChannel`) and carries its real origin in `channel: "email"` (Task 5).
