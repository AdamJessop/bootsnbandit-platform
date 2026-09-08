# Enquiries Omnichannel — Phase 3: Meta Channels (Messenger + Instagram)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Facebook Messenger and Instagram DMs real two-way channels on the enquiry thread, shipping **dark behind env vars** because the studio has a Page and an IG professional account but no Meta developer app yet. A signed `X-Hub-Signature-256` webhook lands on the admin app, resolves the PSID/IGSID to a `CustomerIdentity`, threads the message with the Phase-1 `resolveThread` and records it — idempotently on the Meta `mid`, never with a 5xx. Staff replies go back out through the Graph API `/{pageId}/messages` endpoint using a page token encrypted at rest, with the 24-hour messaging window enforced before the send and surfaced as a composer error. An owner connects Pages through Facebook Login for Business from **Studio › Channels**, and `docs/CHANNELS.md` becomes the full Meta setup runbook. Task 1 first pays off every follow-up deferred from Phase 2.

**Architecture:** Phase 2's `channels/email.ts` (574 lines) is split into `channels/email-parse.ts` (inbound) and `channels/email-outbound.ts` (outbound), with `channels/email.ts` kept as a re-export barrel so no caller changes. The Meta channel mirrors that shape exactly: `channels/meta.ts` is pure (types, `verifyMetaSignature`, `verifyHubChallenge`, `parseMetaWebhook`, the CDN host allow-list, the outbound text splitter, `MetaWindowClosedError`), `channels/meta-inbound.ts` owns the one orchestration (`ingestMetaEvent`) that both the webhook route and the Channels retry button call, `channels/meta-outbound.ts` owns `sendMetaMessage`, and `channels/meta-oauth.ts` owns the pure halves of the connect flow. Page tokens live in `ChannelConnection.accessToken`, encrypted by `services/secrets.ts` (AES-256-GCM under an HKDF key derived from `SESSION_SECRET`) and read back only by `services/channel-connections.ts`. Every network call sits behind an injectable `fetchImpl`, so no test touches the network.

**Tech Stack:** Node 22, npm workspaces, Next.js 15 App Router, React 19, TypeScript, Prisma 7 (Postgres 16), zod 4, vitest 4 (`testdb` harness for DB suites), `node:crypto` (HMAC-SHA256, AES-256-GCM, HKDF-SHA256), global `fetch` for the Graph API, shadcn/ui + Tailwind + lucide-react (admin).

**Spec:** `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md` (Phasing → phase 3: "`ChannelConnection` + token encryption, Meta webhooks (Messenger + Instagram), Graph API send, echo handling, Connect Page flow, runbook; ships dark until Meta approval")

**Builds on:**
- `docs/superpowers/plans/2026-09-07-enquiries-phase-1-identity-and-threads.md` (merged) — `CustomerIdentity`, `resolveThread`, `recordInbound`, `assets.ts`.
- `docs/superpowers/plans/2026-09-07-enquiries-phase-2-email-channel.md` (merged as `feat/enquiries-phase-2`, head `bfcbb01`) — `WebhookFailure`, `webhook-signature.ts`, `channels/email*.ts`, the Resend route, Studio › Channels.

Every signature this plan consumes from those phases is quoted verbatim in the task that first uses it.

## Global Constraints

- **No new runtime dependencies.** Signature verification, encryption and key derivation are `node:crypto`; every HTTP call is the global `fetch`. Nothing here adds a package to `packages/core/package.json` or either app.
- **Every network call is behind an injectable `fetchImpl`** (default `fetch`), exactly like Phase 2's `resendInboundDeps(fetchImpl)`. **Tests never hit the network** — no `msw`, no live Graph calls, no `nock`. Every suite either injects a stub `fetchImpl` or mocks the module.
- **Synthetic fixtures only.** Meta ids in fixtures are the documented example shapes (`PAGE_ID = "102938475610293"`, `PSID = "7213456789012345"`, `IGSID = "17841400000000000"`, `MID = "m_AbC0dEf1..."`); names are invented ("Amy Rowe", "Jesse Fox"). No real people, no real page ids, no real tokens.
- **Ships dark.** With `META_APP_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN` unset: the webhook answers `503`, the Channels panel says "not configured" with a link to the runbook, `chooseReplyChannel` falls back to email (or an internal note), and nothing throws. `META_GRAPH_VERSION` is optional and defaults to `v21.0`.
- **Secrets are never logged or rendered.** `ChannelConnection.accessToken` is written encrypted, decrypted only inside `channel-connections.ts`, and never selected into a page/component prop. The Channels panel shows *presence* (`set` / `not set`), never a value. The page token goes in the Graph request **body**, never the URL or query string (query strings land in access logs).
- **Every unauthenticated route verifies before parsing** and **never returns 5xx for a payload problem**: `503` unconfigured secret, `401` bad/absent signature, `403` bad verify token, `413` oversize body, `200` for everything past verification (processing failures become a `WebhookFailure` row).
- Node 22, npm workspaces. Tests: `npm test -w @bnb/core`, `npm test -w @bnb/admin`, `npm test -w @bnb/web`. Dev Postgres is `docker compose up -d` (port 5435); DB suites use the `testdb` harness (`testDb`, `dbReachable`, `closeTestDb`, `uid` from `packages/core/src/services/testdb.ts`) and **return early** when `dbReachable()` is false.
- Load env for CLI work with `set -a && . ./.env && set +a` from the repo root. Prisma CLI loads the root `.env` itself via `packages/core/prisma.config.ts`.
- Migrations: `npm -w @bnb/core run db:migrate -- --name <name>` (= `prisma migrate dev`). Task 2 also ships the exact `migration.sql` so it can be written by hand and applied with `npm -w @bnb/core run db:migrate` when `migrate dev` cannot generate it. After any schema change run `npm run db:generate`.
- `packages/core/package.json` already maps `"./services/*": "./src/services/*.ts"` and `"./email/*": "./src/email/*.ts"`, and Node subpath patterns match `/`, so `@bnb/core/services/channels/meta`, `/channels/meta-inbound`, `/channels/meta-outbound`, `/channels/meta-oauth`, `/secrets`, `/channel-connections` and `@bnb/core/email/constants` all resolve with **no exports change**. The vitest alias `/^@bnb\/core\/(.*)$/` resolves them the same way. Do not add per-file entries.
- `packages/core/src/services/index.ts` gains `export * from "./channel-connections";` only. `secrets.ts` and every `channels/*` module stay **out** of the barrel (channel-specific names would collide; `secrets.ts` should be imported deliberately).
- `apps/web` is **not touched in this phase**, and must never import `@bnb/core/auth` (a guard test enforces it).
- Admin uses shadcn/ui + Tailwind design tokens (`text-text-muted`, `text-text-secondary`, `border-border-default`, `bg-bg-card`, `bg-bg-base`, `text-bb-teal`, `text-bb-gold`, `text-bb-crimson`). Images are plain `<img>`, never `next/image`.
- **Attachment bytes are only ever stored when `sniffImageMime(bytes)` from `@bnb/core/uploads` recognises them**, and the row records the **sniffed** mime, never the declared one. A failed sniff downgrades to a link-only (`url`) row. Carried from Phase 1 into every ingestion path, Meta included.
- Inbound is **idempotent on `externalId`** — the Resend email id for email, the Meta `mid` for Messenger/Instagram. `EnquiryMessage.externalId` is already `@unique` and already short-circuits inside `recordInbound`.
- Commit after every task with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
  ```
- **Never stage** `.superpowers/`, `.sentinal/` or `docs/plans/2026-07-29-artist-showcase-screen.md` (pre-existing unrelated changes). Every commit uses an explicit `git add` list.

---

## File map

| Path | Responsibility |
| --- | --- |
| `packages/core/src/email/constants.ts` (+test) | the single `DEFAULT_EMAIL_FROM` / `configuredEmailFrom()` |
| `packages/core/src/email/index.ts` | uses `configuredEmailFrom()` instead of a module-load constant |
| `packages/core/src/services/channels/email-parse.ts` (+test) | inbound half of the old `email.ts`; strict inline-attachment budget |
| `packages/core/src/services/channels/email-outbound.ts` (+test) | outbound half; `ENQUIRY_EMAIL_CONTEXT_SELECT` + `toEnquiryEmailContext` |
| `packages/core/src/services/channels/email.ts` (+test) | re-export barrel — callers unchanged |
| `packages/core/src/services/channels/email-format.ts` (+test) | validated `inboundEmailDomain`, numeric-entity `htmlToText`, `parseAuthenticationResults` |
| `packages/core/src/services/webhook-failures.ts` (+test) | `purgeOldWebhookFailures` + `WEBHOOK_FAILURE_RETENTION_DAYS` |
| `packages/core/src/cron/webhook-failures.ts` (+test), `cron/index.ts` (+test) | 90-day `WebhookFailure` prune in the hourly sweep |
| `packages/core/prisma/schema.prisma` + `migrations/20260909100000_meta_channels/` | `ChannelConnection`; `EnquiryMessage.senderVerified` + `.connectionId` |
| `packages/core/src/services/enquiry-messages.ts` (+test) | `senderVerified` / `connectionId` on `RecordMessageInput`, `senderVerified` on `ThreadMessageRow` |
| `packages/core/src/services/secrets.ts` (+test) | AES-256-GCM `encryptSecret` / `decryptSecret` under an HKDF key |
| `packages/core/src/services/channel-connections.ts` (+test) | `ChannelConnection` CRUD; the only module that decrypts a token |
| `packages/core/src/services/channels/meta.ts` (+test) | pure: signature, hub challenge, `parseMetaWebhook`, CDN allow-list, text splitter, errors |
| `packages/core/src/services/channels/__fixtures__/meta-*.json` | Messenger + Instagram webhook bodies, echo, postback, attachment |
| `packages/core/src/services/channels/meta-inbound.ts` (+test) | `ingestMetaEvent` — identity, threading, attachments, echoes |
| `packages/core/src/services/channels/meta-outbound.ts` (+test) | `sendMetaMessage`, `loadEnquiryMetaTarget` |
| `packages/core/src/services/channels/meta-oauth.ts` (+test) | pure dialog URL, scopes, `parseMetaAccounts`; `MetaOAuthDeps` |
| `apps/admin/src/app/api/webhooks/meta/route.ts` (+test) | `GET` hub challenge, `POST` signed events → `WebhookFailure` + 200 |
| `apps/admin/src/app/api/meta/oauth/callback/route.ts` (+test) | owner-only OAuth callback → connections + webhook subscribe |
| `apps/admin/src/app/(staff)/studio/channels/meta-actions.ts` (+test) | `connectMetaAction`, `disconnectMetaAction` |
| `apps/admin/src/app/(staff)/studio/channels/{page.tsx,actions.ts}` (+tests) | Meta section; retry gains a `meta` branch; failures list both providers |
| `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+test) | `chooseReplyChannel` gains the Meta branch |
| `apps/admin/src/app/(staff)/enquiries/actions.ts` (+test) | one enquiry read; Meta send; window error |
| `apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx` (+test), `page.tsx` | channel icons, unverified-sender badge |
| `docs/CHANNELS.md`, `docs/DEPLOY.md`, `.env.production.example`, `apps/admin/.env.example`, `docker-compose.prod.yml` | Meta runbook + config |
| `docs/PROJECT-BRIEF.md` | build-log entry |

---

## Ambiguities resolved before writing (each is restated where it applies)

1. `CustomerIdentity`, `MessageChannelKind.messenger|instagram` and `EnquiryChannel.messenger|instagram` **already exist** (Phase 1, `20260907130000_enquiry_threads`). The migration adds only `ChannelConnection`, `EnquiryMessage.senderVerified` and `EnquiryMessage.connectionId` — **no enum changes at all**.
2. **How a reply finds its Page** (spec is silent): the inbound `EnquiryMessage` stores the PSID/IGSID in `fromAddress` *and* a real `connectionId` FK to the `ChannelConnection` it arrived on. Putting a `pageId` on `Enquiry` was rejected — a customer can move between channels inside one thread, so the routing fact belongs to the message, not the enquiry.
3. `ChannelConnection` needs `pageId` as well as `igAccountId`: Instagram sends go to the **page** `/messages` endpoint with the IG-scoped recipient id, so an `instagram` row whose `externalId` is the IG business account id cannot route a send without its owning page id.
4. The spec's Channels "send yourself a message" button is **replaced by a per-connection "Last event received" timestamp** — a self-send needs a PSID, which does not exist until someone messages the Page.
5. The connect entry point is a **server action on a form button** (`connectMetaAction`), not a `GET /studio/channels/meta/connect` page: it matches the existing `retryWebhookFailureAction` pattern, gets the owner check and the CSRF protection of a Next server action for free, and can set the state cookie before redirecting.
6. `senderVerified` needs a database column, so ruling 1(h) splits: the **pure parser** lands in Task 1, the **column and plumbing** in Task 2 (the migration task), the **badge** in Task 9.
7. `EnquiryEmailContext` keeps its Phase-2 name even though it now also carries the Meta routing fields — renaming it would churn `actions.ts` and its suite for no behaviour change.

---

### Task 1: Phase-2 hardening (eight deferred follow-ups)

Everything Phase 2's final review deferred, paid off before any Meta code exists. Each sub-item gets its own failing test first.

**Files:**
- Create: `packages/core/src/email/constants.ts`, `packages/core/src/email/constants.test.ts`, `packages/core/src/services/channels/email-parse.ts`, `packages/core/src/services/channels/email-parse.test.ts`, `packages/core/src/services/channels/email-outbound.ts`, `packages/core/src/services/channels/email-barrel.test.ts`, `packages/core/src/cron/webhook-failures.ts`, `packages/core/src/cron/webhook-failures.test.ts`
- Modify: `packages/core/src/services/channels/email.ts`, `packages/core/src/services/channels/email-format.ts`, `packages/core/src/services/channels/email-format.test.ts`, `packages/core/src/email/index.ts`, `packages/core/src/services/webhook-failures.ts`, `packages/core/src/services/webhook-failures.test.ts`, `packages/core/src/cron/index.ts`, `packages/core/src/cron/index.test.ts`, `apps/admin/src/app/(staff)/enquiries/actions.ts`, `apps/admin/src/app/(staff)/enquiries/actions.test.ts`

**Interfaces:**
- Consumes (Phase 2, verbatim):
  ```ts
  // packages/core/src/services/channels/email.ts (being split)
  export const MAX_INBOUND_ATTACHMENTS = 20;
  export const MAX_INLINE_TOTAL_BYTES = 16 * 1024 * 1024;
  export const MAX_BODY_TEXT_CHARS = 64_000;
  export const MAX_BODY_HTML_CHARS = 512_000;
  export interface ResendReceivedEvent { type: string; created_at?: string; data: { email_id: string; created_at?: string; from?: string; to?: string[]; cc?: string[] | null; bcc?: string[] | null; subject?: string; message_id?: string; attachments?: { id: string; filename?: string | null; content_type?: string }[] } }
  export interface ResendInboundEmail { id: string; to: string[]; from: string; created_at: string; subject: string | null; cc: string[] | null; bcc: string[] | null; reply_to: string[] | null; html: string | null; text: string | null; headers: Record<string, string> | null; message_id: string; attachments: { id: string; filename: string | null; size: number; content_type: string; content_id: string | null; content_disposition: string | null }[] }
  export interface ResendAttachmentLink { id: string; filename?: string | null; size: number; content_type: string; content_disposition?: string | null; download_url: string; expires_at?: string }
  export interface ResendInboundDeps { getEmail(emailId: string): Promise<ResendInboundEmail>; listAttachments(emailId: string): Promise<ResendAttachmentLink[]>; download(url: string, maxBytes: number): Promise<Uint8Array | null> }
  export interface ParsedInboundEmail { externalId: string; messageId: string | null; fromAddress: string; fromName: string | null; toAddresses: string[]; ccAddresses: string[]; subject: string | null; bodyText: string; bodyHtml: string | null; threadToken: string | null; receivedAt: Date; autoSubmitted: boolean; attachments: StoreAttachmentInput[] }
  export function isEmailReceivedEvent(value: unknown): value is ResendReceivedEvent
  export function resendInboundDeps(fetchImpl?: typeof fetch): ResendInboundDeps
  export async function parseResendInbound(event: ResendReceivedEvent, deps?: ResendInboundDeps): Promise<ParsedInboundEmail>
  export function isOwnDomain(address: string, domain: string | null): boolean
  export interface EnquiryEmailContext { enquiryId: string; threadToken: string; customerId: string | null; contactName: string; contactEmail: string | null; subject: string | null; artistName: string | null; lastInboundChannel: MessageChannelKind | null; lastInboundMessageId: string | null; lastInboundSubject: string | null }
  export async function loadEnquiryEmailContext(enquiryId: string): Promise<EnquiryEmailContext | null>
  export interface SendEnquiryEmailInput { context: EnquiryEmailContext; body: string; authorUserId: string; authorDisplayName?: string | null }
  export async function sendEnquiryEmail(input: SendEnquiryEmailInput): Promise<SendEmailResult>

  // packages/core/src/services/assets.ts
  export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  export function isInlineableAttachment(mime: string, size: number): boolean
  export interface StoreAttachmentInput { mime: string; filename?: string | null; bytes?: Uint8Array | null; url?: string | null; messageId?: string | null }

  // packages/core/src/cron/reminders.ts
  export interface CronJobResult { job: string; sent: number; skipped: number }

  // packages/core/src/services/moodboard-assets.ts — the purge precedent this copies
  export async function purgeOrphanMoodboardAssets(olderThan: Date): Promise<number>
  ```
- Produces:
  ```ts
  // packages/core/src/email/constants.ts
  export const DEFAULT_EMAIL_FROM = "Boots 'n' Bandit <hello@bootsnbandit.co.uk>";
  export function configuredEmailFrom(env?: NodeJS.ProcessEnv): string;

  // packages/core/src/services/channels/email.ts  (barrel only)
  export * from "./email-parse";
  export * from "./email-outbound";

  // packages/core/src/services/channels/email-outbound.ts (new exports)
  export const ENQUIRY_EMAIL_CONTEXT_SELECT: Prisma.EnquirySelect;
  export type EnquiryEmailContextRow = Prisma.EnquiryGetPayload<{ select: typeof ENQUIRY_EMAIL_CONTEXT_SELECT }>;
  export function toEnquiryEmailContext(row: EnquiryEmailContextRow): EnquiryEmailContext;

  // packages/core/src/services/channels/email-format.ts (new exports)
  export function parseAuthenticationResults(headers: Record<string, string> | null | undefined): boolean | null;

  // packages/core/src/services/webhook-failures.ts
  export const WEBHOOK_FAILURE_RETENTION_DAYS = 90;
  export async function purgeOldWebhookFailures(olderThan: Date): Promise<number>;

  // packages/core/src/cron/webhook-failures.ts
  export async function runWebhookFailurePurge(now?: Date): Promise<CronJobResult>;
  ```

#### 1(a) — split `channels/email.ts` behind a re-export barrel

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/channels/email.test.ts` is the existing 28k-line suite for the module; it imports from `./email` and must keep passing untouched. Add a **new** guard suite that proves the barrel really re-exports both halves. Create `packages/core/src/services/channels/email-barrel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as barrel from "./email";
import {
  isEmailReceivedEvent,
  isOwnDomain,
  parseResendInbound,
  resendInboundDeps,
  MAX_INLINE_TOTAL_BYTES,
} from "./email-parse";
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  loadEnquiryEmailContext,
  sendEnquiryEmail,
  toEnquiryEmailContext,
} from "./email-outbound";

/**
 * `channels/email.ts` is a barrel, not a module: every Phase-2 caller
 * (email-inbound.ts, the admin actions, the Channels panel, this package's own
 * suites) imports from it, so the split is only safe while it re-exports the
 * exact same bindings the two halves define.
 */
describe("channels/email barrel", () => {
  it("re-exports the inbound half unchanged", () => {
    expect(barrel.isEmailReceivedEvent).toBe(isEmailReceivedEvent);
    expect(barrel.parseResendInbound).toBe(parseResendInbound);
    expect(barrel.resendInboundDeps).toBe(resendInboundDeps);
    expect(barrel.isOwnDomain).toBe(isOwnDomain);
    expect(barrel.MAX_INLINE_TOTAL_BYTES).toBe(MAX_INLINE_TOTAL_BYTES);
  });

  it("re-exports the outbound half unchanged", () => {
    expect(barrel.loadEnquiryEmailContext).toBe(loadEnquiryEmailContext);
    expect(barrel.sendEnquiryEmail).toBe(sendEnquiryEmail);
    expect(barrel.toEnquiryEmailContext).toBe(toEnquiryEmailContext);
    expect(barrel.ENQUIRY_EMAIL_CONTEXT_SELECT).toBe(
      ENQUIRY_EMAIL_CONTEXT_SELECT,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-barrel.test.ts`
Expected: FAIL — `Failed to resolve import "./email-parse"`.

- [ ] **Step 3: Perform the split**

Create `packages/core/src/services/channels/email-parse.ts` containing, **moved verbatim** from `channels/email.ts`: the file header comment, `MAX_INBOUND_ATTACHMENTS`, `DOWNLOAD_TIMEOUT_MS`, `MAX_INLINE_TOTAL_BYTES`, `MAX_BODY_TEXT_CHARS`, `MAX_BODY_HTML_CHARS`, `TRUNCATION_MARKER`, `capBodyText`, `ResendReceivedEvent`, `ResendInboundEmail`, `ResendAttachmentLink`, `ResendInboundDeps`, `ParsedInboundEmail`, `isEmailReceivedEvent`, `EMAIL_ID`, `requireApiKey`, `resendInboundDeps`, `baseMime`, `collectAttachments`, `parseResendInbound`, `isOwnDomain`. Its imports become:

```ts
import { sniffImageMime } from "@bnb/core/uploads";
import {
  isInlineableAttachment,
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
import {
  emailFromDomain,
  headerValue,
  htmlToText,
  inboundEmailDomain,
  isAutoSubmitted,
  formatMessageId,
  parseAddress,
  parseAddressList,
  stripQuotedReply,
  threadTokenFrom,
  tokenFromText,
} from "./email-format";
```

(`prisma` and `sendEmail` are **not** imported here — the parse half touches neither.)

Create `packages/core/src/services/channels/email-outbound.ts` containing, moved verbatim: `EnquiryEmailContext`, `loadEnquiryEmailContext`, `SendEnquiryEmailInput`, `sendEnquiryEmail`, with imports:

```ts
import { prisma } from "@bnb/core/db";
import { sendEmail, type SendEmailResult } from "@bnb/core/email";
import {
  firstName,
  formatFromHeader,
  formatMessageId,
  fromDisplayName,
  inboundEmailDomain,
  outboundAddressFor,
  parseAddress,
  replyAddressFor,
  replySubject,
} from "./email-format";
import type { MessageChannelKind, Prisma } from "@prisma/client";
```

Replace the whole body of `packages/core/src/services/channels/email.ts` with:

```ts
/**
 * The email channel, in two halves:
 *
 *   email-parse.ts    inbound  — Resend event → ParsedInboundEmail
 *   email-outbound.ts outbound — enquiry → a studio reply
 *
 * This file stays as the barrel every Phase-2 caller already imports
 * (`@bnb/core/services/channels/email`), so the split cost no call sites.
 */
export * from "./email-parse";
export * from "./email-outbound";
```

- [ ] **Step 4: Run the whole channels suite**

Run: `npm test -w @bnb/core -- src/services/channels`
Expected: PASS — the barrel suite is green and the pre-existing `email.test.ts` / `email-inbound.test.ts` are unchanged and still pass.

#### 1(b) — prune `WebhookFailure` rows older than 90 days in the hourly cron

- [ ] **Step 5: Write the failing tests**

Append to `packages/core/src/services/webhook-failures.test.ts` (a DB suite; it already has `testDb`/`dbReachable` set up at the top of the file — reuse them):

```ts
describe("purgeOldWebhookFailures", () => {
  it("deletes rows older than the cutoff and leaves newer ones", async () => {
    if (!(await dbReachable())) return;
    const db = testDb();
    const provider = uid("prov");
    const old = await db.webhookFailure.create({
      data: {
        provider,
        payload: { n: 1 },
        error: "old",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      select: { id: true },
    });
    const fresh = await db.webhookFailure.create({
      data: {
        provider,
        payload: { n: 2 },
        error: "fresh",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
      select: { id: true },
    });

    const deleted = await purgeOldWebhookFailures(new Date("2026-06-01T00:00:00Z"));
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await db.webhookFailure.findUnique({ where: { id: old.id } })).toBeNull();
    expect(
      await db.webhookFailure.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();

    await db.webhookFailure.deleteMany({ where: { provider } });
  });
});
```

Add `purgeOldWebhookFailures` and `WEBHOOK_FAILURE_RETENTION_DAYS` to that file's import list from `./webhook-failures`.

Create `packages/core/src/cron/webhook-failures.test.ts` — mocked, exactly the shape of the existing `cron/moodboard-assets.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const purge = vi.fn(async () => 7);
vi.mock("@bnb/core/services/webhook-failures", () => ({
  purgeOldWebhookFailures: (...a: unknown[]) => purge(...(a as [Date])),
  WEBHOOK_FAILURE_RETENTION_DAYS: 90,
}));
const { runWebhookFailurePurge } = await import("./webhook-failures");

describe("runWebhookFailurePurge", () => {
  it("deletes failures older than 90 days and reports the count", async () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const res = await runWebhookFailurePurge(now);
    expect(res).toEqual({ job: "webhook_failure_purge", sent: 7, skipped: 0 });
    expect(purge.mock.calls[0][0].toISOString()).toBe(
      "2026-06-10T12:00:00.000Z",
    );
  });
});
```

Append to `packages/core/src/cron/index.test.ts`:

```ts
it("includes the webhook-failure purge in the sweep", async () => {
  const summary = await runAllCron();
  expect(summary.jobs.map((j) => j.job)).toContain("webhook_failure_purge");
});
```

(`cron/index.test.ts` already mocks each job module; add
`vi.mock("./webhook-failures", () => ({ runWebhookFailurePurge: async () => ({ job: "webhook_failure_purge", sent: 0, skipped: 0 }) }));`
alongside the existing job mocks.)

- [ ] **Step 6: Run them to verify they fail**

Run: `npm test -w @bnb/core -- src/cron src/services/webhook-failures.test.ts`
Expected: FAIL — `purgeOldWebhookFailures is not a function` and `Cannot find module './webhook-failures'` from `src/cron`.

- [ ] **Step 7: Implement**

Append to `packages/core/src/services/webhook-failures.ts`:

```ts
/**
 * How long a failure row is worth keeping. The panel only ever looks back
 * WEBHOOK_FAILURE_WINDOW_DAYS (7); everything past this is an audit trail
 * nobody reads, and each row holds a whole webhook body — an unbounded jsonb
 * table growing at provider-retry rates. Mirrors the mood-board orphan purge:
 * a cheap `deleteMany` run by the hourly cron sweep.
 */
export const WEBHOOK_FAILURE_RETENTION_DAYS = 90;

/** Delete failure rows created before `olderThan`. Returns how many went. */
export async function purgeOldWebhookFailures(olderThan: Date): Promise<number> {
  const res = await prisma.webhookFailure.deleteMany({
    where: { createdAt: { lt: olderThan } },
  });
  return res.count;
}
```

Create `packages/core/src/cron/webhook-failures.ts`:

```ts
import {
  purgeOldWebhookFailures,
  WEBHOOK_FAILURE_RETENTION_DAYS,
} from "@bnb/core/services/webhook-failures";
import type { CronJobResult } from "./reminders";

/** Housekeeping: drop stored webhook bodies past their retention window. */
export async function runWebhookFailurePurge(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const deleted = await purgeOldWebhookFailures(
    new Date(now.getTime() - WEBHOOK_FAILURE_RETENTION_DAYS * 24 * 3600_000),
  );
  return { job: "webhook_failure_purge", sent: deleted, skipped: 0 };
}
```

In `packages/core/src/cron/index.ts` add the import, the re-export and the sweep line:

```ts
import { runWebhookFailurePurge } from "./webhook-failures";
export { runWebhookFailurePurge } from "./webhook-failures";
// …inside runAllCron, after runMoodboardAssetPurge():
jobs.push(await runWebhookFailurePurge());
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npm test -w @bnb/core -- src/cron src/services/webhook-failures.test.ts`
Expected: PASS (the DB case returns early when Postgres is not up).

#### 1(c) — make the 16 MB inline-attachment budget strict

- [ ] **Step 9: Write the failing test**

Append to `packages/core/src/services/channels/email-parse.test.ts` (create the file with this suite; the pre-existing `email.test.ts` keeps its own cases):

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_TOTAL_BYTES,
  parseResendInbound,
  type ResendAttachmentLink,
  type ResendInboundDeps,
  type ResendInboundEmail,
} from "./email-parse";
import { MAX_INLINE_ATTACHMENT_BYTES } from "../assets";

/** A valid 8-byte PNG signature followed by filler, so sniffImageMime passes. */
function png(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function email(
  attachments: ResendInboundEmail["attachments"],
): ResendInboundEmail {
  return {
    id: "em_budget_1",
    to: ["enq-abcd1234@mail.example.test"],
    from: "Amy Rowe <amy@example.test>",
    created_at: "2026-09-08T10:00:00.000Z",
    subject: "Photos",
    cc: null,
    bcc: null,
    reply_to: null,
    html: null,
    text: "Some references",
    headers: {},
    message_id: "budget@example.test",
    attachments,
  };
}

function meta(id: string, size: number): ResendInboundEmail["attachments"][number] {
  return {
    id,
    filename: `${id}.png`,
    size,
    content_type: "image/png",
    content_id: null,
    content_disposition: "attachment",
  };
}

function link(id: string, size: number): ResendAttachmentLink {
  return {
    id,
    filename: `${id}.png`,
    size,
    content_type: "image/png",
    download_url: `https://dl.example.test/${id}`,
  };
}

describe("inline attachment budget", () => {
  it("stops downloading once the budget can no longer fit another attachment", async () => {
    // Three 8 MB images: the budget (16 MB) affords two.
    const ids = ["a1", "a2", "a3"];
    const metas = ids.map((id) => meta(id, MAX_INLINE_ATTACHMENT_BYTES));
    const downloaded: string[] = [];
    const deps: ResendInboundDeps = {
      async getEmail() {
        return email(metas);
      },
      async listAttachments() {
        return ids.map((id) => link(id, MAX_INLINE_ATTACHMENT_BYTES));
      },
      async download(url) {
        downloaded.push(url);
        return png(MAX_INLINE_ATTACHMENT_BYTES);
      },
    };

    const parsed = await parseResendInbound(
      { type: "email.received", data: { email_id: "em_budget_1" } },
      deps,
    );

    expect(downloaded).toHaveLength(2);
    expect(parsed.attachments.filter((a) => a.bytes)).toHaveLength(2);
    // The third is still reachable, as a link.
    expect(parsed.attachments[2]).toMatchObject({
      url: "https://dl.example.test/a3",
    });
    expect(parsed.attachments[2].bytes).toBeUndefined();
  });

  it("caps a lying Content-Length at the remaining budget, not the per-file cap", async () => {
    // One 15 MB image, then one that DECLARES 1 byte but streams 8 MB.
    const first = MAX_INLINE_TOTAL_BYTES - 1024 * 1024; // 15 MB
    const caps: number[] = [];
    const deps: ResendInboundDeps = {
      async getEmail() {
        return email([meta("b1", first), meta("b2", 1)]);
      },
      async listAttachments() {
        return [link("b1", first), link("b2", 1)];
      },
      async download(_url, maxBytes) {
        caps.push(maxBytes);
        return png(Math.min(first, maxBytes));
      },
    };

    await parseResendInbound(
      { type: "email.received", data: { email_id: "em_budget_1" } },
      deps,
    );

    expect(caps[0]).toBe(MAX_INLINE_ATTACHMENT_BYTES);
    // 16 MB budget − 15 MB spent = 1 MB left, so the stream is cut there.
    expect(caps[1]).toBe(1024 * 1024);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-parse.test.ts`
Expected: FAIL — the first case downloads all three (the current pre-check charges only what was *received*, so a fresh attachment always looks affordable), and the second passes `MAX_INLINE_ATTACHMENT_BYTES` both times.

- [ ] **Step 11: Implement**

In `packages/core/src/services/channels/email-parse.ts`, replace the budget block inside `collectAttachments` (the `const affordable = …` line through the `if (downloaded) spent += …` line) with:

```ts
    let bytes: Uint8Array | null = null;
    let mime = declared;
    // What is left of the 16 MB budget, and what this attachment could cost
    // at worst. `size` is the sender's declaration and may be absent or a
    // lie, so an unknown/zero size is priced at the full per-file cap: the
    // budget must bound the work DONE, not just what ends up stored.
    const remaining = MAX_INLINE_TOTAL_BYTES - spent;
    const projected = Math.min(
      size > 0 ? size : MAX_INLINE_ATTACHMENT_BYTES,
      MAX_INLINE_ATTACHMENT_BYTES,
    );
    if (url && projected <= remaining && isInlineableAttachment(declared, size)) {
      let downloaded: Uint8Array | null = null;
      try {
        // The stream is cut the instant it crosses whichever is smaller: the
        // per-file cap or what remains of the budget. `download` returns null
        // when it does, so an over-budget attachment costs the transfer of
        // the remaining budget and nothing more.
        downloaded = await deps.download(url, Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining));
      } catch (err) {
        console.error(`[email] attachment download failed for ${meta.id}:`, err);
      }
      // Charged whether or not the bytes end up stored — a failed sniff still
      // cost the transfer. An aborted download charges the whole allowance it
      // was given, because that is what was pulled over the wire.
      spent += downloaded
        ? Math.max(size, downloaded.byteLength)
        : Math.min(projected, remaining);
      const sniffed = downloaded ? sniffImageMime(downloaded) : null;
      if (downloaded && sniffed) {
        bytes = downloaded;
        mime = sniffed;
      }
    }
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels`
Expected: PASS, including the pre-existing `email.test.ts` budget cases.

#### 1(d) — one `DEFAULT_EMAIL_FROM`, in a pure module

- [ ] **Step 13: Write the failing test**

Create `packages/core/src/email/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { configuredEmailFrom, DEFAULT_EMAIL_FROM } from "./constants";
import { emailFromDomain } from "@bnb/core/services/channels/email-format";

/**
 * The default From address was written out twice — in email/index.ts and in
 * channels/email-format.ts — so changing the studio address in one place
 * silently desynced the loop guard (`isOwnDomain`) from what we actually send.
 * One constant, one reader, both files import it.
 */
describe("configuredEmailFrom", () => {
  it("falls back to the single default when EMAIL_FROM is unset or blank", () => {
    expect(configuredEmailFrom({} as NodeJS.ProcessEnv)).toBe(DEFAULT_EMAIL_FROM);
    expect(configuredEmailFrom({ EMAIL_FROM: "  " } as NodeJS.ProcessEnv)).toBe(
      DEFAULT_EMAIL_FROM,
    );
  });

  it("prefers a configured value", () => {
    expect(
      configuredEmailFrom({
        EMAIL_FROM: "Studio <hi@studio.test>",
      } as NodeJS.ProcessEnv),
    ).toBe("Studio <hi@studio.test>");
  });

  it("is the same default emailFromDomain derives its host from", () => {
    expect(emailFromDomain({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_EMAIL_FROM.slice(
        DEFAULT_EMAIL_FROM.lastIndexOf("@") + 1,
      ).replace(">", ""),
    );
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/email/constants.test.ts`
Expected: FAIL — `Failed to resolve import "./constants"`.

- [ ] **Step 15: Implement**

Create `packages/core/src/email/constants.ts`:

```ts
/**
 * Pure email constants — no Prisma, no server-only, no Resend — so both the
 * sender (`email/index.ts`) and the pure header shaping
 * (`services/channels/email-format.ts`) can import the SAME default without a
 * cycle. Two copies of this string is how `isOwnDomain` drifts away from the
 * domain we actually send from, and a drifted loop guard threads our own
 * bounces as customer replies.
 */
export const DEFAULT_EMAIL_FROM = "Boots 'n' Bandit <hello@bootsnbandit.co.uk>";

/** `EMAIL_FROM` when it carries something, else the studio default. */
export function configuredEmailFrom(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}
```

In `packages/core/src/email/index.ts`, delete the module-level constant:

```ts
const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "Boots 'n' Bandit <hello@bootsnbandit.co.uk>";
```

replace it with the import `import { configuredEmailFrom } from "./constants";`, and change the send call's `from` line to:

```ts
        from: input.from?.trim() || configuredEmailFrom(),
```

(Reading it at send time rather than module load is a bonus fix: a test that sets `EMAIL_FROM` after import no longer sees a stale value.)

In `packages/core/src/services/channels/email-format.ts`, change `emailFromDomain` to use it:

```ts
import { configuredEmailFrom } from "@bnb/core/email/constants";

export function emailFromDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const parsed = parseAddress(configuredEmailFrom(env));
  if (!parsed) return null;
  return parsed.address.slice(parsed.address.lastIndexOf("@") + 1) || null;
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/email src/services/channels/email-format.test.ts`
Expected: PASS.

#### 1(e) — one enquiry read in `replyToEnquiry`

- [ ] **Step 17: Write the failing test**

Append to `apps/admin/src/app/(staff)/enquiries/actions.test.ts`:

```ts
it("reads the enquiry exactly once when replying", async () => {
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    role: "OWNER",
    displayName: "Owner",
    artistId: null,
    email: "owner@example.test",
  } as never);
  vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
    id: "e1",
    customerId: "c1",
    contactEmail: "amy@example.test",
    contactName: "Amy",
    preferredArtistId: null,
    style: null,
    placement: null,
    source: "web",
    status: "new",
    threadToken: "tok123456",
    subject: "Sleeve idea",
    preferredArtist: null,
    customer: { email: "amy@example.test" },
    messages: [],
  } as never);
  vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "re_1", status: "sent" });

  const res = await replyToEnquiry("e1", { message: "Hello" });

  expect(res.ok).toBe(true);
  expect(prisma.enquiry.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  expect(loadEnquiryEmailContext).not.toHaveBeenCalled();
  expect(vi.mocked(sendEnquiryEmail).mock.calls[0][0].context).toMatchObject({
    enquiryId: "e1",
    threadToken: "tok123456",
    contactEmail: "amy@example.test",
  });
});
```

Add `toEnquiryEmailContext: vi.fn((row: unknown) => row)` — no: the action must call the **real** mapper, so extend the existing module mock to keep it real:

```ts
vi.mock("@bnb/core/services/channels/email", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@bnb/core/services/channels/email")>();
  return {
    ...actual,
    loadEnquiryEmailContext: vi.fn(),
    sendEnquiryEmail: vi.fn(),
  };
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/actions.test.ts"`
Expected: FAIL — `expected loadEnquiryEmailContext not to be called`, because `replyToEnquiry` still issues a second read.

- [ ] **Step 19: Implement**

In `packages/core/src/services/channels/email-outbound.ts`, lift the select out of `loadEnquiryEmailContext` and add the pure mapper:

```ts
/**
 * Everything a staff reply needs, as a reusable Prisma select. The admin
 * action spreads this into the scoped read it already performs, so replying
 * costs ONE enquiry query instead of two.
 *
 * `messageIdHeader` is deliberately selected here rather than carried on
 * `ThreadMessageRow` — no render path needs it, and the inbox pulls hundreds
 * of rows per page.
 */
export const ENQUIRY_EMAIL_CONTEXT_SELECT = {
  id: true,
  threadToken: true,
  customerId: true,
  contactName: true,
  contactEmail: true,
  subject: true,
  preferredArtist: { select: { name: true } },
  customer: { select: { email: true } },
  messages: {
    where: { direction: "inbound" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      channel: true,
      subject: true,
      messageIdHeader: true,
      fromAddress: true,
    },
  },
} satisfies Prisma.EnquirySelect;

export type EnquiryEmailContextRow = Prisma.EnquiryGetPayload<{
  select: typeof ENQUIRY_EMAIL_CONTEXT_SELECT;
}>;

/** Pure row → context. No I/O, so callers that already hold the row reuse it. */
export function toEnquiryEmailContext(
  enquiry: EnquiryEmailContextRow,
): EnquiryEmailContext {
  const last = enquiry.messages[0] ?? null;
  return {
    enquiryId: enquiry.id,
    threadToken: enquiry.threadToken,
    customerId: enquiry.customerId,
    contactName: enquiry.contactName,
    // A thread the customer emailed us on always has a reachable address,
    // even when the enquiry row never captured one (a Meta or flash lead that
    // later moved to email). `fromAddress` is only an address for email
    // traffic (a web lead stores the phone number there), so it is parsed,
    // not trusted.
    contactEmail:
      enquiry.contactEmail ??
      parseAddress(last?.fromAddress)?.address ??
      enquiry.customer?.email ??
      null,
    subject: enquiry.subject,
    artistName: enquiry.preferredArtist?.name ?? null,
    lastInboundChannel: last?.channel ?? null,
    lastInboundMessageId: last?.messageIdHeader ?? null,
    lastInboundSubject: last?.subject ?? null,
  };
}

export async function loadEnquiryEmailContext(
  enquiryId: string,
): Promise<EnquiryEmailContext | null> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: ENQUIRY_EMAIL_CONTEXT_SELECT,
  });
  return enquiry ? toEnquiryEmailContext(enquiry) : null;
}
```

In `apps/admin/src/app/(staff)/enquiries/actions.ts`, fold the select into the scoped read and map instead of re-reading:

```ts
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  sendEnquiryEmail,
  toEnquiryEmailContext,
} from "@bnb/core/services/channels/email";

async function loadEnquiryScoped(enquiryId: string) {
  const user = await requireRole();
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { id: enquiryId },
    select: {
      // The reply context and the triage fields in ONE read: replying used to
      // load the same row twice (once scoped, once for the email context).
      ...ENQUIRY_EMAIL_CONTEXT_SELECT,
      preferredArtistId: true,
      style: true,
      placement: true,
      source: true,
      status: true,
    },
  });
  if (!canAccessEnquiry(user, enquiry)) {
    throw new Error("Forbidden");
  }
  return { user, enquiry };
}
```

and in `replyToEnquiry` replace

```ts
  const context = await loadEnquiryEmailContext(enquiryId);
  if (!context) return { ok: false, message: "That enquiry no longer exists." };
```

with

```ts
  const context = toEnquiryEmailContext(enquiry);
```

(`findUniqueOrThrow` already covers the "no longer exists" case by throwing, which the caller surfaces the same way it does for `Forbidden`.) Drop the now-unused `loadEnquiryEmailContext` import.

- [ ] **Step 20: Run test to verify it passes**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: PASS. Fix any pre-existing case that stubbed `loadEnquiryEmailContext` by moving its fields onto the `findUniqueOrThrow` stub instead.

#### 1(f) — validate `INBOUND_EMAIL_DOMAIN`, warn once

- [ ] **Step 21: Write the failing test**

Append to `packages/core/src/services/channels/email-format.test.ts`:

```ts
describe("inboundEmailDomain validation", () => {
  it("accepts a plain hostname, stripping a leading @ and casing", () => {
    expect(
      inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: "@Mail.Example.TEST" } as NodeJS.ProcessEnv),
    ).toBe("mail.example.test");
  });

  it("treats a value that is not a hostname as unset, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      INBOUND_EMAIL_DOMAIN: "https://mail.example.test/inbox",
    } as NodeJS.ProcessEnv;
    expect(inboundEmailDomain(env)).toBeNull();
    expect(inboundEmailDomain(env)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("INBOUND_EMAIL_DOMAIN");
    warn.mockRestore();
  });

  it("warns once for an unset value too", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inboundEmailDomain({} as NodeJS.ProcessEnv)).toBeNull();
    expect(inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: "" } as NodeJS.ProcessEnv)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
```

Ensure `vi` is imported in that file's `vitest` import list.

- [ ] **Step 22: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts`
Expected: FAIL — `expected "warn" to be called 1 times, but got 0`, and `"https://mail.example.test/inbox"` is returned instead of `null`.

- [ ] **Step 23: Implement**

Replace `inboundEmailDomain` in `packages/core/src/services/channels/email-format.ts`:

```ts
/**
 * A DNS hostname: labels of letters/digits/hyphens (not leading or trailing),
 * at least two of them, ending in an alphabetic TLD. Deliberately strict — a
 * value like `https://mail.example.test/` or `enq@mail.example.test` would
 * otherwise be pasted straight into a Reply-To header and silently produce
 * unreachable mail.
 */
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * One warning per distinct bad/absent value per process. A module-level Set
 * (rather than a boolean) means a misconfiguration and a later correction each
 * get said once, and tests can exercise both without a reset hook.
 */
const warnedDomains = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warnedDomains.has(key)) return;
  warnedDomains.add(key);
  console.warn(message);
}

/**
 * The subdomain whose MX points at Resend — both the inbound mailbox domain
 * and the outbound From domain. Null when unconfigured OR misconfigured,
 * which the callers treat as "email replies fall back to the plain studio
 * address"; a bad value must degrade exactly like an absent one, loudly.
 */
export function inboundEmailDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  if (!raw) {
    warnOnce(
      "",
      "[email] INBOUND_EMAIL_DOMAIN is not set — enquiry replies carry no reply token and inbound email is off. See docs/CHANNELS.md.",
    );
    return null;
  }
  if (!HOSTNAME.test(raw)) {
    warnOnce(
      raw,
      `[email] INBOUND_EMAIL_DOMAIN is not a hostname (${raw}) — treating it as unset. Use the bare subdomain, e.g. mail.example.com. See docs/CHANNELS.md.`,
    );
    return null;
  }
  return raw;
}
```

Delete the now-duplicated `console.warn` inside `sendEnquiryEmail` in `channels/email-outbound.ts` (the `if (!domain) { console.warn(…) }` block) — `inboundEmailDomain` owns that message now, and it fires once instead of once per reply.

- [ ] **Step 24: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels`
Expected: PASS.

#### 1(g) — decode numeric entities in `htmlToText`

- [ ] **Step 25: Write the failing test**

Append to `packages/core/src/services/channels/email-format.test.ts`:

```ts
describe("htmlToText numeric entities", () => {
  it("decodes decimal and hex character references", () => {
    expect(htmlToText("<p>It&#8217;s here</p>")).toBe("It’s here");
    expect(htmlToText("<p>It&#x2019;s here</p>")).toBe("It’s here");
    expect(htmlToText("<p>caf&#233;</p>")).toBe("café");
  });

  it("leaves an unresolvable reference alone rather than mangling it", () => {
    expect(htmlToText("<p>&#xZZ; &notanentity;</p>")).toBe("&#xZZ; &notanentity;");
  });
});
```

- [ ] **Step 26: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts -t "numeric entities"`
Expected: FAIL — `expected 'It&#8217;s here' to be 'It’s here'`.

- [ ] **Step 27: Implement**

In `packages/core/src/services/channels/email-format.ts`, add a decoder and use it inside `htmlToText`:

```ts
/**
 * Numeric character references — `&#8217;` and `&#x2019;` are what real mail
 * clients emit for a curly apostrophe, and leaving them raw puts literal
 * `&#8217;` in the inbox bubble. Out-of-range and surrogate code points are
 * left untouched rather than turned into a replacement character, so nothing
 * is silently corrupted.
 */
function decodeNumericEntity(match: string, hex: string | undefined, dec: string | undefined): string {
  const code = hex ? Number.parseInt(hex, 16) : Number.parseInt(dec ?? "", 10);
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
  if (code >= 0xd800 && code <= 0xdfff) return match;
  try {
    return String.fromCodePoint(code);
  } catch {
    return match;
  }
}
```

and replace the entity line inside `htmlToText`:

```ts
    .replace(/&#x([0-9a-f]+);|&#(\d+);/gi, (m, hex, dec) =>
      decodeNumericEntity(m, hex, dec),
    )
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
```

(The named-entity pass now excludes `#`/digits, since the numeric pass ran first; `&#39;` and `&apos;` still resolve — `&#39;` via the numeric branch.)

- [ ] **Step 28: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts`
Expected: PASS.

#### 1(h) — parse inbound sender authentication (pure half)

The `EnquiryMessage.senderVerified` column, the plumbing through `parseResendInbound` → `recordInbound`, and the inbox badge need a migration, so they land in **Task 2** and **Task 9**. The pure parser lands here, where the rest of the header work lives.

- [ ] **Step 29: Write the failing test**

Append to `packages/core/src/services/channels/email-format.test.ts`:

```ts
describe("parseAuthenticationResults", () => {
  it("is null when the header is absent — unknown, not unverified", () => {
    expect(parseAuthenticationResults(null)).toBeNull();
    expect(parseAuthenticationResults({})).toBeNull();
    expect(parseAuthenticationResults({ Subject: "hi" })).toBeNull();
  });

  it("is true on a DMARC pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results":
          "mx.resend.com; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test; dmarc=pass header.from=example.test",
      }),
    ).toBe(true);
  });

  it("is true when SPF and DKIM both pass without DMARC", () => {
    expect(
      parseAuthenticationResults({
        "authentication-results": "mx.resend.com; spf=pass; dkim=pass",
      }),
    ).toBe(true);
  });

  it("is false when the header exists but the checks do not pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results": "mx.resend.com; spf=fail; dkim=none; dmarc=fail",
      }),
    ).toBe(false);
    expect(
      parseAuthenticationResults({
        "Authentication-Results": "mx.resend.com; spf=pass; dkim=none",
      }),
    ).toBe(false);
  });

  it("does not let a lookalike token forge a pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results": "mx.resend.com; xspf=pass; dkim=pass",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 30: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/email-format.test.ts -t "parseAuthenticationResults"`
Expected: FAIL — `parseAuthenticationResults is not a function`.

- [ ] **Step 31: Implement**

Append to `packages/core/src/services/channels/email-format.ts`:

```ts
/** `spf=pass`, `dkim=pass`, `dmarc=pass` — anchored so `xspf=pass` cannot match. */
function methodResult(header: string, method: string): string | null {
  const re = new RegExp(`(?:^|[;\\s])${method}\\s*=\\s*([a-z]+)`, "i");
  const match = re.exec(header);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Did the receiving MTA authenticate this sender?
 *
 *   true   DMARC passed, or SPF and DKIM both passed
 *   false  the header is there and it did not
 *   null   no header at all — unknown (also what web and Meta messages get)
 *
 * This NEVER drops mail. A tattoo enquiry from a badly configured personal
 * domain is still a customer; the inbox just labels the bubble so staff can
 * weigh "this is your artist" against a forged From line before they act on
 * it. Only `Authentication-Results` is read — `ARC-` headers describe some
 * other hop's opinion and are not ours to trust.
 */
export function parseAuthenticationResults(
  headers: Record<string, string> | null | undefined,
): boolean | null {
  const header = headerValue(headers, "authentication-results");
  if (!header) return null;
  if (methodResult(header, "dmarc") === "pass") return true;
  return (
    methodResult(header, "spf") === "pass" &&
    methodResult(header, "dkim") === "pass"
  );
}
```

- [ ] **Step 32: Run the full core + admin suites**

Run: `npm test -w @bnb/core && npm test -w @bnb/admin`
Expected: PASS.

- [ ] **Step 33: Commit**

```bash
git add packages/core/src/email/constants.ts packages/core/src/email/constants.test.ts \
  packages/core/src/email/index.ts \
  packages/core/src/services/channels/email.ts \
  packages/core/src/services/channels/email-barrel.test.ts \
  packages/core/src/services/channels/email-parse.ts \
  packages/core/src/services/channels/email-parse.test.ts \
  packages/core/src/services/channels/email-outbound.ts \
  packages/core/src/services/channels/email-format.ts \
  packages/core/src/services/channels/email-format.test.ts \
  packages/core/src/services/webhook-failures.ts \
  packages/core/src/services/webhook-failures.test.ts \
  packages/core/src/cron/webhook-failures.ts \
  packages/core/src/cron/webhook-failures.test.ts \
  packages/core/src/cron/index.ts packages/core/src/cron/index.test.ts \
  "apps/admin/src/app/(staff)/enquiries/actions.ts" \
  "apps/admin/src/app/(staff)/enquiries/actions.test.ts"
git commit -m "$(cat <<'EOF'
refactor(core): phase-2 hardening — split the email channel, prune webhook failures, strict attachment budget

Splits channels/email.ts into email-parse/email-outbound behind a re-export
barrel; prunes WebhookFailure rows past 90 days in the hourly cron; makes the
16 MB inline-attachment budget bound the work done, not just what is stored;
collapses the duplicated default From into email/constants.ts; drops the second
enquiry read in replyToEnquiry; validates INBOUND_EMAIL_DOMAIN (warn once);
decodes numeric HTML entities; adds parseAuthenticationResults.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 2: Migration `20260909100000_meta_channels` + `senderVerified` / `connectionId`

**Files:**
- Modify: `packages/core/prisma/schema.prisma`, `packages/core/src/services/enquiry-messages.ts`, `packages/core/src/services/enquiry-messages.test.ts`, `packages/core/src/services/channels/email-parse.ts`, `packages/core/src/services/channels/email-parse.test.ts`, `packages/core/src/services/channels/email-outbound.ts`, `packages/core/src/services/channels/email-inbound.ts`, `packages/core/src/services/channels/email-inbound.test.ts`
- Create: `packages/core/prisma/migrations/20260909100000_meta_channels/migration.sql`

**Verified against the live schema before writing (do not re-derive):** `CustomerIdentity`, `MessageChannelKind.messenger`, `MessageChannelKind.instagram`, `EnquiryChannel.messenger` and `EnquiryChannel.instagram` **already exist** from Phase 1's `20260907130000_enquiry_threads`. This migration therefore contains **no enum changes** — only one new table and two new nullable columns.

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
    messageIdHeader?: string | null;
    deliveryStatus?: MessageStatus;
    attachments?: StoreAttachmentInput[];
    at?: Date;
  }
  export interface ThreadMessageRow {
    id: string; enquiryId: string; direction: MessageDirection;
    channel: MessageChannelKind; authorUserId: string | null;
    authorName: string | null; fromName: string | null;
    fromAddress: string | null; subject: string | null; bodyText: string;
    deliveryStatus: MessageStatus; createdAt: Date;
    attachments: ThreadAttachment[];
  }
  export async function recordInbound(input: RecordMessageInput): Promise<ThreadMessageRow>
  export async function recordOutbound(input: RecordMessageInput & { authorUserId?: string | null }): Promise<ThreadMessageRow>
  export async function listThread(enquiryId: string): Promise<ThreadMessageRow[]>
  ```
- Produces:
  ```prisma
  model ChannelConnection {
    id String @id @default(cuid())
    channel MessageChannelKind
    externalId String @unique
    pageId String
    igAccountId String?
    name String
    accessToken String            // "v1:<iv>:<tag>:<ct>" — never plaintext
    active Boolean @default(true)
    webhookSubscribedAt DateTime?
    lastEventAt DateTime?
    connectedAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    messages EnquiryMessage[]
    @@index([channel, active])
    @@index([pageId])
  }
  // EnquiryMessage gains: senderVerified Boolean?  ·  connectionId String?
  ```
  ```ts
  // enquiry-messages.ts
  RecordMessageInput gains: senderVerified?: boolean | null; connectionId?: string | null;
  ThreadMessageRow  gains: senderVerified: boolean | null;

  // channels/email-parse.ts
  ParsedInboundEmail gains: senderVerified: boolean | null;

  // channels/email-outbound.ts
  EnquiryEmailContext gains: lastInboundFromAddress: string | null; lastInboundConnectionId: string | null;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/services/enquiry-messages.test.ts` (a DB suite — it already imports `testDb`, `dbReachable`, `uid` and has a helper that creates a customer + enquiry; reuse them, and if the helper is named differently in that file use the existing one rather than adding a second):

```ts
describe("sender authentication + channel connection on a message", () => {
  it("persists senderVerified and surfaces it on the thread row", async () => {
    if (!(await dbReachable())) return;
    const { enquiryId, customerId } = await seedEnquiry();

    const unverified = await recordInbound({
      enquiryId,
      customerId,
      channel: "email",
      bodyText: "Is this really you?",
      externalId: uid("ext"),
      senderVerified: false,
    });
    expect(unverified.senderVerified).toBe(false);

    // Unknown (web, Meta) stays null rather than defaulting to "unverified".
    const unknown = await recordInbound({
      enquiryId,
      customerId,
      channel: "web",
      bodyText: "From the site",
      externalId: uid("ext"),
    });
    expect(unknown.senderVerified).toBeNull();

    const thread = await listThread(enquiryId);
    expect(thread.map((m) => m.senderVerified)).toEqual(
      expect.arrayContaining([false, null]),
    );
  });

  it("stores the connection a Meta message arrived on", async () => {
    if (!(await dbReachable())) return;
    const db = testDb();
    const { enquiryId, customerId } = await seedEnquiry();
    const pageId = uid("page");
    const connection = await db.channelConnection.create({
      data: {
        channel: "messenger",
        externalId: pageId,
        pageId,
        name: "Boots 'n' Bandit",
        accessToken: "v1:enc",
      },
      select: { id: true },
    });

    const row = await recordInbound({
      enquiryId,
      customerId,
      channel: "messenger",
      bodyText: "hiya",
      fromAddress: "7213456789012345",
      externalId: uid("mid"),
      connectionId: connection.id,
    });

    const stored = await db.enquiryMessage.findUnique({
      where: { id: row.id },
      select: { connectionId: true, fromAddress: true },
    });
    expect(stored).toEqual({
      connectionId: connection.id,
      fromAddress: "7213456789012345",
    });

    await db.enquiryMessage.deleteMany({ where: { enquiryId } });
    await db.channelConnection.delete({ where: { id: connection.id } });
  });
});
```

Append to `packages/core/src/services/channels/email-parse.test.ts` (the `email()` / `ResendInboundDeps` helpers from Task 1(c) are already in this file):

```ts
describe("sender verification on the parsed email", () => {
  async function parseWith(headers: Record<string, string>) {
    const deps: ResendInboundDeps = {
      async getEmail() {
        return { ...email([]), headers };
      },
      async listAttachments() {
        return [];
      },
      async download() {
        return null;
      },
    };
    return parseResendInbound(
      { type: "email.received", data: { email_id: "em_budget_1" } },
      deps,
    );
  }

  it("carries the Authentication-Results verdict through", async () => {
    const parsed = await parseWith({
      "Authentication-Results":
        "mx.resend.com; spf=pass; dkim=pass; dmarc=pass header.from=example.test",
    });
    expect(parsed.senderVerified).toBe(true);
  });

  it("is false when the MTA says the checks did not pass", async () => {
    const parsed = await parseWith({
      "Authentication-Results": "mx.resend.com; spf=fail; dkim=none",
    });
    expect(parsed.senderVerified).toBe(false);
  });

  it("is null when the MTA said nothing", async () => {
    const parsed = await parseWith({});
    expect(parsed.senderVerified).toBeNull();
  });
});
```

Append to `packages/core/src/services/channels/email-inbound.test.ts` (it already mocks `parseResendInbound` and `recordInbound` and defines a `PARSED` fixture; reuse both):

```ts
it("passes the sender-authentication verdict to recordInbound", async () => {
  parseResendInbound.mockResolvedValue({ ...PARSED, senderVerified: false });
  await ingestResendEvent(EVENT, DEPS);
  expect(recordInbound.mock.calls[0][0]).toMatchObject({
    senderVerified: false,
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts src/services/channels`
Expected: FAIL — `Unknown argument 'senderVerified'` from Prisma (DB cases) and `expected undefined to be true` for the parse cases.

- [ ] **Step 3: Edit the schema**

In `packages/core/prisma/schema.prisma`, add two fields to `EnquiryMessage` (after `messageIdHeader`):

```prisma
  // Did the receiving MTA authenticate the sender (DMARC, or SPF+DKIM)?
  // null = unknown, which is what every web and Meta message records: those
  // channels authenticate the account, not a header. Never used to drop mail.
  senderVerified Boolean?
  // The Meta Page/IG connection this message arrived on (or went out on).
  // A reply has to reach the SAME page the customer wrote to, and a customer
  // can move channels inside one thread — so the routing fact belongs to the
  // message, not the enquiry.
  connectionId   String?
```

add to its relation block:

```prisma
  connection  ChannelConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)
```

and add an index alongside the existing two:

```prisma
  @@index([connectionId])
```

Add the new model immediately after `CustomerIdentity`:

```prisma
// One connected Meta destination: a Facebook Page (channel = messenger) or
// the Instagram business account linked to it (channel = instagram). Both
// rows carry the SAME encrypted page access token, because Instagram
// Messaging is served by the page's /messages endpoint.
//
//   externalId  what Meta's webhook addresses this row by — the page id for
//               messenger, the IG business account id for instagram (unique)
//   pageId      the Page whose token authorises sends; == externalId for a
//               messenger row, the owning page for an instagram row
//   igAccountId the linked IG business account id, on both rows when there is
//               one (null on a page with no linked professional account)
model ChannelConnection {
  id                  String             @id @default(cuid())
  channel             MessageChannelKind
  externalId          String             @unique
  pageId              String
  igAccountId         String?
  name                String
  // AES-256-GCM, "v1:<iv>:<tag>:<ct>" (services/secrets.ts). NEVER plaintext,
  // never selected onto a page prop, never logged.
  accessToken         String
  active              Boolean            @default(true)
  webhookSubscribedAt DateTime?
  lastEventAt         DateTime?
  connectedAt         DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  messages EnquiryMessage[]

  @@index([channel, active])
  @@index([pageId])
}
```

- [ ] **Step 4: Write the migration by hand**

Create `packages/core/prisma/migrations/20260909100000_meta_channels/migration.sql`:

```sql
-- Phase 3: Meta channels.
-- Additive only. MessageChannelKind already has `messenger` and `instagram`,
-- and so does EnquiryChannel (Phase 1, 20260907130000_enquiry_threads), so
-- there is deliberately no ALTER TYPE here — re-adding a value would fail.

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "igAccountId" TEXT,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "webhookSubscribedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_externalId_key" ON "ChannelConnection"("externalId");
CREATE INDEX "ChannelConnection_channel_active_idx" ON "ChannelConnection"("channel", "active");
CREATE INDEX "ChannelConnection_pageId_idx" ON "ChannelConnection"("pageId");

-- AlterTable
ALTER TABLE "EnquiryMessage" ADD COLUMN "senderVerified" BOOLEAN;
ALTER TABLE "EnquiryMessage" ADD COLUMN "connectionId" TEXT;

-- CreateIndex
CREATE INDEX "EnquiryMessage_connectionId_idx" ON "EnquiryMessage"("connectionId");

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

**Ledger note (carried from the Phase-2 migration — it bit us once already):** the timestamp `20260909100000` is hand-picked so this sorts after `20260908120000_email_channel`. If `prisma migrate dev` generates its own directory instead, **rename the generated directory to `20260909100000_meta_channels`**, and on any database that already applied it under the generated name reconcile the ledger before the next deploy:

```bash
set -a && . ./.env && set +a
psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET migration_name = '20260909100000_meta_channels' WHERE migration_name LIKE '%\_meta\_channels';"
```

A mismatch between the directory name and the `_prisma_migrations` row makes `prisma migrate deploy` re-run the migration on the next deploy, which then fails on `CREATE TABLE "ChannelConnection"` already existing. If that has already happened in production, resolve it rather than editing SQL:

```bash
npx prisma migrate resolve --applied 20260909100000_meta_channels \
  --schema=packages/core/prisma/schema.prisma
```

- [ ] **Step 5: Apply the migration and regenerate the client**

```bash
docker compose up -d
npm -w @bnb/core run db:migrate
npm run db:generate
```

Expected: `20260909100000_meta_channels` applied; `prisma.channelConnection` exists on the generated client.

- [ ] **Step 6: Plumb the new fields**

`packages/core/src/services/enquiry-messages.ts` — in `RecordMessageInput`, after `messageIdHeader`:

```ts
  /**
   * Whether the receiving MTA authenticated the sender (email only).
   * null/undefined = unknown, which is correct for web and Meta traffic.
   */
  senderVerified?: boolean | null;
  /** The ChannelConnection a Meta message arrived on / went out on. */
  connectionId?: string | null;
```

in `MESSAGE_SELECT` add `senderVerified: true,` — a boolean is free, and the inbox badges it. `connectionId` is deliberately **not** selected: no render path needs it, and the reply path reads it through `ENQUIRY_EMAIL_CONTEXT_SELECT` instead.

in `ThreadMessageRow` after `deliveryStatus`:

```ts
  senderVerified: boolean | null;
```

in `toRow()` after `deliveryStatus`:

```ts
    senderVerified: raw.senderVerified,
```

in `createMessage()`'s `data` block after `messageIdHeader`:

```ts
        senderVerified: input.senderVerified ?? null,
        connectionId: input.connectionId ?? null,
```

`packages/core/src/services/channels/email-parse.ts` — add to `ParsedInboundEmail`:

```ts
  /** MTA verdict on the sender: true/false, or null when no header said. */
  senderVerified: boolean | null;
```

import `parseAuthenticationResults` from `./email-format` and add to the returned object:

```ts
    senderVerified: parseAuthenticationResults(email.headers),
```

`packages/core/src/services/channels/email-inbound.ts` — inside the `recordInbound` call:

```ts
    senderVerified: parsed.senderVerified,
```

`packages/core/src/services/channels/email-outbound.ts` — `ENQUIRY_EMAIL_CONTEXT_SELECT`'s `messages.select` gains `connectionId: true,`; `EnquiryEmailContext` gains:

```ts
  /** PSID/IGSID (Meta) or email address of the last inbound message. */
  lastInboundFromAddress: string | null;
  /** ChannelConnection the last inbound message arrived on, when Meta. */
  lastInboundConnectionId: string | null;
```

and `toEnquiryEmailContext()` returns, additionally:

```ts
    lastInboundFromAddress: last?.fromAddress ?? null,
    lastInboundConnectionId: last?.connectionId ?? null,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @bnb/core -- src/services`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/prisma/schema.prisma \
  packages/core/prisma/migrations/20260909100000_meta_channels/migration.sql \
  packages/core/src/services/enquiry-messages.ts \
  packages/core/src/services/enquiry-messages.test.ts \
  packages/core/src/services/channels/email-parse.ts \
  packages/core/src/services/channels/email-parse.test.ts \
  packages/core/src/services/channels/email-outbound.ts \
  packages/core/src/services/channels/email-inbound.ts \
  packages/core/src/services/channels/email-inbound.test.ts
git commit -m "$(cat <<'EOF'
feat(core): ChannelConnection + per-message sender verification and connection

Adds the ChannelConnection table (encrypted page token, page/IG ids, webhook
subscription + last-event timestamps) and two nullable EnquiryMessage columns:
senderVerified (the inbound MTA's DMARC/SPF+DKIM verdict, null = unknown) and
connectionId (which Meta connection a message arrived on, so a reply reaches
the same Page). No enum changes — messenger/instagram already exist.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 3: `secrets.ts` + `channel-connections.ts`

**Files:**
- Create: `packages/core/src/services/secrets.ts`, `packages/core/src/services/secrets.test.ts`, `packages/core/src/services/channel-connections.ts`, `packages/core/src/services/channel-connections.test.ts`
- Modify: `packages/core/src/services/index.ts`

**Interfaces:**
- Consumes: the `ChannelConnection` model from Task 2; the `testdb` harness (`testDb`, `dbReachable`, `closeTestDb`, `uid`); `SESSION_SECRET`, which `packages/core/src/auth/session.ts` already derives its own key from with `hkdfSync("sha256", secret, new Uint8Array(0), "bb_session_enc_key_v1", 32)` — a **different** salt and info, so the two keys are unrelated by construction.
- Produces:
  ```ts
  // packages/core/src/services/secrets.ts
  export const SECRET_ENVELOPE_VERSION = "v1";
  export const MIN_SESSION_SECRET_CHARS = 32;
  export class SecretConfigError extends Error {}
  export function encryptSecret(plaintext: string, env?: NodeJS.ProcessEnv): string;
  export function decryptSecret(envelope: string, env?: NodeJS.ProcessEnv): string;
  export function isEncryptedSecret(value: string | null | undefined): boolean;

  // packages/core/src/services/channel-connections.ts
  export type MetaChannel = "messenger" | "instagram";
  export interface ChannelConnectionRow {
    id: string; channel: MetaChannel; externalId: string; pageId: string;
    igAccountId: string | null; name: string; active: boolean;
    webhookSubscribedAt: Date | null; lastEventAt: Date | null; connectedAt: Date;
  }
  export interface MetaConnection extends ChannelConnectionRow { accessToken: string }
  export interface UpsertChannelConnectionInput {
    channel: MetaChannel; externalId: string; pageId: string;
    igAccountId?: string | null; name: string; accessToken: string;
    webhookSubscribedAt?: Date | null;
  }
  export async function upsertChannelConnection(input: UpsertChannelConnectionInput): Promise<ChannelConnectionRow>;
  export async function listChannelConnections(): Promise<ChannelConnectionRow[]>;
  export async function findConnectionByExternalId(externalId: string): Promise<MetaConnection | null>;
  export async function getConnection(id: string): Promise<MetaConnection | null>;
  export async function touchConnectionEvent(id: string, at?: Date): Promise<void>;
  export async function deleteConnection(id: string): Promise<number>;
  ```

- [ ] **Step 1: Write the failing test for `secrets.ts`**

Create `packages/core/src/services/secrets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  SecretConfigError,
  SECRET_ENVELOPE_VERSION,
} from "./secrets";

/**
 * Meta page tokens are long-lived credentials that can read and send a
 * studio's DMs. They are stored encrypted so a database dump — a backup, a
 * pg_dump pasted into a support ticket, a read replica — is not a set of live
 * tokens. The key comes from SESSION_SECRET, which the deployment already
 * treats as the crown jewel: one secret to rotate, not two.
 */
const ENV = {
  SESSION_SECRET: "0123456789abcdef0123456789abcdef0123456789",
} as NodeJS.ProcessEnv;

const TOKEN = "EAAG_synthetic_page_token_for_tests_only_0000";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", () => {
    expect(decryptSecret(encryptSecret(TOKEN, ENV), ENV)).toBe(TOKEN);
  });

  it("never leaks the plaintext into the envelope", () => {
    const envelope = encryptSecret(TOKEN, ENV);
    expect(envelope).not.toContain(TOKEN);
    expect(envelope).not.toContain("synthetic");
  });

  it("uses a fresh IV every time, so the same token never encrypts alike", () => {
    expect(encryptSecret(TOKEN, ENV)).not.toBe(encryptSecret(TOKEN, ENV));
  });

  it("is a versioned four-part envelope", () => {
    const parts = encryptSecret(TOKEN, ENV).split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(SECRET_ENVELOPE_VERSION);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(12); // IV
    expect(Buffer.from(parts[2], "base64")).toHaveLength(16); // GCM tag
  });

  it("refuses a tampered ciphertext instead of returning garbage", () => {
    const [v, iv, tag, ct] = encryptSecret(TOKEN, ENV).split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    expect(() =>
      decryptSecret(`${v}:${iv}:${tag}:${flipped.toString("base64")}`, ENV),
    ).toThrow();
  });

  it("refuses a malformed or unversioned envelope", () => {
    expect(() => decryptSecret("v1:only:three", ENV)).toThrow();
    expect(() => decryptSecret("v2:a:b:c", ENV)).toThrow();
  });

  it("refuses to encrypt under a short or absent SESSION_SECRET", () => {
    expect(() =>
      encryptSecret(TOKEN, { SESSION_SECRET: "tooshort" } as NodeJS.ProcessEnv),
    ).toThrow(SecretConfigError);
    expect(() => encryptSecret(TOKEN, {} as NodeJS.ProcessEnv)).toThrow(
      SecretConfigError,
    );
  });

  it("does not decrypt under a different secret", () => {
    const envelope = encryptSecret(TOKEN, ENV);
    expect(() =>
      decryptSecret(envelope, {
        SESSION_SECRET: "ffffffffffffffffffffffffffffffffffffffff",
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("recognises its own envelopes and nothing else", () => {
    expect(isEncryptedSecret(encryptSecret(TOKEN, ENV))).toBe(true);
    expect(isEncryptedSecret(TOKEN)).toBe(false);
    expect(isEncryptedSecret(null)).toBe(false);
    expect(isEncryptedSecret("v1:only:three")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/secrets.test.ts`
Expected: FAIL — `Failed to resolve import "./secrets"`.

- [ ] **Step 3: Implement `secrets.ts`**

```ts
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Symmetric encryption for credentials we must be able to USE again — today
 * only `ChannelConnection.accessToken` (a Meta page token). Hashing is not an
 * option: we have to present the token to Graph.
 *
 * AES-256-GCM, because it authenticates as well as encrypts: a tampered row
 * fails to decrypt instead of yielding a plausible-looking wrong token. The
 * key is HKDF-SHA256 over SESSION_SECRET with a channel-specific salt and
 * info, so it is cryptographically unrelated to the session-cookie key
 * derived in auth/session.ts even though both come from the same secret.
 *
 * Envelope: `v1:<iv b64>:<tag b64>:<ciphertext b64>` — versioned so a future
 * scheme can be introduced without having to guess at old rows.
 *
 * node:crypto only. No new dependency, and nothing here touches the database.
 */

export const SECRET_ENVELOPE_VERSION = "v1";

/**
 * 32 chars, deliberately stricter than auth/session.ts's 16. A session cookie
 * is short-lived and revocable; a page token is a long-lived credential to
 * someone else's inbox and is not worth protecting with a weak key.
 */
export const MIN_SESSION_SECRET_CHARS = 32;

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT = "bnb-channel-token";
const INFO = "ChannelConnection.accessToken";

/** SESSION_SECRET is missing or too weak — a configuration fault, not a bug. */
export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretConfigError";
  }
}

function deriveKey(env: NodeJS.ProcessEnv): Buffer {
  const secret = env.SESSION_SECRET?.trim();
  if (!secret || secret.length < MIN_SESSION_SECRET_CHARS) {
    throw new SecretConfigError(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_CHARS} characters to store channel tokens.`,
    );
  }
  return Buffer.from(hkdfSync("sha256", secret, SALT, INFO, 32));
}

export function encryptSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = deriveKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    SECRET_ENVELOPE_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(
  envelope: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== SECRET_ENVELOPE_VERSION) {
    throw new Error("Unrecognised secret envelope");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed secret envelope");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(env), iv);
  decipher.setAuthTag(tag);
  // .final() throws when the tag does not verify, so a tampered row or a
  // rotated secret fails loudly rather than returning a wrong token.
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cheap shape check — does NOT prove the envelope decrypts. */
export function isEncryptedSecret(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 4 && parts[0] === SECRET_ENVELOPE_VERSION;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/secrets.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 5: Write the failing test for `channel-connections.ts`**

Create `packages/core/src/services/channel-connections.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";
import {
  deleteConnection,
  findConnectionByExternalId,
  getConnection,
  listChannelConnections,
  touchConnectionEvent,
  upsertChannelConnection,
} from "./channel-connections";

/**
 * The ONE module that decrypts a page token. Everything else — the panel, the
 * webhook route, the send path — takes what this returns, so the encryption
 * boundary is a single file wide and a page component physically cannot leak
 * a token: the type it is handed has no such field.
 */
const PAGE_ID = uid("page");
const IG_ID = uid("ig");
const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789";
});

afterAll(async () => {
  if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SECRET;
  if (await dbReachable()) {
    await testDb().channelConnection.deleteMany({
      where: { externalId: { in: [PAGE_ID, IG_ID] } },
    });
  }
  await closeTestDb();
});

describe("channel connections", () => {
  it("stores the token encrypted and hands it back decrypted", async () => {
    if (!(await dbReachable())) return;
    const row = await upsertChannelConnection({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      igAccountId: IG_ID,
      name: "Boots 'n' Bandit",
      accessToken: "EAAG_synthetic_page_token",
    });
    expect(row).toMatchObject({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      igAccountId: IG_ID,
      active: true,
    });
    // The listing shape carries no token at all — it is what the panel renders.
    expect(row).not.toHaveProperty("accessToken");

    const stored = await testDb().channelConnection.findUnique({
      where: { externalId: PAGE_ID },
      select: { accessToken: true },
    });
    expect(stored?.accessToken).not.toContain("EAAG_synthetic_page_token");
    expect(stored?.accessToken.startsWith("v1:")).toBe(true);

    const live = await findConnectionByExternalId(PAGE_ID);
    expect(live?.accessToken).toBe("EAAG_synthetic_page_token");
    expect(await getConnection(live!.id)).toMatchObject({
      accessToken: "EAAG_synthetic_page_token",
    });
  });

  it("re-connecting the same page replaces the token and reactivates it", async () => {
    if (!(await dbReachable())) return;
    const first = await findConnectionByExternalId(PAGE_ID);
    await testDb().channelConnection.update({
      where: { id: first!.id },
      data: { active: false },
    });

    await upsertChannelConnection({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      name: "Boots 'n' Bandit (renamed)",
      accessToken: "EAAG_second_token",
      webhookSubscribedAt: new Date("2026-09-08T09:00:00Z"),
    });

    const again = await findConnectionByExternalId(PAGE_ID);
    expect(again).toMatchObject({
      id: first!.id,
      name: "Boots 'n' Bandit (renamed)",
      active: true,
      accessToken: "EAAG_second_token",
    });
    expect(again?.webhookSubscribedAt?.toISOString()).toBe(
      "2026-09-08T09:00:00.000Z",
    );
  });

  it("records the last event seen", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    await touchConnectionEvent(row!.id, new Date("2026-09-08T11:22:33Z"));
    const mine = (await listChannelConnections()).find(
      (c) => c.externalId === PAGE_ID,
    );
    expect(mine?.lastEventAt?.toISOString()).toBe("2026-09-08T11:22:33.000Z");
  });

  it("returns null for an unknown page rather than throwing", async () => {
    if (!(await dbReachable())) return;
    expect(await findConnectionByExternalId("not-a-page")).toBeNull();
    expect(await getConnection("not-an-id")).toBeNull();
  });

  it("survives an undecryptable token instead of taking the inbox down", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    await testDb().channelConnection.update({
      where: { id: row!.id },
      data: { accessToken: "v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA" },
    });
    expect(await findConnectionByExternalId(PAGE_ID)).toBeNull();
    // The row is still LISTED, so the panel can tell the owner to reconnect.
    expect(
      (await listChannelConnections()).some((c) => c.externalId === PAGE_ID),
    ).toBe(true);
  });

  it("deletes a connection idempotently", async () => {
    if (!(await dbReachable())) return;
    const row = await testDb().channelConnection.findUnique({
      where: { externalId: PAGE_ID },
      select: { id: true },
    });
    expect(await deleteConnection(row!.id)).toBe(1);
    expect(await deleteConnection(row!.id)).toBe(0);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channel-connections.test.ts`
Expected: FAIL — `Failed to resolve import "./channel-connections"`.

- [ ] **Step 7: Implement `channel-connections.ts`**

```ts
import { prisma } from "@bnb/core/db";
import { decryptSecret, encryptSecret } from "./secrets";

/**
 * `ChannelConnection` CRUD, and the one and only place a page token is
 * encrypted or decrypted.
 *
 * Two shapes on purpose:
 *   ChannelConnectionRow — no token. Everything a screen renders.
 *   MetaConnection       — row + decrypted token. Only the send path and the
 *                          Graph calls ask for it.
 */

export type MetaChannel = "messenger" | "instagram";

export interface ChannelConnectionRow {
  id: string;
  channel: MetaChannel;
  externalId: string;
  pageId: string;
  igAccountId: string | null;
  name: string;
  active: boolean;
  webhookSubscribedAt: Date | null;
  lastEventAt: Date | null;
  connectedAt: Date;
}

export interface MetaConnection extends ChannelConnectionRow {
  /** Decrypted page access token. Never render it, never log it. */
  accessToken: string;
}

const ROW_SELECT = {
  id: true,
  channel: true,
  externalId: true,
  pageId: true,
  igAccountId: true,
  name: true,
  active: true,
  webhookSubscribedAt: true,
  lastEventAt: true,
  connectedAt: true,
} as const;

interface RawRow {
  id: string;
  channel: string;
  externalId: string;
  pageId: string;
  igAccountId: string | null;
  name: string;
  active: boolean;
  webhookSubscribedAt: Date | null;
  lastEventAt: Date | null;
  connectedAt: Date;
}

function toRow(raw: RawRow): ChannelConnectionRow {
  return { ...raw, channel: raw.channel as MetaChannel };
}

export interface UpsertChannelConnectionInput {
  channel: MetaChannel;
  externalId: string;
  pageId: string;
  igAccountId?: string | null;
  name: string;
  /** PLAINTEXT token; encrypted before it reaches the database. */
  accessToken: string;
  webhookSubscribedAt?: Date | null;
}

/**
 * Connect (or re-connect) one Page / IG account. Re-connecting is the normal
 * repair path — a token expired, permissions changed — so it replaces the
 * token, refreshes the name, and always sets `active` back to true.
 */
export async function upsertChannelConnection(
  input: UpsertChannelConnectionInput,
): Promise<ChannelConnectionRow> {
  const shared = {
    channel: input.channel,
    pageId: input.pageId,
    igAccountId: input.igAccountId ?? null,
    name: input.name,
    accessToken: encryptSecret(input.accessToken),
    active: true,
    ...(input.webhookSubscribedAt !== undefined
      ? { webhookSubscribedAt: input.webhookSubscribedAt }
      : {}),
  };
  const row = await prisma.channelConnection.upsert({
    where: { externalId: input.externalId },
    create: { externalId: input.externalId, ...shared },
    update: shared,
    select: ROW_SELECT,
  });
  return toRow(row as RawRow);
}

/** Everything the Channels panel lists. Never selects the token column. */
export async function listChannelConnections(): Promise<ChannelConnectionRow[]> {
  const rows = await prisma.channelConnection.findMany({
    orderBy: [{ connectedAt: "desc" }, { id: "desc" }],
    select: ROW_SELECT,
  });
  return rows.map((row) => toRow(row as RawRow));
}

/**
 * A token that will not decrypt (SESSION_SECRET rotated, row corrupted) is
 * reported as "no usable connection" rather than thrown: an inbound webhook
 * must not 500 because a credential went stale, and `listChannelConnections`
 * still shows the row so the owner is told to reconnect.
 */
function withToken(
  raw: (RawRow & { accessToken: string }) | null,
): MetaConnection | null {
  if (!raw) return null;
  const { accessToken, ...rest } = raw;
  try {
    return { ...toRow(rest), accessToken: decryptSecret(accessToken) };
  } catch (err) {
    console.error(
      `[channels] connection ${raw.id} has an unreadable access token — reconnect the Page:`,
      err,
    );
    return null;
  }
}

/** By the id Meta addresses it with: page id (messenger) / IG id (instagram). */
export async function findConnectionByExternalId(
  externalId: string,
): Promise<MetaConnection | null> {
  const raw = await prisma.channelConnection.findFirst({
    where: { externalId, active: true },
    select: { ...ROW_SELECT, accessToken: true },
  });
  return withToken(raw as (RawRow & { accessToken: string }) | null);
}

export async function getConnection(id: string): Promise<MetaConnection | null> {
  const raw = await prisma.channelConnection.findUnique({
    where: { id },
    select: { ...ROW_SELECT, accessToken: true },
  });
  return withToken(raw as (RawRow & { accessToken: string }) | null);
}

/** "Last event received" on the Channels panel — the liveness signal. */
export async function touchConnectionEvent(
  id: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.channelConnection.updateMany({
    where: { id },
    data: { lastEventAt: at },
  });
}

/** Disconnect. Messages keep their history — the FK is SetNull. */
export async function deleteConnection(id: string): Promise<number> {
  const res = await prisma.channelConnection.deleteMany({ where: { id } });
  return res.count;
}
```

Add to `packages/core/src/services/index.ts`:

```ts
export * from "./channel-connections";
```

(`secrets.ts` stays out of the barrel — importing crypto helpers should be a deliberate act.)

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channel-connections.test.ts src/services/secrets.test.ts`
Expected: PASS. DB cases return early when Postgres is down; bring it up with `docker compose up -d` to exercise them.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/services/secrets.ts packages/core/src/services/secrets.test.ts \
  packages/core/src/services/channel-connections.ts \
  packages/core/src/services/channel-connections.test.ts \
  packages/core/src/services/index.ts
git commit -m "$(cat <<'EOF'
feat(core): encrypted channel tokens — secrets.ts + channel-connections.ts

AES-256-GCM under an HKDF-SHA256 key derived from SESSION_SECRET (salt
"bnb-channel-token", info "ChannelConnection.accessToken"), envelope
v1:<iv>:<tag>:<ct>, node:crypto only, refusing a SESSION_SECRET under 32 chars.
channel-connections.ts is the single decryption boundary: the listing shape
carries no token at all, and an undecryptable row degrades to "reconnect the
Page" rather than taking the inbox down.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 4: `channels/meta.ts` — signature, hub challenge, `parseMetaWebhook`, fixtures

The pure half of the Meta channel: no Prisma, no network, no env beyond two explicit lookups. Everything here is unit-testable with a string and a JSON fixture.

**Files:**
- Create: `packages/core/src/services/channels/meta.ts`, `packages/core/src/services/channels/meta.test.ts`, `packages/core/src/services/channels/__fixtures__/meta-messenger-text.json`, `meta-messenger-image.json`, `meta-instagram-text.json`, `meta-echo.json`, `meta-delivery.json`, `meta-postback.json`

**Interfaces:**
- Consumes: `node:crypto` (`createHmac`, `timingSafeEqual`) only. Nothing from earlier tasks.
- Produces:
  ```ts
  export const META_SIGNATURE_HEADER = "x-hub-signature-256";
  export function signMetaPayload(appSecret: string, payload: string): string;   // "sha256=<hex>"
  export type MetaVerification =
    | { ok: true }
    | { ok: false; reason: "no_secret" | "missing_header" | "bad_format" | "no_match" };
  export function verifyMetaSignature(input: { appSecret: string; payload: string; header: string | null | undefined }): MetaVerification;

  export type HubChallengeResult =
    | { ok: true; challenge: string }
    | { ok: false; reason: "not_configured" | "bad_mode" | "bad_token" | "no_challenge" };
  export function verifyHubChallenge(params: URLSearchParams, verifyToken: string | null | undefined): HubChallengeResult;

  export type MetaChannelKind = "messenger" | "instagram";
  export interface MetaAttachment { type: string; url: string | null }
  export interface MetaMessagingEvent {
    object: "page" | "instagram";
    channel: MetaChannelKind;
    entryId: string;
    entryTime: number;
    senderId: string;
    recipientId: string;
    /** The customer's PSID/IGSID whichever side of an echo we are on. */
    customerId: string;
    timestamp: Date;
    mid: string | null;
    text: string | null;
    isEcho: boolean;
    attachments: MetaAttachment[];
    kind: "message" | "postback" | "receipt" | "unknown";
    raw: unknown;
  }
  export function parseMetaWebhook(body: unknown): MetaMessagingEvent[];
  export function singleEventBody(event: MetaMessagingEvent): unknown;

  export const META_ATTACHMENT_HOST_SUFFIXES: readonly string[];
  export const META_ATTACHMENT_HOSTS: readonly string[];
  export function isAllowedMetaAttachmentUrl(url: string | null | undefined): boolean;

  export const MAX_META_MESSAGE_CHARS = 2000;
  export function splitOutboundText(text: string, limit?: number): string[];

  export const DEFAULT_META_GRAPH_VERSION = "v21.0";
  export function metaGraphVersion(env?: NodeJS.ProcessEnv): string;
  export function metaGraphUrl(path: string, env?: NodeJS.ProcessEnv): string;

  export const META_SEND_WINDOW_MS = 86_400_000;
  export class MetaWindowClosedError extends Error { readonly channel: MetaChannelKind }
  export function isWithinSendWindow(lastInboundAt: Date | null | undefined, now?: Date): boolean;
  export function isWindowGraphError(error: unknown): boolean;
  ```

- [ ] **Step 1: Write the fixtures**

`packages/core/src/services/channels/__fixtures__/meta-messenger-text.json` — synthetic ids only:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "102938475610293",
      "time": 1788000000000,
      "messaging": [
        {
          "sender": { "id": "7213456789012345" },
          "recipient": { "id": "102938475610293" },
          "timestamp": 1788000000000,
          "message": {
            "mid": "m_AbC0dEf1GhI2jKl3MnO4pQ",
            "text": "Hiya, do you have any space for a small linework piece?"
          }
        }
      ]
    }
  ]
}
```

`meta-messenger-image.json`:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "102938475610293",
      "time": 1788000100000,
      "messaging": [
        {
          "sender": { "id": "7213456789012345" },
          "recipient": { "id": "102938475610293" },
          "timestamp": 1788000100000,
          "message": {
            "mid": "m_ZzY9xW8vU7tS6rQ5pO4nM",
            "text": "reference",
            "attachments": [
              {
                "type": "image",
                "payload": {
                  "url": "https://scontent.xx.fbcdn.net/v/t1.0-9/synthetic-reference.jpg"
                }
              },
              {
                "type": "file",
                "payload": {
                  "url": "https://lookaside.fbsbx.com/synthetic/brief.pdf"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

`meta-instagram-text.json`:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000000",
      "time": 1788000200000,
      "messaging": [
        {
          "sender": { "id": "6011223344556677" },
          "recipient": { "id": "17841400000000000" },
          "timestamp": 1788000200000,
          "message": {
            "mid": "aWdfZG1fMTppbnN0YWdyYW0tc3ludGhldGlj",
            "text": "Saw your flash sheet — is the moth still available?"
          }
        }
      ]
    }
  ]
}
```

`meta-echo.json` — staff replied from the Meta inbox, so sender is the page:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "102938475610293",
      "time": 1788000300000,
      "messaging": [
        {
          "sender": { "id": "102938475610293" },
          "recipient": { "id": "7213456789012345" },
          "timestamp": 1788000300000,
          "message": {
            "mid": "m_EcHo1EcHo2EcHo3EcHo4E",
            "is_echo": true,
            "text": "Yes! Sarah has space in October — shall I book you a consult?"
          }
        }
      ]
    }
  ]
}
```

`meta-delivery.json`:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "102938475610293",
      "time": 1788000400000,
      "messaging": [
        {
          "sender": { "id": "7213456789012345" },
          "recipient": { "id": "102938475610293" },
          "timestamp": 1788000400000,
          "delivery": { "mids": ["m_EcHo1EcHo2EcHo3EcHo4E"], "watermark": 1788000399000 }
        },
        {
          "sender": { "id": "7213456789012345" },
          "recipient": { "id": "102938475610293" },
          "timestamp": 1788000401000,
          "read": { "watermark": 1788000400000 }
        }
      ]
    }
  ]
}
```

`meta-postback.json`:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "102938475610293",
      "time": 1788000500000,
      "messaging": [
        {
          "sender": { "id": "7213456789012345" },
          "recipient": { "id": "102938475610293" },
          "timestamp": 1788000500000,
          "postback": { "mid": "m_PoStBaCk000000000000", "title": "Get Started", "payload": "GET_STARTED" }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/services/channels/meta.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_META_GRAPH_VERSION,
  isAllowedMetaAttachmentUrl,
  isWindowGraphError,
  isWithinSendWindow,
  MAX_META_MESSAGE_CHARS,
  metaGraphUrl,
  metaGraphVersion,
  META_SEND_WINDOW_MS,
  parseMetaWebhook,
  signMetaPayload,
  singleEventBody,
  splitOutboundText,
  verifyHubChallenge,
  verifyMetaSignature,
} from "./meta";
import messengerText from "./__fixtures__/meta-messenger-text.json";
import messengerImage from "./__fixtures__/meta-messenger-image.json";
import instagramText from "./__fixtures__/meta-instagram-text.json";
import echo from "./__fixtures__/meta-echo.json";
import delivery from "./__fixtures__/meta-delivery.json";
import postback from "./__fixtures__/meta-postback.json";

const APP_SECRET = "synthetic-app-secret-not-a-real-one";

describe("verifyMetaSignature", () => {
  const payload = JSON.stringify(messengerText);

  it("accepts the signature Meta documents (sha256=<hex> over the raw body)", () => {
    const expected = `sha256=${createHmac("sha256", APP_SECRET).update(payload, "utf8").digest("hex")}`;
    expect(signMetaPayload(APP_SECRET, payload)).toBe(expected);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: expected }),
    ).toEqual({ ok: true });
  });

  it("rejects a body that changed by a single byte", () => {
    const header = signMetaPayload(APP_SECRET, payload);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload: `${payload} `, header }),
    ).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects the wrong secret", () => {
    const header = signMetaPayload("other-secret", payload);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header }),
    ).toEqual({ ok: false, reason: "no_match" });
  });

  it("names why it refused, without leaking anything", () => {
    expect(
      verifyMetaSignature({ appSecret: "", payload, header: "sha256=aa" }),
    ).toEqual({ ok: false, reason: "no_secret" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: null }),
    ).toEqual({ ok: false, reason: "missing_header" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: "sha1=deadbeef" }),
    ).toEqual({ ok: false, reason: "bad_format" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: "sha256=nothex" }),
    ).toEqual({ ok: false, reason: "bad_format" });
  });
});

describe("verifyHubChallenge", () => {
  function params(o: Record<string, string>): URLSearchParams {
    return new URLSearchParams(o);
  }

  it("echoes the challenge for a correct subscribe handshake", () => {
    expect(
      verifyHubChallenge(
        params({
          "hub.mode": "subscribe",
          "hub.verify_token": "tok",
          "hub.challenge": "1158201444",
        }),
        "tok",
      ),
    ).toEqual({ ok: true, challenge: "1158201444" });
  });

  it("refuses a wrong token, a wrong mode, a missing challenge, or no config", () => {
    const good = {
      "hub.mode": "subscribe",
      "hub.verify_token": "tok",
      "hub.challenge": "1",
    };
    expect(verifyHubChallenge(params(good), "other")).toEqual({
      ok: false,
      reason: "bad_token",
    });
    expect(
      verifyHubChallenge(params({ ...good, "hub.mode": "unsubscribe" }), "tok"),
    ).toEqual({ ok: false, reason: "bad_mode" });
    expect(
      verifyHubChallenge(
        params({ "hub.mode": "subscribe", "hub.verify_token": "tok" }),
        "tok",
      ),
    ).toEqual({ ok: false, reason: "no_challenge" });
    expect(verifyHubChallenge(params(good), null)).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });
});

describe("parseMetaWebhook", () => {
  it("reads a Messenger text message", () => {
    const [event, ...rest] = parseMetaWebhook(messengerText);
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      object: "page",
      channel: "messenger",
      entryId: "102938475610293",
      senderId: "7213456789012345",
      recipientId: "102938475610293",
      customerId: "7213456789012345",
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      text: "Hiya, do you have any space for a small linework piece?",
      isEcho: false,
      kind: "message",
      attachments: [],
    });
    expect(event.timestamp.toISOString()).toBe("2026-09-08T20:00:00.000Z");
  });

  it("reads an Instagram message as the instagram channel", () => {
    const [event] = parseMetaWebhook(instagramText);
    expect(event).toMatchObject({
      object: "instagram",
      channel: "instagram",
      entryId: "17841400000000000",
      senderId: "6011223344556677",
      customerId: "6011223344556677",
      kind: "message",
    });
  });

  it("keeps attachment type and url, in order", () => {
    const [event] = parseMetaWebhook(messengerImage);
    expect(event.attachments).toEqual([
      {
        type: "image",
        url: "https://scontent.xx.fbcdn.net/v/t1.0-9/synthetic-reference.jpg",
      },
      { type: "file", url: "https://lookaside.fbsbx.com/synthetic/brief.pdf" },
    ]);
  });

  it("flags an echo and reports the CUSTOMER as the recipient side", () => {
    const [event] = parseMetaWebhook(echo);
    expect(event).toMatchObject({
      isEcho: true,
      senderId: "102938475610293",
      recipientId: "7213456789012345",
      // The customer is who we are threading against — on an echo that is the
      // recipient, not the sender (the sender is our own Page).
      customerId: "7213456789012345",
      kind: "message",
    });
  });

  it("classifies receipts and postbacks so the caller can ignore them", () => {
    expect(parseMetaWebhook(delivery).map((e) => e.kind)).toEqual([
      "receipt",
      "receipt",
    ]);
    expect(parseMetaWebhook(postback).map((e) => e.kind)).toEqual(["postback"]);
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseMetaWebhook(null)).toEqual([]);
    expect(parseMetaWebhook({})).toEqual([]);
    expect(parseMetaWebhook({ object: "user", entry: [] })).toEqual([]);
    expect(parseMetaWebhook({ object: "page", entry: "nope" })).toEqual([]);
    expect(
      parseMetaWebhook({ object: "page", entry: [{ id: 5, messaging: [{}] }] }),
    ).toEqual([]);
  });

  it("rebuilds a replayable single-event body", () => {
    const [event] = parseMetaWebhook(messengerText);
    const body = singleEventBody(event);
    const [again] = parseMetaWebhook(body);
    expect(again).toMatchObject({
      mid: event.mid,
      senderId: event.senderId,
      entryId: event.entryId,
      channel: "messenger",
    });
  });
});

describe("isAllowedMetaAttachmentUrl", () => {
  it("allows Meta's own CDN hosts over https", () => {
    for (const url of [
      "https://scontent.xx.fbcdn.net/v/t1.0-9/x.jpg",
      "https://scontent-lhr8-1.xx.fbcdn.net/v/x.jpg",
      "https://instagram.flhr1-2.fna.cdninstagram.com/v/x.jpg",
      "https://lookaside.fbsbx.com/synthetic/brief.pdf",
    ]) {
      expect(isAllowedMetaAttachmentUrl(url)).toBe(true);
    }
  });

  it("refuses anything that is not one of those hosts, over any scheme", () => {
    for (const url of [
      "http://scontent.xx.fbcdn.net/v/x.jpg",
      "https://evil.test/x.jpg",
      "https://notfbcdn.net/x.jpg",
      "https://fbcdn.net.evil.test/x.jpg",
      "https://user:pass@scontent.xx.fbcdn.net/x.jpg",
      "https://scontent.xx.fbcdn.net:8080/x.jpg",
      "http://169.254.169.254/latest/meta-data/",
      "file:///etc/passwd",
      "not a url",
      "",
      null,
    ]) {
      expect(isAllowedMetaAttachmentUrl(url)).toBe(false);
    }
  });
});

describe("splitOutboundText", () => {
  it("leaves a short message alone", () => {
    expect(splitOutboundText("  Hello  ")).toEqual(["Hello"]);
    expect(splitOutboundText("   ")).toEqual([]);
  });

  it("splits past the 2000-character limit on a word boundary", () => {
    const word = "reference ";
    const text = word.repeat(300); // 3000 chars
    const parts = splitOutboundText(text);
    expect(parts.length).toBe(2);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MAX_META_MESSAGE_CHARS);
    }
    expect(parts.join(" ").replace(/\s+/g, " ").trim()).toBe(
      text.replace(/\s+/g, " ").trim(),
    );
  });

  it("hard-cuts a single unbroken run rather than looping forever", () => {
    const parts = splitOutboundText("x".repeat(4500), 2000);
    expect(parts.map((p) => p.length)).toEqual([2000, 2000, 500]);
  });
});

describe("graph version + url", () => {
  it("defaults, and accepts a valid override", () => {
    expect(metaGraphVersion({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_META_GRAPH_VERSION,
    );
    expect(
      metaGraphVersion({ META_GRAPH_VERSION: "v22.0" } as NodeJS.ProcessEnv),
    ).toBe("v22.0");
  });

  it("ignores a nonsense override rather than building a broken URL", () => {
    expect(
      metaGraphVersion({
        META_GRAPH_VERSION: "../../danger",
      } as NodeJS.ProcessEnv),
    ).toBe(DEFAULT_META_GRAPH_VERSION);
  });

  it("builds an absolute graph.facebook.com URL", () => {
    expect(metaGraphUrl("102938475610293/messages", {} as NodeJS.ProcessEnv)).toBe(
      `https://graph.facebook.com/${DEFAULT_META_GRAPH_VERSION}/102938475610293/messages`,
    );
  });
});

describe("the 24-hour messaging window", () => {
  const now = new Date("2026-09-08T12:00:00Z");

  it("is open inside 24 hours of the last inbound message", () => {
    expect(
      isWithinSendWindow(new Date(now.getTime() - META_SEND_WINDOW_MS + 1000), now),
    ).toBe(true);
  });

  it("is shut past it, and shut when nothing ever came in", () => {
    expect(
      isWithinSendWindow(new Date(now.getTime() - META_SEND_WINDOW_MS - 1000), now),
    ).toBe(false);
    expect(isWithinSendWindow(null, now)).toBe(false);
  });

  it("recognises Graph's own window rejection", () => {
    expect(isWindowGraphError({ code: 10, error_subcode: 2018278 })).toBe(true);
    expect(isWindowGraphError({ code: 10 })).toBe(true);
    expect(isWindowGraphError({ error_subcode: 2018278 })).toBe(true);
    expect(isWindowGraphError({ code: 190 })).toBe(false);
    expect(isWindowGraphError(null)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/meta.test.ts`
Expected: FAIL — `Failed to resolve import "./meta"`.

- [ ] **Step 4: Implement `channels/meta.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pure half of the Meta channel (Messenger + Instagram Messaging): request
 * verification, webhook parsing, the attachment host allow-list, the outbound
 * text splitter and the 24-hour messaging window.
 *
 * No Prisma, no network, no env beyond META_GRAPH_VERSION — so every rule here
 * is provable with a string and a JSON fixture.
 */

// ---------------------------------------------------------------------------
// Request verification
// ---------------------------------------------------------------------------

export const META_SIGNATURE_HEADER = "x-hub-signature-256";

/** `sha256=<hex>` over the RAW body, exactly as Meta computes it. */
export function signMetaPayload(appSecret: string, payload: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(payload, "utf8").digest("hex")}`;
}

export type MetaVerification =
  | { ok: true }
  | { ok: false; reason: "no_secret" | "missing_header" | "bad_format" | "no_match" };

const HEX_64 = /^[0-9a-f]{64}$/i;

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * The body MUST be the raw request text. JSON.parse/stringify round-tripping
 * changes bytes (key order, whitespace, unicode escapes) and breaks the HMAC.
 */
export function verifyMetaSignature(input: {
  appSecret: string;
  payload: string;
  header: string | null | undefined;
}): MetaVerification {
  if (!input.appSecret) return { ok: false, reason: "no_secret" };
  const header = input.header?.trim();
  if (!header) return { ok: false, reason: "missing_header" };
  if (!header.startsWith("sha256=")) return { ok: false, reason: "bad_format" };
  const digest = header.slice("sha256=".length);
  // Checked before comparing so a malformed header is reported as malformed
  // rather than as a mismatch — the two mean very different things to whoever
  // is reading the log while wiring the webhook up.
  if (!HEX_64.test(digest)) return { ok: false, reason: "bad_format" };
  const expected = signMetaPayload(input.appSecret, input.payload).slice(
    "sha256=".length,
  );
  return constantTimeEquals(digest.toLowerCase(), expected)
    ? { ok: true }
    : { ok: false, reason: "no_match" };
}

export type HubChallengeResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: "not_configured" | "bad_mode" | "bad_token" | "no_challenge" };

/**
 * Meta's subscription handshake: GET with `hub.mode=subscribe`, our
 * `hub.verify_token` and a `hub.challenge` we must echo back verbatim as
 * text/plain. The token comparison is constant-time — it is a shared secret
 * an attacker can probe as often as they like.
 */
export function verifyHubChallenge(
  params: URLSearchParams,
  verifyToken: string | null | undefined,
): HubChallengeResult {
  const configured = verifyToken?.trim();
  if (!configured) return { ok: false, reason: "not_configured" };
  if (params.get("hub.mode") !== "subscribe") {
    return { ok: false, reason: "bad_mode" };
  }
  if (!constantTimeEquals(params.get("hub.verify_token") ?? "", configured)) {
    return { ok: false, reason: "bad_token" };
  }
  const challenge = params.get("hub.challenge");
  if (!challenge) return { ok: false, reason: "no_challenge" };
  return { ok: true, challenge };
}

// ---------------------------------------------------------------------------
// Webhook parsing
// ---------------------------------------------------------------------------

export type MetaChannelKind = "messenger" | "instagram";

export interface MetaAttachment {
  /** Meta's own type word: image | video | audio | file | share | … */
  type: string;
  url: string | null;
}

export interface MetaMessagingEvent {
  object: "page" | "instagram";
  channel: MetaChannelKind;
  /** entry.id — the Page id (page) or IG business account id (instagram). */
  entryId: string;
  entryTime: number;
  senderId: string;
  recipientId: string;
  /**
   * The CUSTOMER's PSID/IGSID. Normally the sender; on an echo (staff replied
   * from the Meta inbox) the sender is our own Page, so it is the recipient.
   */
  customerId: string;
  timestamp: Date;
  mid: string | null;
  text: string | null;
  isEcho: boolean;
  attachments: MetaAttachment[];
  kind: "message" | "postback" | "receipt" | "unknown";
  /** The original `messaging[i]` object, kept so a failure can be replayed. */
  raw: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseAttachments(value: unknown): MetaAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: MetaAttachment[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const att = item as { type?: unknown; payload?: { url?: unknown } };
    const type = str(att.type);
    if (!type) continue;
    out.push({ type, url: str(att.payload?.url) });
  }
  return out;
}

/**
 * Flatten a webhook body into one normalised event per `entry[].messaging[]`
 * item. Total tolerance for junk: anything unrecognised is skipped, never
 * thrown — an unauthenticated endpoint must not be able to raise an exception
 * from a payload. `entry[].changes[]` (feed/comment events) is not parsed:
 * we subscribe only to messaging fields.
 */
export function parseMetaWebhook(body: unknown): MetaMessagingEvent[] {
  if (typeof body !== "object" || body === null) return [];
  const root = body as { object?: unknown; entry?: unknown };
  const object = root.object;
  if (object !== "page" && object !== "instagram") return [];
  if (!Array.isArray(root.entry)) return [];

  const channel: MetaChannelKind =
    object === "instagram" ? "instagram" : "messenger";
  const events: MetaMessagingEvent[] = [];

  for (const rawEntry of root.entry) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const entry = rawEntry as {
      id?: unknown;
      time?: unknown;
      messaging?: unknown;
    };
    const entryId = str(entry.id);
    if (!entryId || !Array.isArray(entry.messaging)) continue;
    const entryTime = typeof entry.time === "number" ? entry.time : 0;

    for (const raw of entry.messaging) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as {
        sender?: { id?: unknown };
        recipient?: { id?: unknown };
        timestamp?: unknown;
        message?: {
          mid?: unknown;
          text?: unknown;
          is_echo?: unknown;
          attachments?: unknown;
        };
        postback?: { mid?: unknown };
        delivery?: unknown;
        read?: unknown;
      };
      const senderId = str(item.sender?.id);
      const recipientId = str(item.recipient?.id);
      if (!senderId || !recipientId) continue;

      const kind: MetaMessagingEvent["kind"] = item.message
        ? "message"
        : item.postback
          ? "postback"
          : item.delivery || item.read
            ? "receipt"
            : "unknown";

      const isEcho = item.message?.is_echo === true;
      const ms =
        typeof item.timestamp === "number" ? item.timestamp : entryTime;

      events.push({
        object,
        channel,
        entryId,
        entryTime,
        senderId,
        recipientId,
        customerId: isEcho ? recipientId : senderId,
        timestamp: new Date(ms || Date.now()),
        mid: str(item.message?.mid) ?? str(item.postback?.mid),
        text: str(item.message?.text),
        isEcho,
        attachments: parseAttachments(item.message?.attachments),
        kind,
        raw,
      });
    }
  }

  return events;
}

/**
 * The smallest webhook body that replays exactly this one event. A delivery
 * can carry many events and only one of them may have failed, so the stored
 * `WebhookFailure.payload` is this — not the whole batch — and pressing Retry
 * re-runs precisely what broke.
 */
export function singleEventBody(event: MetaMessagingEvent): unknown {
  return {
    object: event.object,
    entry: [
      { id: event.entryId, time: event.entryTime, messaging: [event.raw] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Attachment host allow-list (SSRF)
// ---------------------------------------------------------------------------

/**
 * Attachment URLs arrive INSIDE a webhook body. The body is signed, so it came
 * from Meta — but the payload URL is still a value we are about to fetch
 * server-side, and a signed-but-hostile or simply changed API would otherwise
 * point us at `http://169.254.169.254/` or an internal service. Only Meta's
 * own media hosts are ever fetched; anything else is stored as a link for
 * staff to open in a browser, which is the right blast radius for it.
 */
export const META_ATTACHMENT_HOST_SUFFIXES = [
  ".fbcdn.net",
  ".cdninstagram.com",
] as const;

export const META_ATTACHMENT_HOSTS = ["lookaside.fbsbx.com"] as const;

export function isAllowedMetaAttachmentUrl(
  url: string | null | undefined,
): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // https only, no credentials, no odd port: each of those is a way to reach
  // something that is not the CDN while still "looking like" the CDN.
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "443") return false;
  const host = parsed.hostname.toLowerCase();
  if (META_ATTACHMENT_HOSTS.includes(host as (typeof META_ATTACHMENT_HOSTS)[number])) {
    return true;
  }
  // The leading dot matters: it makes this a subdomain test, so `notfbcdn.net`
  // and `fbcdn.net.evil.test` both fail.
  return META_ATTACHMENT_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

// ---------------------------------------------------------------------------
// Outbound text
// ---------------------------------------------------------------------------

/** Meta rejects a message body over 2000 characters outright. */
export const MAX_META_MESSAGE_CHARS = 2000;

/**
 * Split a long reply into consecutive messages. Prefers a newline, then a
 * space, then a hard cut — a 3000-character reply arriving as two readable
 * halves beats a 400 from Graph and nothing sent at all.
 */
export function splitOutboundText(
  text: string,
  limit: number = MAX_META_MESSAGE_CHARS,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= limit) return [trimmed];

  const out: string[] = [];
  let rest = trimmed;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = window.lastIndexOf("\n");
    // Only honour a boundary in the back half; a break at character 3 of 2000
    // would produce a stream of tiny messages.
    if (cut < limit / 2) cut = window.lastIndexOf(" ");
    if (cut < limit / 2) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// ---------------------------------------------------------------------------
// Graph endpoint
// ---------------------------------------------------------------------------

export const DEFAULT_META_GRAPH_VERSION = "v21.0";
const GRAPH_VERSION = /^v\d{1,3}\.\d{1,3}$/;
const warnedVersions = new Set<string>();

/**
 * Pinned by default, overridable when Meta deprecates a version. Validated
 * because the value is interpolated into a URL path — an unchecked env var
 * there is a path-traversal primitive.
 */
export function metaGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.META_GRAPH_VERSION?.trim();
  if (!raw) return DEFAULT_META_GRAPH_VERSION;
  if (GRAPH_VERSION.test(raw)) return raw;
  if (!warnedVersions.has(raw)) {
    warnedVersions.add(raw);
    console.warn(
      `[meta] META_GRAPH_VERSION is not a version (${raw}) — using ${DEFAULT_META_GRAPH_VERSION}. Expected e.g. v21.0.`,
    );
  }
  return DEFAULT_META_GRAPH_VERSION;
}

export function metaGraphUrl(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `https://graph.facebook.com/${metaGraphVersion(env)}/${path.replace(/^\//, "")}`;
}

// ---------------------------------------------------------------------------
// The 24-hour messaging window
// ---------------------------------------------------------------------------

export const META_SEND_WINDOW_MS = 86_400_000;

/**
 * Meta only allows a business to message a person within 24 hours of that
 * person's last message. Sending outside it is a policy violation, not a
 * transient error, so it is caught BEFORE the request goes out and surfaced
 * to staff as "email them instead".
 */
export class MetaWindowClosedError extends Error {
  readonly channel: MetaChannelKind;
  constructor(channel: MetaChannelKind) {
    super(
      "Messenger/Instagram only allows replies within 24 hours of the customer's last message — email them instead.",
    );
    this.name = "MetaWindowClosedError";
    this.channel = channel;
  }
}

export function isWithinSendWindow(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < META_SEND_WINDOW_MS;
}

/**
 * Graph's own verdict, for the race where the window shut between our check
 * and the request: code 10 ("permission denied" — the family the messaging
 * window lives in) or subcode 2018278 ("outside allowed window").
 */
export function isWindowGraphError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: unknown; error_subcode?: unknown };
  return err.code === 10 || err.error_subcode === 2018278;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/meta.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/channels/meta.ts \
  packages/core/src/services/channels/meta.test.ts \
  packages/core/src/services/channels/__fixtures__/meta-messenger-text.json \
  packages/core/src/services/channels/__fixtures__/meta-messenger-image.json \
  packages/core/src/services/channels/__fixtures__/meta-instagram-text.json \
  packages/core/src/services/channels/__fixtures__/meta-echo.json \
  packages/core/src/services/channels/__fixtures__/meta-delivery.json \
  packages/core/src/services/channels/__fixtures__/meta-postback.json
git commit -m "$(cat <<'EOF'
feat(core): channels/meta.ts — signature, hub challenge, webhook parsing

Pure Meta channel primitives: X-Hub-Signature-256 HMAC verification over the
raw body (constant-time), the hub.challenge subscribe handshake, a
junk-tolerant parseMetaWebhook flattening page + instagram entries into one
normalised event each (echo-aware), singleEventBody for replay, the CDN host
allow-list that bounds attachment fetches, the 2000-char outbound splitter, a
validated Graph version/URL builder and the 24-hour messaging window.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 5: `channels/meta-inbound.ts` — identity, threading, `ingestMetaEvent`

The one inbound Meta orchestration: connection → idempotency → identity → thread → message. The webhook route (Task 6) and the Channels retry button (Task 9) both call exactly this, so a replay behaves identically to the original delivery. Mirrors `ingestResendEvent` deliberately.

**Files:**
- Create: `packages/core/src/services/channels/meta-inbound.ts`, `packages/core/src/services/channels/meta-inbound.test.ts`

**Interfaces:**
- Consumes:
  ```ts
  // ./meta (Task 4)
  MetaMessagingEvent, MetaChannelKind, isAllowedMetaAttachmentUrl, metaGraphUrl

  // ../channel-connections (Task 3)
  export interface MetaConnection extends ChannelConnectionRow { accessToken: string }
  export async function findConnectionByExternalId(externalId: string): Promise<MetaConnection | null>
  export async function touchConnectionEvent(id: string, at?: Date): Promise<void>

  // ../contact-identity (Phase 1, verbatim)
  export type IdentityChannel = "messenger" | "instagram";
  export interface ContactIdentityInput { channel: IdentityChannel; externalId: string; displayName?: string | null }
  export interface FindOrCreateCustomerInput { name?: string | null; email?: string | null; phone?: string | null; marketingConsent?: boolean; notes?: string | null; tags?: string[]; identity?: ContactIdentityInput | null }
  export async function findOrCreateCustomer(input: FindOrCreateCustomerInput): Promise<Customer>

  // ../enquiry-threading (Phase 1, verbatim)
  export interface ResolveThreadInput { customerId: string; channel: EnquiryChannel; threadToken?: string | null; contactName: string; contactEmail?: string | null; contactPhone?: string | null; subject?: string | null; preferredArtistId?: string | null; now?: Date }
  export interface ResolvedThread { enquiryId: string; created: boolean }
  export async function resolveThread(input: ResolveThreadInput): Promise<ResolvedThread>

  // ../enquiry-messages (Phase 1 + Task 2)
  export async function recordInbound(input: RecordMessageInput): Promise<ThreadMessageRow>
  export async function recordOutbound(input: RecordMessageInput & { authorUserId?: string | null }): Promise<ThreadMessageRow>

  // ../assets (Phase 1) + @bnb/core/uploads
  export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  export interface StoreAttachmentInput { mime: string; filename?: string | null; bytes?: Uint8Array | null; url?: string | null; messageId?: string | null }
  export function sniffImageMime(buf: Uint8Array): string | null
  ```
- Produces:
  ```ts
  export const MAX_META_ATTACHMENTS = 10;
  export const MAX_META_INLINE_TOTAL_BYTES = 16 * 1024 * 1024;
  export const UNKNOWN_SENDER_NAME: Record<MetaChannelKind, string>; // "Messenger user" / "Instagram user"
  export const META_INBOX_AUTHOR = "Meta inbox";

  export interface MetaProfile { name: string | null }
  export interface MetaInboundDeps {
    fetchProfile(input: { connection: MetaConnection; userId: string; channel: MetaChannelKind }): Promise<MetaProfile | null>;
    download(url: string, maxBytes: number): Promise<Uint8Array | null>;
  }
  export function metaInboundDeps(fetchImpl?: typeof fetch): MetaInboundDeps;

  export type MetaIngestOutcome =
    | { status: "recorded"; direction: "inbound" | "outbound"; enquiryId: string; messageId: string; createdEnquiry: boolean }
    | { status: "duplicate"; enquiryId: string; messageId: string }
    | { status: "ignored"; reason: "echo_known" | "no_message" | "unsupported" | "unknown_page" };

  export async function ingestMetaEvent(event: MetaMessagingEvent, deps?: MetaInboundDeps): Promise<MetaIngestOutcome>;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/services/channels/meta-inbound.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMetaWebhook } from "./meta";
import messengerText from "./__fixtures__/meta-messenger-text.json";
import messengerImage from "./__fixtures__/meta-messenger-image.json";
import instagramText from "./__fixtures__/meta-instagram-text.json";
import echo from "./__fixtures__/meta-echo.json";
import delivery from "./__fixtures__/meta-delivery.json";
import postback from "./__fixtures__/meta-postback.json";

/**
 * The whole inbound Meta path with the database, the identity resolver, the
 * threading rule and the network all mocked — so what is under test is the
 * decision-making, not Prisma.
 */
const findUnique = vi.fn();
const deleteMany = vi.fn();
const findConnectionByExternalId = vi.fn();
const touchConnectionEvent = vi.fn();
const findOrCreateCustomer = vi.fn();
const resolveThread = vi.fn();
const recordInbound = vi.fn();
const recordOutbound = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    enquiryMessage: { findUnique: (...a: unknown[]) => findUnique(...a) },
    customerIdentity: { findUnique: (...a: unknown[]) => findUnique(...a) },
    enquiry: { deleteMany: (...a: unknown[]) => deleteMany(...a) },
  },
}));
vi.mock("../channel-connections", () => ({
  findConnectionByExternalId: (...a: unknown[]) =>
    findConnectionByExternalId(...a),
  touchConnectionEvent: (...a: unknown[]) => touchConnectionEvent(...a),
}));
vi.mock("../contact-identity", () => ({
  findOrCreateCustomer: (...a: unknown[]) => findOrCreateCustomer(...a),
}));
vi.mock("../enquiry-threading", () => ({
  resolveThread: (...a: unknown[]) => resolveThread(...a),
}));
vi.mock("../enquiry-messages", () => ({
  recordInbound: (...a: unknown[]) => recordInbound(...a),
  recordOutbound: (...a: unknown[]) => recordOutbound(...a),
}));

const { ingestMetaEvent, META_INBOX_AUTHOR, UNKNOWN_SENDER_NAME } = await import(
  "./meta-inbound"
);

const CONNECTION = {
  id: "conn1",
  channel: "messenger" as const,
  externalId: "102938475610293",
  pageId: "102938475610293",
  igAccountId: null,
  name: "Boots 'n' Bandit",
  active: true,
  webhookSubscribedAt: null,
  lastEventAt: null,
  connectedAt: new Date("2026-09-01T00:00:00Z"),
  accessToken: "EAAG_synthetic",
};

/** A valid PNG header so sniffImageMime accepts it. */
function png(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function deps(over: Partial<{ profile: unknown; bytes: Uint8Array | null }> = {}) {
  return {
    fetchProfile: vi.fn(async () => (over.profile ?? { name: "Amy Rowe" }) as never),
    download: vi.fn(async () => (over.bytes === undefined ? png() : over.bytes)),
  };
}

const first = (body: unknown) => parseMetaWebhook(body)[0];

beforeEach(() => {
  vi.clearAllMocks();
  findConnectionByExternalId.mockResolvedValue(CONNECTION);
  findUnique.mockResolvedValue(null);
  findOrCreateCustomer.mockResolvedValue({
    id: "cus1",
    name: "Amy Rowe",
    phone: null,
  });
  resolveThread.mockResolvedValue({ enquiryId: "enq1", created: true });
  recordInbound.mockResolvedValue({ id: "msg1", enquiryId: "enq1" });
  recordOutbound.mockResolvedValue({ id: "msg2", enquiryId: "enq1" });
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("ingestMetaEvent", () => {
  it("records a Messenger message against a new customer and thread", async () => {
    const d = deps();
    const outcome = await ingestMetaEvent(first(messengerText), d);

    expect(outcome).toEqual({
      status: "recorded",
      direction: "inbound",
      enquiryId: "enq1",
      messageId: "msg1",
      createdEnquiry: true,
    });
    expect(findOrCreateCustomer).toHaveBeenCalledWith({
      name: "Amy Rowe",
      identity: {
        channel: "messenger",
        externalId: "7213456789012345",
        displayName: "Amy Rowe",
      },
    });
    expect(resolveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus1",
        channel: "messenger",
        contactName: "Amy Rowe",
        threadToken: null,
      }),
    );
    expect(recordInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        enquiryId: "enq1",
        customerId: "cus1",
        channel: "messenger",
        externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
        fromAddress: "7213456789012345",
        fromName: "Amy Rowe",
        connectionId: "conn1",
        bodyText: "Hiya, do you have any space for a small linework piece?",
      }),
    );
    expect(touchConnectionEvent).toHaveBeenCalledWith(
      "conn1",
      expect.any(Date),
    );
  });

  it("threads an Instagram message on the instagram channel", async () => {
    findConnectionByExternalId.mockResolvedValue({
      ...CONNECTION,
      id: "conn2",
      channel: "instagram",
      externalId: "17841400000000000",
    });
    await ingestMetaEvent(first(instagramText), deps());
    expect(resolveThread).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "instagram" }),
    );
    expect(recordInbound).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "instagram", connectionId: "conn2" }),
    );
  });

  it("only fetches a profile for a handle we have never seen", async () => {
    findUnique
      // externalId idempotency check
      .mockResolvedValueOnce(null)
      // customerIdentity lookup — already known
      .mockResolvedValueOnce({ customerId: "cus1", displayName: "Amy Rowe" });
    const d = deps();
    await ingestMetaEvent(first(messengerText), d);
    expect(d.fetchProfile).not.toHaveBeenCalled();
  });

  it("names the customer for the channel when the profile fetch fails", async () => {
    const d = deps({ profile: null });
    await ingestMetaEvent(first(messengerText), d);
    expect(findOrCreateCustomer).toHaveBeenCalledWith({
      name: UNKNOWN_SENDER_NAME.messenger,
      identity: {
        channel: "messenger",
        externalId: "7213456789012345",
        displayName: UNKNOWN_SENDER_NAME.messenger,
      },
    });
    expect(UNKNOWN_SENDER_NAME).toEqual({
      messenger: "Messenger user",
      instagram: "Instagram user",
    });
  });

  it("stores an image attachment inline and a non-image as a link", async () => {
    const d = deps();
    await ingestMetaEvent(first(messengerImage), d);
    const attachments = recordInbound.mock.calls[0][0].attachments;
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({ mime: "image/png" });
    expect(attachments[0].bytes).toBeInstanceOf(Uint8Array);
    expect(attachments[1]).toEqual({
      mime: "application/octet-stream",
      filename: null,
      url: "https://lookaside.fbsbx.com/synthetic/brief.pdf",
    });
    // Only the image was fetched — the file is a link, never downloaded.
    expect(d.download).toHaveBeenCalledTimes(1);
  });

  it("never downloads from a host outside Meta's CDNs", async () => {
    const event = first(messengerImage);
    event.attachments = [{ type: "image", url: "http://169.254.169.254/x.png" }];
    const d = deps();
    await ingestMetaEvent(event, d);
    expect(d.download).not.toHaveBeenCalled();
    expect(recordInbound.mock.calls[0][0].attachments).toEqual([
      {
        mime: "application/octet-stream",
        filename: null,
        url: "http://169.254.169.254/x.png",
      },
    ]);
  });

  it("downgrades bytes that are not really an image to a link", async () => {
    const d = deps({ bytes: new Uint8Array([0x3c, 0x73, 0x76, 0x67]) }); // "<svg"
    await ingestMetaEvent(first(messengerImage), d);
    const attachments = recordInbound.mock.calls[0][0].attachments;
    expect(attachments[0].bytes).toBeUndefined();
    expect(attachments[0].url).toBe(
      "https://scontent.xx.fbcdn.net/v/t1.0-9/synthetic-reference.jpg",
    );
  });

  it("records an unknown echo as OUTBOUND from the Meta inbox", async () => {
    const outcome = await ingestMetaEvent(first(echo), deps());
    expect(outcome).toMatchObject({
      status: "recorded",
      direction: "outbound",
      messageId: "msg2",
    });
    expect(recordInbound).not.toHaveBeenCalled();
    expect(recordOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "messenger",
        authorUserId: null,
        fromName: META_INBOX_AUTHOR,
        fromAddress: "7213456789012345",
        externalId: "m_EcHo1EcHo2EcHo3EcHo4E",
        connectionId: "conn1",
      }),
    );
  });

  it("ignores an echo of a message we already sent ourselves", async () => {
    findUnique.mockResolvedValueOnce({ id: "msg9", enquiryId: "enq9" });
    expect(await ingestMetaEvent(first(echo), deps())).toEqual({
      status: "ignored",
      reason: "echo_known",
    });
    expect(recordOutbound).not.toHaveBeenCalled();
  });

  it("reports a replayed inbound message as a duplicate", async () => {
    findUnique.mockResolvedValueOnce({ id: "msg9", enquiryId: "enq9" });
    expect(await ingestMetaEvent(first(messengerText), deps())).toEqual({
      status: "duplicate",
      enquiryId: "enq9",
      messageId: "msg9",
    });
    expect(recordInbound).not.toHaveBeenCalled();
  });

  it("ignores delivery/read receipts and postbacks", async () => {
    for (const event of parseMetaWebhook(delivery)) {
      expect(await ingestMetaEvent(event, deps())).toEqual({
        status: "ignored",
        reason: "unsupported",
      });
    }
    expect(await ingestMetaEvent(first(postback), deps())).toEqual({
      status: "ignored",
      reason: "unsupported",
    });
  });

  it("ignores an event for a Page nobody connected", async () => {
    findConnectionByExternalId.mockResolvedValue(null);
    expect(await ingestMetaEvent(first(messengerText), deps())).toEqual({
      status: "ignored",
      reason: "unknown_page",
    });
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
  });

  it("ignores a message with no mid, and one with nothing in it", async () => {
    const noMid = { ...first(messengerText), mid: null };
    expect(await ingestMetaEvent(noMid, deps())).toEqual({
      status: "ignored",
      reason: "no_message",
    });
    const empty = { ...first(messengerText), text: null, attachments: [] };
    expect(await ingestMetaEvent(empty, deps())).toEqual({
      status: "ignored",
      reason: "no_message",
    });
  });

  it("describes an attachment-only message rather than storing a blank body", async () => {
    const event = { ...first(messengerImage), text: null };
    await ingestMetaEvent(event, deps());
    expect(recordInbound.mock.calls[0][0].bodyText).toBe("(sent 2 attachments)");
  });

  it("cleans up the enquiry it created when it loses a race", async () => {
    resolveThread.mockResolvedValue({ enquiryId: "enqNew", created: true });
    recordInbound.mockResolvedValue({ id: "msg1", enquiryId: "enqWinner" });
    const outcome = await ingestMetaEvent(first(messengerText), deps());
    expect(outcome).toMatchObject({
      enquiryId: "enqWinner",
      createdEnquiry: false,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "enqNew", messages: { none: {} } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/meta-inbound.test.ts`
Expected: FAIL — `Failed to resolve import "./meta-inbound"`.

- [ ] **Step 3: Implement `channels/meta-inbound.ts`**

```ts
import { prisma } from "@bnb/core/db";
import { sniffImageMime } from "@bnb/core/uploads";
import {
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
import {
  findConnectionByExternalId,
  touchConnectionEvent,
  type MetaConnection,
} from "../channel-connections";
import { findOrCreateCustomer } from "../contact-identity";
import { recordInbound, recordOutbound } from "../enquiry-messages";
import { resolveThread } from "../enquiry-threading";
import {
  isAllowedMetaAttachmentUrl,
  metaGraphUrl,
  type MetaChannelKind,
  type MetaMessagingEvent,
} from "./meta";

/**
 * The single inbound Meta orchestration: connection → idempotency → identity →
 * thread → message. The webhook route and the Studio › Channels retry button
 * both call exactly this, so replaying a stored event behaves identically to
 * the original delivery.
 *
 * Errors are NOT swallowed here — the caller turns them into a WebhookFailure
 * row so the failure is visible and replayable.
 */

/** Cap on attachments processed per message — a flood must not stall the route. */
export const MAX_META_ATTACHMENTS = 10;

/** Total bytes one message may pull into inline attachment rows. */
export const MAX_META_INLINE_TOTAL_BYTES = 16 * 1024 * 1024;

/** Hard ceiling on how long a single attachment download may take. */
const DOWNLOAD_TIMEOUT_MS = 15_000;

/** A Meta user carries no email or phone — this is the best name we have. */
export const UNKNOWN_SENDER_NAME: Record<MetaChannelKind, string> = {
  messenger: "Messenger user",
  instagram: "Instagram user",
};

/** Attribution for a staff reply typed into Meta's own inbox, not ours. */
export const META_INBOX_AUTHOR = "Meta inbox";

export interface MetaProfile {
  name: string | null;
}

export interface MetaInboundDeps {
  fetchProfile(input: {
    connection: MetaConnection;
    userId: string;
    channel: MetaChannelKind;
  }): Promise<MetaProfile | null>;
  /** Resolves null when the body is missing, too large or unreadable. */
  download(url: string, maxBytes: number): Promise<Uint8Array | null>;
}

function fullName(first: unknown, last: unknown): string | null {
  const parts = [first, last].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length ? parts.join(" ").trim() : null;
}

/**
 * The real network deps. Only ever constructed on the webhook/retry path.
 * `fetchImpl` defaults to the global fetch; tests inject their own so no suite
 * ever touches the network.
 *
 * The page token goes in the `Authorization` header, never a query string:
 * query strings land in proxy and access logs.
 */
export function metaInboundDeps(
  fetchImpl: typeof fetch = fetch,
): MetaInboundDeps {
  return {
    async fetchProfile({ connection, userId, channel }) {
      const fields =
        channel === "instagram" ? "name,username" : "first_name,last_name";
      try {
        const res = await fetchImpl(
          metaGraphUrl(`${encodeURIComponent(userId)}?fields=${fields}`),
          {
            headers: { authorization: `Bearer ${connection.accessToken}` },
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
          },
        );
        if (!res.ok) return null;
        const body = (await res.json()) as {
          name?: unknown;
          username?: unknown;
          first_name?: unknown;
          last_name?: unknown;
        };
        const name =
          fullName(body.first_name, body.last_name) ??
          (typeof body.name === "string" && body.name.trim() ? body.name.trim() : null) ??
          (typeof body.username === "string" && body.username.trim()
            ? body.username.trim()
            : null);
        return { name };
      } catch (err) {
        // A profile is a nicety; the message is the point. Never fatal.
        console.error(`[meta] profile fetch failed for ${userId}:`, err);
        return null;
      }
    },

    async download(url, maxBytes) {
      try {
        const res = await fetchImpl(url, {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const declared = Number(res.headers.get("content-length") ?? "0");
        if (declared > maxBytes) return null;
        if (!res.body) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          return bytes.byteLength > 0 && bytes.byteLength <= maxBytes
            ? bytes
            : null;
        }
        // Content-Length can be absent or lie, so the cap is enforced on the
        // bytes actually seen — the reader is cancelled the instant the
        // running total crosses maxBytes, never buffering an unbounded body.
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        if (total === 0) return null;
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      } catch {
        return null;
      }
    },
  };
}

export type MetaIngestOutcome =
  | {
      status: "recorded";
      direction: "inbound" | "outbound";
      enquiryId: string;
      messageId: string;
      createdEnquiry: boolean;
    }
  | { status: "duplicate"; enquiryId: string; messageId: string }
  | {
      status: "ignored";
      reason: "echo_known" | "no_message" | "unsupported" | "unknown_page";
    };

/**
 * Images become inline rows, everything else a link.
 *
 * Two hard rules, both carried from earlier phases:
 *   - the URL must be one of Meta's own CDN hosts before we fetch it at all
 *     (`isAllowedMetaAttachmentUrl`); anything else is a link, never a fetch;
 *   - bytes are stored ONLY when `sniffImageMime` recognises them, and the row
 *     records the SNIFFED mime — an `image` label on an SVG or an HTML payload
 *     must not end up served back to staff as an image.
 */
async function collectAttachments(
  event: MetaMessagingEvent,
  deps: MetaInboundDeps,
): Promise<StoreAttachmentInput[]> {
  const out: StoreAttachmentInput[] = [];
  let spent = 0;

  for (const attachment of event.attachments.slice(0, MAX_META_ATTACHMENTS)) {
    const url = attachment.url;
    const remaining = MAX_META_INLINE_TOTAL_BYTES - spent;
    const wantsBytes =
      attachment.type === "image" &&
      isAllowedMetaAttachmentUrl(url) &&
      remaining > 0;

    if (wantsBytes && url) {
      let downloaded: Uint8Array | null = null;
      try {
        downloaded = await deps.download(
          url,
          Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining),
        );
      } catch (err) {
        console.error(`[meta] attachment download failed for ${url}:`, err);
      }
      // Charged whether or not the bytes end up stored — a failed sniff still
      // cost the transfer.
      spent += downloaded
        ? downloaded.byteLength
        : Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining);
      const sniffed = downloaded ? sniffImageMime(downloaded) : null;
      if (downloaded && sniffed) {
        out.push({ mime: sniffed, filename: null, bytes: downloaded });
        continue;
      }
    }

    if (url) {
      out.push({ mime: "application/octet-stream", filename: null, url });
    }
    // else: no url and no bytes — unreachable in the inbox, so not written.
  }

  return out;
}

/** Never leave a bubble blank: say what arrived when there are no words. */
function bodyTextFor(event: MetaMessagingEvent): string | null {
  const text = event.text?.trim();
  if (text) return text;
  const n = event.attachments.length;
  if (n === 1) return "(sent an attachment)";
  if (n > 1) return `(sent ${n} attachments)`;
  return null;
}

export async function ingestMetaEvent(
  event: MetaMessagingEvent,
  deps: MetaInboundDeps = metaInboundDeps(),
): Promise<MetaIngestOutcome> {
  // Delivery/read receipts and postbacks are not conversation. Postbacks are
  // deliberately out of scope for this phase: we ship no menu or Get Started
  // button, so a postback can only be Meta's own default entry point.
  if (event.kind !== "message") {
    return { status: "ignored", reason: "unsupported" };
  }

  // No mid means no idempotency key — a retry would double-post it.
  if (!event.mid) return { status: "ignored", reason: "no_message" };
  const bodyText = bodyTextFor(event);
  if (!bodyText) return { status: "ignored", reason: "no_message" };

  // `entry.id` is the Page id (messenger) or the IG account id (instagram);
  // either way it is the connection's externalId. No connection means this
  // app is subscribed to a Page this studio never connected — not our traffic.
  const connection = await findConnectionByExternalId(event.entryId);
  if (!connection) return { status: "ignored", reason: "unknown_page" };

  const existing = await prisma.enquiryMessage.findUnique({
    where: { externalId: event.mid },
    select: { id: true, enquiryId: true },
  });
  if (existing) {
    // An echo we already hold is OUR OWN send coming back around — there is
    // nothing to record and nothing was duplicated. A non-echo we already hold
    // is a replayed delivery of customer traffic.
    return event.isEcho
      ? { status: "ignored", reason: "echo_known" }
      : {
          status: "duplicate",
          enquiryId: existing.enquiryId,
          messageId: existing.id,
        };
  }

  // Liveness for the Channels panel. Best-effort: a failure here must not
  // cost us the message.
  try {
    await touchConnectionEvent(connection.id, event.timestamp);
  } catch (err) {
    console.error(`[meta] could not touch connection ${connection.id}:`, err);
  }

  // A handle we already know needs no Graph call — profile fetches are rate
  // limited and this runs on every single message.
  const known = await prisma.customerIdentity.findUnique({
    where: {
      channel_externalId: {
        channel: event.channel,
        externalId: event.customerId,
      },
    },
    select: { displayName: true },
  });
  const profile = known
    ? { name: known.displayName }
    : await deps.fetchProfile({
        connection,
        userId: event.customerId,
        channel: event.channel,
      });
  const displayName = profile?.name?.trim() || UNKNOWN_SENDER_NAME[event.channel];

  const customer = await findOrCreateCustomer({
    name: displayName,
    identity: {
      channel: event.channel,
      externalId: event.customerId,
      displayName,
    },
  });

  const thread = await resolveThread({
    customerId: customer.id,
    channel: event.channel,
    // Meta carries no reply token — there is no header for us to put one in.
    // Threading falls through to the recent-open rule, then a new enquiry.
    threadToken: null,
    contactName: displayName || customer.name,
    contactPhone: customer.phone,
    now: event.timestamp,
  });

  const attachments = await collectAttachments(event, deps);
  const shared = {
    enquiryId: thread.enquiryId,
    customerId: customer.id,
    channel: event.channel,
    bodyText,
    fromAddress: event.customerId,
    externalId: event.mid,
    connectionId: connection.id,
    attachments,
    at: event.timestamp,
  };

  // An echo whose mid we have never seen is a staff reply typed into Meta's
  // own inbox. It belongs on the thread as OUTBOUND, with no author user —
  // we genuinely do not know which staff member sent it.
  const row = event.isEcho
    ? await recordOutbound({
        ...shared,
        authorUserId: null,
        fromName: META_INBOX_AUTHOR,
        deliveryStatus: "sent",
      })
    : await recordInbound({ ...shared, fromName: displayName });

  // `row.enquiryId`, not `thread.enquiryId`: when two deliveries of the same
  // event race, both can resolve a thread before either writes, and the loser
  // gets the winner's row back. The loser also freshly created an Enquiry that
  // now holds no message — clean it up. The `messages: none` guard makes this
  // a no-op unless this call actually lost.
  if (thread.created && row.enquiryId !== thread.enquiryId) {
    await prisma.enquiry.deleteMany({
      where: { id: thread.enquiryId, messages: { none: {} } },
    });
  }

  return {
    status: "recorded",
    direction: event.isEcho ? "outbound" : "inbound",
    enquiryId: row.enquiryId,
    messageId: row.id,
    createdEnquiry: thread.created && row.enquiryId === thread.enquiryId,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/meta-inbound.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole core suite**

Run: `npm test -w @bnb/core`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/channels/meta-inbound.ts \
  packages/core/src/services/channels/meta-inbound.test.ts
git commit -m "$(cat <<'EOF'
feat(core): ingestMetaEvent — Meta inbound identity, threading and attachments

PSID/IGSID resolves to a CustomerIdentity (profile fetched from Graph only for
a handle we have never seen, falling back to "Messenger user"/"Instagram
user"); threading uses the Phase-1 recent-open rule since Meta carries no
reply token; image attachments are downloaded only from Meta's own CDN hosts,
sniffed, and stored inline under a 16 MB budget, everything else kept as a
link. Unknown echoes land as OUTBOUND from the "Meta inbox"; known ones are
ignored; receipts and postbacks are unsupported; an unconnected Page is
unknown_page. Idempotent on the Meta mid.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 6: `GET/POST /api/webhooks/meta`

**Files:**
- Create: `apps/admin/src/app/api/webhooks/meta/route.ts`, `apps/admin/src/app/api/webhooks/meta/route.test.ts`

**Interfaces:**
- Consumes: `verifyHubChallenge`, `verifyMetaSignature`, `signMetaPayload`, `parseMetaWebhook`, `singleEventBody`, `META_SIGNATURE_HEADER` (T4); `ingestMetaEvent` / `MetaIngestOutcome` (T5); `recordWebhookFailure` (Phase 2); and from `@bnb/core/http`:
  ```ts
  export function json(data: unknown, status = 200): Response
  export function jsonError(status: number, error: string): Response
  ```
- Produces:
  ```ts
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  export async function GET(req: Request): Promise<Response>
  export async function POST(req: Request): Promise<Response>
  ```
- Status contract — `GET`: `503` no `META_VERIFY_TOKEN` · `403` wrong mode/token/no challenge · `200 text/plain` the challenge. `POST`: `503` no `META_APP_SECRET` · `413` oversize body · `401` bad/absent signature (no failure row — the panel records events we accepted and failed, not rejected traffic) · `200` everything else, with per-event failures written to `WebhookFailure(provider: "meta")`.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/app/api/webhooks/meta/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signMetaPayload } from "@bnb/core/services/channels/meta";
import messengerText from "@bnb/core/services/channels/__fixtures__/meta-messenger-text.json";
import delivery from "@bnb/core/services/channels/__fixtures__/meta-delivery.json";

/**
 * Unauthenticated but signature-verified, and it must never answer 5xx for a
 * processing failure — Meta disables a webhook that keeps erroring. Failures
 * become a WebhookFailure row (one per event, so Retry replays exactly what
 * broke) plus a 200.
 */
const ingestMetaEvent = vi.fn();
const recordWebhookFailure = vi.fn();

vi.mock("@bnb/core/services/channels/meta-inbound", () => ({
  ingestMetaEvent: (...a: unknown[]) => ingestMetaEvent(...a),
}));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  recordWebhookFailure: (...a: unknown[]) => recordWebhookFailure(...a),
}));

import { GET, POST } from "./route";

const APP_SECRET = "synthetic-app-secret-not-a-real-one";
const VERIFY_TOKEN = "synthetic-verify-token";
const ORIGINAL = {
  secret: process.env.META_APP_SECRET,
  token: process.env.META_VERIFY_TOKEN,
};

function signedRequest(
  body: unknown,
  opts: { secret?: string; header?: string | null; signBody?: string } = {},
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const header =
    opts.header === undefined
      ? signMetaPayload(opts.secret ?? APP_SECRET, opts.signBody ?? payload)
      : opts.header;
  return new Request("http://admin.test/api/webhooks/meta", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(header ? { "x-hub-signature-256": header } : {}),
    },
    body: payload,
  });
}

function getRequest(query: Record<string, string>) {
  const url = new URL("http://admin.test/api/webhooks/meta");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.META_VERIFY_TOKEN = VERIFY_TOKEN;
  ingestMetaEvent.mockResolvedValue({
    status: "recorded",
    direction: "inbound",
    enquiryId: "enq1",
    messageId: "msg1",
    createdEnquiry: true,
  });
  recordWebhookFailure.mockResolvedValue("wf1");
});

afterEach(() => {
  if (ORIGINAL.secret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = ORIGINAL.secret;
  if (ORIGINAL.token === undefined) delete process.env.META_VERIFY_TOKEN;
  else process.env.META_VERIFY_TOKEN = ORIGINAL.token;
});

describe("GET /api/webhooks/meta", () => {
  it("echoes hub.challenge as plain text for a correct handshake", async () => {
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1158201444",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    // Verbatim: Meta compares the body byte for byte, so no JSON, no newline.
    expect(await res.text()).toBe("1158201444");
  });

  it("403s a wrong verify token", async () => {
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong",
        "hub.challenge": "1",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("503s when the verify token is not configured", async () => {
    delete process.env.META_VERIFY_TOKEN;
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1",
      }),
    );
    expect(res.status).toBe(503);
  });
});

describe("POST /api/webhooks/meta", () => {
  it("processes every messaging event in a signed delivery", async () => {
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; outcomes: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.outcomes).toHaveLength(1);
    expect(ingestMetaEvent).toHaveBeenCalledTimes(1);
    expect(ingestMetaEvent.mock.calls[0][0]).toMatchObject({
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      channel: "messenger",
    });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("processes a multi-event delivery sequentially", async () => {
    const order: string[] = [];
    ingestMetaEvent.mockImplementation(async (event: { timestamp: Date }) => {
      order.push(event.timestamp.toISOString());
      return { status: "ignored", reason: "unsupported" };
    });
    const res = await POST(signedRequest(delivery));
    expect(res.status).toBe(200);
    expect(order).toEqual([
      "2026-09-08T20:06:40.000Z",
      "2026-09-08T20:06:41.000Z",
    ]);
  });

  it("503s when the app secret is not configured, without processing", async () => {
    delete process.env.META_APP_SECRET;
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(503);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("401s an unsigned request, and records nothing", async () => {
    const res = await POST(signedRequest(messengerText, { header: null }));
    expect(res.status).toBe(401);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("401s a body that was altered after signing", async () => {
    const res = await POST(
      signedRequest(messengerText, { signBody: '{"object":"page"}' }),
    );
    expect(res.status).toBe(401);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("413s an oversize body without buffering it", async () => {
    const huge = "x".repeat(1_048_577);
    const req = new Request("http://admin.test/api/webhooks/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(huge.length),
        "x-hub-signature-256": signMetaPayload(APP_SECRET, huge),
      },
      body: huge,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("records a failure and still answers 200 when an event throws", async () => {
    ingestMetaEvent.mockRejectedValue(new Error("Graph is down"));
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(recordWebhookFailure).toHaveBeenCalledWith({
      provider: "meta",
      externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      // The single-event body, so Retry replays exactly what broke.
      payload: {
        object: "page",
        entry: [
          expect.objectContaining({ id: "102938475610293" }),
        ],
      },
      error: "Graph is down",
    });
  });

  it("keeps going after one event fails", async () => {
    ingestMetaEvent
      .mockRejectedValueOnce(new Error("first blew up"))
      .mockResolvedValueOnce({ status: "ignored", reason: "unsupported" });
    const res = await POST(signedRequest(delivery));
    expect(res.status).toBe(200);
    expect(ingestMetaEvent).toHaveBeenCalledTimes(2);
    expect(recordWebhookFailure).toHaveBeenCalledTimes(1);
  });

  it("200s a correctly signed body that is not JSON, recording it once", async () => {
    const res = await POST(signedRequest("not json at all"));
    expect(res.status).toBe(200);
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "meta", externalId: null }),
    );
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("200s a signed body with no messaging events at all", async () => {
    const res = await POST(signedRequest({ object: "page", entry: [] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; outcomes: unknown[] };
    expect(body).toMatchObject({ ok: true, outcomes: [] });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/admin -- src/app/api/webhooks/meta/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Implement the route**

Create `apps/admin/src/app/api/webhooks/meta/route.ts`:

```ts
import { json, jsonError } from "@bnb/core/http";
import {
  META_SIGNATURE_HEADER,
  parseMetaWebhook,
  singleEventBody,
  verifyHubChallenge,
  verifyMetaSignature,
  type MetaMessagingEvent,
} from "@bnb/core/services/channels/meta";
import {
  ingestMetaEvent,
  type MetaIngestOutcome,
} from "@bnb/core/services/channels/meta-inbound";
import { recordWebhookFailure } from "@bnb/core/services/webhook-failures";

/**
 * GET/POST /api/webhooks/meta — Messenger + Instagram DMs.
 *
 * GET is Meta's subscription handshake: it calls this URL with our
 * `hub.verify_token` and a `hub.challenge` we echo back verbatim as
 * text/plain. POST is the event feed, signed with `X-Hub-Signature-256` =
 * `sha256=` + HMAC-SHA256(META_APP_SECRET, raw body).
 *
 * Everything past verification answers **200**, even on failure: Meta retries
 * and eventually DISABLES a webhook that keeps erroring, so returning a 5xx
 * for a broken event would take the whole channel offline. Instead each failed
 * event is written to `WebhookFailure` on its own — a delivery can carry many
 * events, and Retry should replay only the one that broke.
 *
 * Ships dark: with `META_VERIFY_TOKEN` / `META_APP_SECRET` unset both verbs
 * answer 503 and nothing is processed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated route: cap the body before doing any work with it. Checked
 * twice — against the (spoofable) `content-length` header before touching the
 * body at all, and against the actual bytes as they stream in, since a caller
 * can omit or lie about the header.
 */
const MAX_BODY_BYTES = 1_048_576;

/**
 * The raw body, or null when it exceeds the cap.
 *
 * Deliberately NOT `req.text()`: that buffers whatever the caller sends before
 * anything — signature verification included — has had a chance to reject it.
 * The bytes are decoded exactly once, as UTF-8, and that string is what the
 * signature is checked against: re-serialising would change the bytes.
 */
async function readCappedBody(req: Request): Promise<string | null> {
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Never lets a failed audit write turn into a 500. */
async function noteFailure(input: {
  externalId: string | null;
  payload: unknown;
  error: string;
}): Promise<void> {
  try {
    await recordWebhookFailure({
      provider: "meta",
      externalId: input.externalId,
      payload: input.payload,
      error: input.error,
    });
  } catch (err) {
    console.error("[webhooks/meta] could not record the failure:", err);
  }
}

export async function GET(req: Request): Promise<Response> {
  const result = verifyHubChallenge(
    new URL(req.url).searchParams,
    process.env.META_VERIFY_TOKEN,
  );
  if (!result.ok) {
    if (result.reason === "not_configured") {
      return jsonError(503, "META_VERIFY_TOKEN is not configured");
    }
    console.warn(`[webhooks/meta] rejected a verification: ${result.reason}`);
    return jsonError(403, "Verification failed");
  }
  // Verbatim plain text — Meta compares the body byte for byte.
  return new Response(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    return jsonError(503, "META_APP_SECRET is not configured");
  }

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "Payload too large");
  }

  // An oversize body is refused without a WebhookFailure row — there is
  // nothing to replay, and recording it would store the flood.
  const raw = await readCappedBody(req);
  if (raw === null) return jsonError(413, "Payload too large");

  const verified = verifyMetaSignature({
    appSecret: secret,
    payload: raw,
    header: req.headers.get(META_SIGNATURE_HEADER),
  });
  if (!verified.ok) {
    console.warn(`[webhooks/meta] rejected a delivery: ${verified.reason}`);
    return jsonError(401, "Invalid signature");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    await noteFailure({
      externalId: null,
      // Truncated for display only — an unparseable body cannot be replayed
      // as an event anyway, so the panel just needs enough to diagnose it.
      payload: { raw: raw.slice(0, 4000) },
      error: "Malformed JSON body on a correctly signed request",
    });
    return json({ ok: false, outcomes: [] }, 200);
  }

  const events: MetaMessagingEvent[] = parseMetaWebhook(body);
  const outcomes: MetaIngestOutcome[] = [];
  let failed = false;

  // Sequential on purpose: two messages from the same new customer in one
  // delivery must not race each other into two customers and two enquiries.
  for (const event of events) {
    try {
      outcomes.push(await ingestMetaEvent(event));
    } catch (err) {
      failed = true;
      const error = err instanceof Error ? err.message : String(err);
      console.error("[webhooks/meta] processing failed:", err);
      // Per event, not per delivery: Retry then replays exactly what broke.
      await noteFailure({
        externalId: event.mid,
        payload: singleEventBody(event),
        error,
      });
    }
  }

  return json({ ok: !failed, outcomes }, 200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @bnb/admin -- src/app/api/webhooks/meta/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api/webhooks/meta/route.ts \
  apps/admin/src/app/api/webhooks/meta/route.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): POST/GET /api/webhooks/meta — signed Messenger + Instagram events

GET answers Meta's hub.challenge handshake as verbatim text/plain (403 on a
wrong mode/token, 503 unconfigured). POST verifies X-Hub-Signature-256 over a
streamed, 1 MiB-capped raw body before parsing anything, then runs each
messaging event through ingestMetaEvent sequentially. Past verification it
always answers 200 — Meta disables a webhook that keeps erroring — and writes
one WebhookFailure per failed event so Retry replays exactly what broke.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 7: `sendMetaMessage`, reply-channel selection, composer error

**Files:**
- Create: `packages/core/src/services/channels/meta-outbound.ts`, `packages/core/src/services/channels/meta-outbound.test.ts`
- Modify: `packages/core/src/services/channels/email-outbound.ts` (context gains `lastInboundAt`), `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`, `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`, `apps/admin/src/app/(staff)/enquiries/actions.ts`, `apps/admin/src/app/(staff)/enquiries/actions.test.ts`

**Interfaces:**
- Consumes: `metaGraphUrl`, `splitOutboundText`, `isWithinSendWindow`, `isWindowGraphError`, `MetaWindowClosedError`, `MetaChannelKind` (T4); `getConnection` / `MetaConnection` (T3); `recordOutbound` (Phase 1 + T2); `EnquiryEmailContext` / `toEnquiryEmailContext` / `ENQUIRY_EMAIL_CONTEXT_SELECT` (T1 + T2); and the Phase-2 admin pieces, verbatim:
  ```ts
  export type ReplyChannel = "email" | "none";
  export function chooseReplyChannel(input: { lastInboundChannel: MessageChannelKind | null; hasEmail: boolean }): ReplyChannel
  export type ReplyResult = { ok: true; message: string } | { ok: false; error: string };
  export function validateReply(input: { message: string }): ReplyResult
  export interface ActionState { ok: boolean; message?: string }
  ```
- Produces:
  ```ts
  // packages/core/src/services/channels/email-outbound.ts
  EnquiryEmailContext gains: lastInboundAt: Date | null;

  // packages/core/src/services/channels/meta-outbound.ts
  export class MetaSendError extends Error {}
  export interface MetaReplyTarget { connection: MetaConnection; channel: MetaChannelKind; recipientId: string }
  export async function loadMetaReplyTarget(context: Pick<EnquiryEmailContext, "lastInboundChannel" | "lastInboundConnectionId" | "lastInboundFromAddress">): Promise<MetaReplyTarget | null>;
  export interface SendMetaMessageInput {
    connection: MetaConnection; channel: MetaChannelKind; recipientId: string;
    text: string; lastInboundAt: Date | null; now?: Date; fetchImpl?: typeof fetch;
  }
  export interface MetaSentPart { text: string; messageId: string }
  export async function sendMetaMessage(input: SendMetaMessageInput): Promise<MetaSentPart[]>;
  export interface SendEnquiryMetaInput {
    context: EnquiryEmailContext; target: MetaReplyTarget; body: string;
    authorUserId: string; now?: Date; fetchImpl?: typeof fetch;
  }
  export async function sendEnquiryMetaMessage(input: SendEnquiryMetaInput): Promise<{ messageIds: string[] }>;

  // apps/admin/.../enquiry-helpers.ts
  export type ReplyChannel = "email" | "messenger" | "instagram" | "none";
  export function chooseReplyChannel(input: { lastInboundChannel: MessageChannelKind | null; hasEmail: boolean; metaTargetReady: boolean }): ReplyChannel;
  ```

- [ ] **Step 1: Write the failing test for the send path**

Create `packages/core/src/services/channels/meta-outbound.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetaWindowClosedError } from "./meta";

const getConnection = vi.fn();
const recordOutbound = vi.fn();

vi.mock("../channel-connections", () => ({
  getConnection: (...a: unknown[]) => getConnection(...a),
}));
vi.mock("../enquiry-messages", () => ({
  recordOutbound: (...a: unknown[]) => recordOutbound(...a),
}));

const {
  loadMetaReplyTarget,
  MetaSendError,
  sendEnquiryMetaMessage,
  sendMetaMessage,
} = await import("./meta-outbound");

const CONNECTION = {
  id: "conn1",
  channel: "messenger" as const,
  externalId: "102938475610293",
  pageId: "102938475610293",
  igAccountId: "17841400000000000",
  name: "Boots 'n' Bandit",
  active: true,
  webhookSubscribedAt: new Date("2026-09-01T00:00:00Z"),
  lastEventAt: null,
  connectedAt: new Date("2026-09-01T00:00:00Z"),
  accessToken: "EAAG_synthetic_page_token",
};

const NOW = new Date("2026-09-08T12:00:00Z");
const RECENT = new Date("2026-09-08T09:00:00Z");
const STALE = new Date("2026-09-06T09:00:00Z");

function okFetch(ids: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () =>
    Response.json({ recipient_id: "7213456789012345", message_id: ids[i++] }),
  ) as unknown as typeof fetch;
}

const CONTEXT = {
  enquiryId: "enq1",
  threadToken: "tok12345678",
  customerId: "cus1",
  contactName: "Amy Rowe",
  contactEmail: null,
  subject: null,
  artistName: "Sarah North",
  lastInboundChannel: "messenger" as const,
  lastInboundMessageId: null,
  lastInboundSubject: null,
  lastInboundFromAddress: "7213456789012345",
  lastInboundConnectionId: "conn1",
  lastInboundAt: RECENT,
};

beforeEach(() => {
  vi.clearAllMocks();
  getConnection.mockResolvedValue(CONNECTION);
  recordOutbound.mockResolvedValue({ id: "msg1", enquiryId: "enq1" });
});

describe("loadMetaReplyTarget", () => {
  it("resolves the connection and recipient of the last inbound Meta message", async () => {
    expect(await loadMetaReplyTarget(CONTEXT)).toEqual({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
    });
  });

  it("is null for a non-Meta thread, or one missing either half", async () => {
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundChannel: "email" }),
    ).toBeNull();
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundConnectionId: null }),
    ).toBeNull();
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundFromAddress: null }),
    ).toBeNull();
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("is null when the connection is gone, disconnected, or unreadable", async () => {
    getConnection.mockResolvedValue(null);
    expect(await loadMetaReplyTarget(CONTEXT)).toBeNull();
    getConnection.mockResolvedValue({ ...CONNECTION, active: false });
    expect(await loadMetaReplyTarget(CONTEXT)).toBeNull();
  });
});

describe("sendMetaMessage", () => {
  it("posts to the PAGE messages endpoint with the token in the body", async () => {
    const fetchImpl = okFetch(["m_out_1"]);
    const parts = await sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Sarah has space in October — shall I book you a consult?",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });

    expect(parts).toEqual([
      {
        text: "Sarah has space in October — shall I book you a consult?",
        messageId: "m_out_1",
      },
    ]);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/messages",
    );
    // The token must NOT be in the URL — query strings land in access logs.
    expect(url).not.toContain("access_token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      recipient: { id: "7213456789012345" },
      messaging_type: "RESPONSE",
      message: { text: "Sarah has space in October — shall I book you a consult?" },
      access_token: "EAAG_synthetic_page_token",
    });
  });

  it("sends an Instagram reply through the same page endpoint", async () => {
    const fetchImpl = okFetch(["m_out_ig"]);
    await sendMetaMessage({
      connection: { ...CONNECTION, channel: "instagram", externalId: "17841400000000000" },
      channel: "instagram",
      recipientId: "6011223344556677",
      text: "It is still available!",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    const [url] = vi.mocked(fetchImpl).mock.calls[0] as [string];
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/messages",
    );
  });

  it("splits an over-long reply into consecutive sends", async () => {
    const fetchImpl = okFetch(["m_a", "m_b"]);
    const parts = await sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "word ".repeat(600), // 3000 chars
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    expect(parts.map((p) => p.messageId)).toEqual(["m_a", "m_b"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses before the request when the 24-hour window has shut", async () => {
    const fetchImpl = okFetch(["never"]);
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Too late",
        lastInboundAt: STALE,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps Graph's own window rejection to the same error", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: {
            message: "This message is sent outside of allowed window.",
            code: 10,
            error_subcode: 2018278,
          },
        },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Racing the window",
        lastInboundAt: RECENT,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
  });

  it("raises a MetaSendError for any other Graph failure, without the token", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { message: "Invalid OAuth access token.", code: 190 } },
        { status: 401 },
      ),
    ) as unknown as typeof fetch;
    const promise = sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Hello",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    await expect(promise).rejects.toBeInstanceOf(MetaSendError);
    await expect(promise).rejects.toThrow(/Invalid OAuth access token/);
    await expect(promise).rejects.not.toThrow(/EAAG_synthetic_page_token/);
  });
});

describe("sendEnquiryMetaMessage", () => {
  it("records ONE outbound message per part, each keyed by its own mid", async () => {
    const fetchImpl = okFetch(["m_a", "m_b"]);
    const result = await sendEnquiryMetaMessage({
      context: CONTEXT,
      target: {
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
      },
      body: "word ".repeat(600),
      authorUserId: "u1",
      now: NOW,
      fetchImpl,
    });

    expect(result.messageIds).toEqual(["m_a", "m_b"]);
    expect(recordOutbound).toHaveBeenCalledTimes(2);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      enquiryId: "enq1",
      customerId: "cus1",
      channel: "messenger",
      authorUserId: "u1",
      fromAddress: "7213456789012345",
      connectionId: "conn1",
      externalId: "m_a",
      deliveryStatus: "sent",
    });
    expect(recordOutbound.mock.calls[1][0]).toMatchObject({ externalId: "m_b" });
  });
});
```

**Why one row per part matters:** Meta echoes every message the API sends back to us as a `message_echoes` event. `ingestMetaEvent` treats an echo whose `mid` it already holds as `echo_known` and drops it. If a two-part reply were recorded as a single row keyed by the first `mid`, the second part's echo would come back unknown and be re-recorded as a "Meta inbox" message — the customer would see one reply and staff would see three.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/meta-outbound.test.ts`
Expected: FAIL — `Failed to resolve import "./meta-outbound"`.

- [ ] **Step 3: Add `lastInboundAt` to the reply context**

In `packages/core/src/services/channels/email-outbound.ts`:

```ts
// ENQUIRY_EMAIL_CONTEXT_SELECT gains, alongside `subject`:
  lastInboundAt: true,
```
```ts
// EnquiryEmailContext gains:
  /** When the customer last wrote — what the Meta 24-hour window is measured from. */
  lastInboundAt: Date | null;
```
```ts
// toEnquiryEmailContext() returns, additionally:
    lastInboundAt: enquiry.lastInboundAt,
```

- [ ] **Step 4: Implement `channels/meta-outbound.ts`**

```ts
import { getConnection, type MetaConnection } from "../channel-connections";
import { recordOutbound } from "../enquiry-messages";
import type { EnquiryEmailContext } from "./email-outbound";
import {
  isWindowGraphError,
  isWithinSendWindow,
  metaGraphUrl,
  MetaWindowClosedError,
  splitOutboundText,
  type MetaChannelKind,
} from "./meta";

/**
 * Outbound Messenger + Instagram.
 *
 * Both channels are served by the PAGE's `/{page-id}/messages` endpoint with
 * the page access token; an Instagram send differs only in that the recipient
 * id is an IGSID. That is why an `instagram` ChannelConnection stores its
 * owning `pageId` — the IG business account id alone cannot route a send.
 */

const SEND_TIMEOUT_MS = 15_000;

/** Graph refused the send for a reason that is not the messaging window. */
export class MetaSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaSendError";
  }
}

export interface MetaReplyTarget {
  connection: MetaConnection;
  channel: MetaChannelKind;
  /** The customer's PSID / IGSID. */
  recipientId: string;
}

/**
 * Where a Meta reply would go, or null when this thread has no live Meta
 * route — a non-Meta last inbound, a message recorded before connections
 * existed, a disconnected Page, or a token that no longer decrypts. Null is
 * not an error: the caller falls back to email.
 */
export async function loadMetaReplyTarget(
  context: Pick<
    EnquiryEmailContext,
    "lastInboundChannel" | "lastInboundConnectionId" | "lastInboundFromAddress"
  >,
): Promise<MetaReplyTarget | null> {
  const channel = context.lastInboundChannel;
  if (channel !== "messenger" && channel !== "instagram") return null;
  if (!context.lastInboundConnectionId || !context.lastInboundFromAddress) {
    return null;
  }
  const connection = await getConnection(context.lastInboundConnectionId);
  if (!connection || !connection.active) return null;
  return {
    connection,
    channel,
    recipientId: context.lastInboundFromAddress,
  };
}

export interface SendMetaMessageInput {
  connection: MetaConnection;
  channel: MetaChannelKind;
  recipientId: string;
  text: string;
  /** When the customer last wrote — the 24-hour window is measured from it. */
  lastInboundAt: Date | null;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export interface MetaSentPart {
  text: string;
  messageId: string;
}

interface GraphSendResponse {
  message_id?: unknown;
  error?: { message?: unknown; code?: unknown; error_subcode?: unknown };
}

/**
 * Send one reply, split across as many messages as the 2000-character limit
 * needs, and return each part with the `mid` Meta assigned it.
 *
 * The window is checked BEFORE the request: sending outside it is a policy
 * violation, and a rejected send still counts against the app. Graph's own
 * window rejection (code 10 / subcode 2018278) is mapped to the same error for
 * the race where the window shuts between the check and the request.
 *
 * The access token travels in the request BODY, never the URL: a query string
 * is written to proxy logs, browser history and error trackers.
 */
export async function sendMetaMessage(
  input: SendMetaMessageInput,
): Promise<MetaSentPart[]> {
  const now = input.now ?? new Date();
  if (!isWithinSendWindow(input.lastInboundAt, now)) {
    throw new MetaWindowClosedError(input.channel);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = metaGraphUrl(`${input.connection.pageId}/messages`);
  const parts = splitOutboundText(input.text);
  const sent: MetaSentPart[] = [];

  for (const text of parts) {
    let body: GraphSendResponse;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: { id: input.recipientId },
          messaging_type: "RESPONSE",
          message: { text },
          access_token: input.connection.accessToken,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      body = (await res.json()) as GraphSendResponse;
    } catch (err) {
      // A transport failure after part 1 has already gone out is why the
      // parts sent so far are NOT rolled back — the customer has them.
      throw new MetaSendError(
        `Meta send failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (body.error) {
      if (isWindowGraphError(body.error)) {
        throw new MetaWindowClosedError(input.channel);
      }
      // Only Graph's own message — never the request, which holds the token.
      const message =
        typeof body.error.message === "string"
          ? body.error.message
          : "unknown Graph error";
      throw new MetaSendError(`Meta refused the message: ${message}`);
    }

    const messageId =
      typeof body.message_id === "string" ? body.message_id : null;
    if (!messageId) {
      throw new MetaSendError("Meta returned no message id for the reply.");
    }
    sent.push({ text, messageId });
  }

  return sent;
}

export interface SendEnquiryMetaInput {
  context: EnquiryEmailContext;
  target: MetaReplyTarget;
  body: string;
  authorUserId: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}

/**
 * The staff reply, sent and threaded.
 *
 * ONE `EnquiryMessage` per part, each keyed by its own `mid`: Meta echoes
 * everything the API sends back to us, and `ingestMetaEvent` drops an echo
 * whose mid it already holds. Recording a two-part reply as a single row would
 * leave part two's echo unrecognised and re-recorded as a "Meta inbox"
 * message — one reply for the customer, three bubbles for staff.
 */
export async function sendEnquiryMetaMessage(
  input: SendEnquiryMetaInput,
): Promise<{ messageIds: string[] }> {
  const parts = await sendMetaMessage({
    connection: input.target.connection,
    channel: input.target.channel,
    recipientId: input.target.recipientId,
    text: input.body,
    lastInboundAt: input.context.lastInboundAt,
    now: input.now,
    fetchImpl: input.fetchImpl,
  });

  for (const part of parts) {
    await recordOutbound({
      enquiryId: input.context.enquiryId,
      customerId: input.context.customerId,
      channel: input.target.channel,
      bodyText: part.text,
      fromAddress: input.target.recipientId,
      connectionId: input.target.connection.id,
      externalId: part.messageId,
      authorUserId: input.authorUserId,
      deliveryStatus: "sent",
    });
  }

  return { messageIds: parts.map((p) => p.messageId) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/meta-outbound.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for reply-channel selection**

Replace the `chooseReplyChannel` block in `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts` with:

```ts
describe("chooseReplyChannel", () => {
  it("replies on the Meta channel the customer last used, when it is live", () => {
    expect(
      chooseReplyChannel({
        lastInboundChannel: "messenger",
        hasEmail: true,
        metaTargetReady: true,
      }),
    ).toBe("messenger");
    expect(
      chooseReplyChannel({
        lastInboundChannel: "instagram",
        hasEmail: false,
        metaTargetReady: true,
      }),
    ).toBe("instagram");
  });

  it("falls back to email when the Meta route is not usable", () => {
    // Page disconnected, token unreadable, or a message from before
    // connections existed: the words must still reach the customer.
    expect(
      chooseReplyChannel({
        lastInboundChannel: "messenger",
        hasEmail: true,
        metaTargetReady: false,
      }),
    ).toBe("email");
    expect(
      chooseReplyChannel({
        lastInboundChannel: "instagram",
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
  });

  it("replies by email for every non-Meta thread with an address", () => {
    for (const lastInboundChannel of ["email", "web", "note", null] as const) {
      expect(
        chooseReplyChannel({
          lastInboundChannel,
          hasEmail: true,
          metaTargetReady: true,
        }),
      ).toBe("email");
    }
  });

  it("has no reachable channel without an address or a Meta route", () => {
    expect(
      chooseReplyChannel({
        lastInboundChannel: "email",
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
    expect(
      chooseReplyChannel({
        lastInboundChannel: null,
        hasEmail: false,
        metaTargetReady: false,
      }),
    ).toBe("none");
  });
});
```

Append to `apps/admin/src/app/(staff)/enquiries/actions.test.ts` (extend the `@bnb/core/services/channels/meta-outbound` mock alongside the existing mocks):

```ts
vi.mock("@bnb/core/services/channels/meta-outbound", () => ({
  loadMetaReplyTarget: vi.fn(),
  sendEnquiryMetaMessage: vi.fn(),
  MetaSendError: class MetaSendError extends Error {},
}));
const { loadMetaReplyTarget, sendEnquiryMetaMessage } = await import(
  "@bnb/core/services/channels/meta-outbound"
);
const { MetaWindowClosedError } = await import(
  "@bnb/core/services/channels/meta"
);

const META_TARGET = {
  connection: { id: "conn1", pageId: "102938475610293", accessToken: "x" },
  channel: "messenger" as const,
  recipientId: "7213456789012345",
};

function metaEnquiry() {
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    role: "OWNER",
    displayName: "Owner",
    artistId: null,
    email: "owner@example.test",
  } as never);
  vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
    id: "e1",
    customerId: "c1",
    contactEmail: null,
    contactName: "Amy Rowe",
    preferredArtistId: null,
    style: null,
    placement: null,
    source: "web",
    status: "new",
    threadToken: "tok12345678",
    subject: null,
    lastInboundAt: new Date("2026-09-08T09:00:00Z"),
    preferredArtist: null,
    customer: { email: null },
    messages: [
      {
        channel: "messenger",
        subject: null,
        messageIdHeader: null,
        fromAddress: "7213456789012345",
        connectionId: "conn1",
      },
    ],
  } as never);
}

describe("replyToEnquiry on a Meta thread", () => {
  it("sends through the Meta channel and marks the enquiry replied", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);
    vi.mocked(sendEnquiryMetaMessage).mockResolvedValue({
      messageIds: ["m_out_1"],
    });

    const res = await replyToEnquiry("e1", { message: "Yes, October works." });

    expect(res).toEqual({
      ok: true,
      message: "Reply sent on Messenger and enquiry marked replied.",
    });
    expect(sendEnquiryMetaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: META_TARGET,
        body: "Yes, October works.",
        authorUserId: "u1",
      }),
    );
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("surfaces the 24-hour window as a composer error, sending nothing else", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);
    vi.mocked(sendEnquiryMetaMessage).mockRejectedValue(
      new MetaWindowClosedError("messenger"),
    );

    const res = await replyToEnquiry("e1", { message: "Are you still there?" });

    expect(res).toEqual({
      ok: false,
      message:
        "Messenger/Instagram only allows replies within 24 hours of the customer's last message — email them instead.",
    });
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });

  it("falls back to email when the Page is disconnected", async () => {
    metaEnquiry();
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      id: "e1",
      customerId: "c1",
      contactEmail: "amy@example.test",
      contactName: "Amy Rowe",
      preferredArtistId: null,
      style: null,
      placement: null,
      source: "web",
      status: "new",
      threadToken: "tok12345678",
      subject: null,
      lastInboundAt: new Date("2026-09-08T09:00:00Z"),
      preferredArtist: null,
      customer: { email: "amy@example.test" },
      messages: [
        {
          channel: "messenger",
          subject: null,
          messageIdHeader: null,
          fromAddress: "7213456789012345",
          connectionId: "conn1",
        },
      ],
    } as never);
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(null);
    vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "re_1", status: "sent" });

    const res = await replyToEnquiry("e1", { message: "Hello again" });

    expect(res.ok).toBe(true);
    expect(sendEnquiryMetaMessage).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: FAIL — `chooseReplyChannel` ignores `metaTargetReady`, and `replyToEnquiry` never calls the Meta path.

- [ ] **Step 8: Implement the admin side**

In `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` replace `ReplyChannel` and `chooseReplyChannel`:

```ts
export type ReplyChannel = "email" | "messenger" | "instagram" | "none";

/** How the composer names the channel it is about to use. */
export const REPLY_CHANNEL_LABEL: Record<
  Exclude<ReplyChannel, "none">,
  string
> = {
  email: "email",
  messenger: "Messenger",
  instagram: "Instagram",
};

/**
 * Which channel a staff reply goes out on: the channel of the LAST INBOUND
 * message, per the spec.
 *
 * `metaTargetReady` is the caller's answer to "is there a live Page behind
 * that Meta message?" — an active ChannelConnection with a readable token and
 * a recipient id. When there is not (the Page was disconnected, the token no
 * longer decrypts, or the message predates connections) the reply falls back
 * to email rather than failing: the customer's words matter more than the
 * channel they arrive on.
 */
export function chooseReplyChannel(input: {
  lastInboundChannel: MessageChannelKind | null;
  hasEmail: boolean;
  metaTargetReady: boolean;
}): ReplyChannel {
  const last = input.lastInboundChannel;
  if ((last === "messenger" || last === "instagram") && input.metaTargetReady) {
    return last;
  }
  return input.hasEmail ? "email" : "none";
}
```

In `apps/admin/src/app/(staff)/enquiries/actions.ts` add the imports:

```ts
import { MetaWindowClosedError } from "@bnb/core/services/channels/meta";
import {
  loadMetaReplyTarget,
  sendEnquiryMetaMessage,
} from "@bnb/core/services/channels/meta-outbound";
import { REPLY_CHANNEL_LABEL } from "./enquiry-helpers";
```

and rewrite the channel selection + send in `replyToEnquiry` (everything between building `context` and `updateEnquiryStatus`):

```ts
  const context = toEnquiryEmailContext(enquiry);

  // Resolved first, because "can we reply on Meta?" is the question that
  // decides the channel — not a consequence of having picked it.
  const metaTarget = await loadMetaReplyTarget(context);
  const channel = chooseReplyChannel({
    lastInboundChannel: context.lastInboundChannel,
    hasEmail: Boolean(context.contactEmail),
    metaTargetReady: metaTarget !== null,
  });

  if (channel === "none") {
    // …unchanged internal-note branch…
  }

  if (channel === "messenger" || channel === "instagram") {
    try {
      await sendEnquiryMetaMessage({
        context,
        target: metaTarget!,
        body: valid.message,
        authorUserId: user.id,
      });
    } catch (err) {
      if (err instanceof MetaWindowClosedError) {
        // The one error staff can act on: the 24-hour window. Nothing is
        // recorded and the status is untouched — nothing was sent.
        return { ok: false, message: err.message };
      }
      console.error(`[enquiries] Meta reply failed for ${enquiryId}:`, err);
      return {
        ok: false,
        message: `The reply could not be sent on ${REPLY_CHANNEL_LABEL[channel]} — check Studio › Channels.`,
      };
    }
    await updateEnquiryStatus(enquiryId, "replied");
    const claim = await claimIfUnassigned(user, enquiry);
    revalidatePath("/enquiries");
    return {
      ok: true,
      message: withClaimNote(
        `Reply sent on ${REPLY_CHANNEL_LABEL[channel]} and enquiry marked replied.`,
        claim,
      ),
    };
  }

  // …unchanged email branch…
```

- [ ] **Step 9: Run them to verify they pass**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/services/channels/meta-outbound.ts \
  packages/core/src/services/channels/meta-outbound.test.ts \
  packages/core/src/services/channels/email-outbound.ts \
  "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts" \
  "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts" \
  "apps/admin/src/app/(staff)/enquiries/actions.ts" \
  "apps/admin/src/app/(staff)/enquiries/actions.test.ts"
git commit -m "$(cat <<'EOF'
feat(admin): reply on Messenger and Instagram from the enquiry composer

sendMetaMessage posts to the page /messages endpoint with the token in the
BODY (never a query string), splitting past 2000 characters and recording one
outbound EnquiryMessage per part so Meta's own echo of each part is recognised
instead of re-recorded. The 24-hour messaging window is checked before the
request and Graph's code 10 / subcode 2018278 maps to the same typed error,
which the composer shows as "email them instead". chooseReplyChannel now picks
the Meta channel of the last inbound message when a live Page backs it, and
falls back to email when it does not.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 8: Connect Page flow (Facebook Login for Business → `ChannelConnection`)

**Files:**
- Create: `packages/core/src/services/channels/meta-oauth.ts`, `packages/core/src/services/channels/meta-oauth.test.ts`, `apps/admin/src/app/(staff)/studio/channels/meta-actions.ts`, `apps/admin/src/app/(staff)/studio/channels/meta-actions.test.ts`, `apps/admin/src/app/api/meta/oauth/callback/route.ts`, `apps/admin/src/app/api/meta/oauth/callback/route.test.ts`

**Interfaces:**
- Consumes: `metaGraphUrl` / `metaGraphVersion` (T4); `upsertChannelConnection` / `ChannelConnectionRow` / `deleteConnection` (T3); `requireRole` and `generateToken`:
  ```ts
  // @bnb/core/auth
  export type SessionRole = "OWNER" | "ARTIST";
  export async function requireRole(role?: SessionRole): Promise<SessionUser>
  // @bnb/core/auth/tokens
  export function generateToken(bytes?: number): string   // base64url
  ```
- Produces:
  ```ts
  // packages/core/src/services/channels/meta-oauth.ts
  export const META_OAUTH_SCOPES: readonly string[];
  export const META_SUBSCRIBED_FIELDS = "messages,message_echoes,messaging_postbacks";
  export function metaLoginDialogUrl(input: { appId: string; redirectUri: string; state: string; env?: NodeJS.ProcessEnv }): string;
  export interface MetaPageAccount { id: string; name: string; accessToken: string; igAccountId: string | null; igUsername: string | null }
  export function parseMetaAccounts(body: unknown): MetaPageAccount[];
  export interface MetaOAuthDeps {
    exchangeCode(input: { code: string; redirectUri: string }): Promise<string>;
    exchangeLongLived(userToken: string): Promise<string>;
    listAccounts(userToken: string): Promise<MetaPageAccount[]>;
    subscribeApp(input: { pageId: string; pageToken: string }): Promise<boolean>;
  }
  export function metaOAuthDeps(fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv): MetaOAuthDeps;
  export interface ConnectMetaResult { connected: ChannelConnectionRow[]; warnings: string[] }
  export async function connectMetaPages(input: { code: string; redirectUri: string; deps?: MetaOAuthDeps }): Promise<ConnectMetaResult>;

  // apps/admin/.../studio/channels/meta-actions.ts
  export const META_STATE_COOKIE = "bb_meta_oauth_state";
  export const META_STATE_TTL_SECONDS = 600;
  export async function connectMetaAction(): Promise<void>;      // redirects
  export async function disconnectMetaAction(fd: FormData): Promise<void>;

  // apps/admin/src/app/api/meta/oauth/callback/route.ts
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  export async function GET(req: Request): Promise<Response>;
  ```

- [ ] **Step 1: Write the failing test for the OAuth core**

Create `packages/core/src/services/channels/meta-oauth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertChannelConnection = vi.fn();
vi.mock("../channel-connections", () => ({
  upsertChannelConnection: (...a: unknown[]) => upsertChannelConnection(...a),
}));

const {
  connectMetaPages,
  metaLoginDialogUrl,
  META_OAUTH_SCOPES,
  META_SUBSCRIBED_FIELDS,
  parseMetaAccounts,
} = await import("./meta-oauth");

const ACCOUNTS_BODY = {
  data: [
    {
      id: "102938475610293",
      name: "Boots 'n' Bandit",
      access_token: "EAAG_page_token_synthetic",
      instagram_business_account: {
        id: "17841400000000000",
        username: "bootsnbandit",
      },
    },
    {
      id: "204958671029384",
      name: "Boots 'n' Bandit Flash",
      access_token: "EAAG_second_page_token",
    },
    { id: "no-token-page", name: "Broken" },
  ],
};

describe("metaLoginDialogUrl", () => {
  it("builds the Facebook Login for Business dialog with every scope we need", () => {
    const url = new URL(
      metaLoginDialogUrl({
        appId: "1234567890",
        redirectUri: "https://admin.example.test/api/meta/oauth/callback",
        state: "nonce-abc",
        env: {} as NodeJS.ProcessEnv,
      }),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v21.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("1234567890");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/meta/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("nonce-abc");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      ...META_OAUTH_SCOPES,
    ]);
    expect([...META_OAUTH_SCOPES]).toEqual([
      "pages_messaging",
      "pages_manage_metadata",
      "pages_show_list",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ]);
  });
});

describe("parseMetaAccounts", () => {
  it("reads each page with a token, and its linked IG account", () => {
    expect(parseMetaAccounts(ACCOUNTS_BODY)).toEqual([
      {
        id: "102938475610293",
        name: "Boots 'n' Bandit",
        accessToken: "EAAG_page_token_synthetic",
        igAccountId: "17841400000000000",
        igUsername: "bootsnbandit",
      },
      {
        id: "204958671029384",
        name: "Boots 'n' Bandit Flash",
        accessToken: "EAAG_second_page_token",
        igAccountId: null,
        igUsername: null,
      },
    ]);
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseMetaAccounts(null)).toEqual([]);
    expect(parseMetaAccounts({})).toEqual([]);
    expect(parseMetaAccounts({ data: "nope" })).toEqual([]);
  });
});

describe("connectMetaPages", () => {
  const deps = {
    exchangeCode: vi.fn(async () => "SHORT_USER_TOKEN"),
    exchangeLongLived: vi.fn(async () => "LONG_USER_TOKEN"),
    listAccounts: vi.fn(async () => parseMetaAccounts(ACCOUNTS_BODY)),
    subscribeApp: vi.fn(async () => true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.exchangeCode.mockResolvedValue("SHORT_USER_TOKEN");
    deps.exchangeLongLived.mockResolvedValue("LONG_USER_TOKEN");
    deps.listAccounts.mockResolvedValue(parseMetaAccounts(ACCOUNTS_BODY));
    deps.subscribeApp.mockResolvedValue(true);
    upsertChannelConnection.mockImplementation(
      async (input: { externalId: string; channel: string; name: string }) => ({
        id: `row-${input.externalId}`,
        ...input,
      }),
    );
  });

  it("exchanges the code for a long-lived token, then stores one row per destination", async () => {
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
      deps,
    });

    expect(deps.exchangeCode).toHaveBeenCalledWith({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
    });
    expect(deps.exchangeLongLived).toHaveBeenCalledWith("SHORT_USER_TOKEN");
    expect(deps.listAccounts).toHaveBeenCalledWith("LONG_USER_TOKEN");

    // Two pages + one linked Instagram account = three connections.
    expect(result.connected).toHaveLength(3);
    expect(result.warnings).toEqual([]);
    expect(upsertChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "messenger",
        externalId: "102938475610293",
        pageId: "102938475610293",
        igAccountId: "17841400000000000",
        name: "Boots 'n' Bandit",
        accessToken: "EAAG_page_token_synthetic",
      }),
    );
    expect(upsertChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "instagram",
        externalId: "17841400000000000",
        // The IG row carries the PAGE id: an Instagram send goes through the
        // page's /messages endpoint, and the IG id alone cannot route it.
        pageId: "102938475610293",
        name: "Boots 'n' Bandit (@bootsnbandit)",
        accessToken: "EAAG_page_token_synthetic",
      }),
    );
  });

  it("subscribes the app to the messaging fields for each page", async () => {
    await connectMetaPages({ code: "CODE", redirectUri: "https://x.test/cb", deps });
    expect(deps.subscribeApp).toHaveBeenCalledTimes(2);
    expect(deps.subscribeApp).toHaveBeenCalledWith({
      pageId: "102938475610293",
      pageToken: "EAAG_page_token_synthetic",
    });
    expect(META_SUBSCRIBED_FIELDS).toBe(
      "messages,message_echoes,messaging_postbacks",
    );
    expect(
      upsertChannelConnection.mock.calls[0][0].webhookSubscribedAt,
    ).toBeInstanceOf(Date);
  });

  it("still connects a page whose subscription failed, and says so", async () => {
    deps.subscribeApp.mockResolvedValue(false);
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://x.test/cb",
      deps,
    });
    expect(result.connected).toHaveLength(3);
    expect(result.warnings).toEqual([
      "Boots 'n' Bandit: connected, but the webhook subscription failed — retry Connect.",
      "Boots 'n' Bandit Flash: connected, but the webhook subscription failed — retry Connect.",
    ]);
    expect(upsertChannelConnection.mock.calls[0][0].webhookSubscribedAt).toBeNull();
  });

  it("reports no pages rather than pretending to succeed", async () => {
    deps.listAccounts.mockResolvedValue([]);
    const result = await connectMetaPages({
      code: "CODE",
      redirectUri: "https://x.test/cb",
      deps,
    });
    expect(result.connected).toEqual([]);
    expect(result.warnings).toEqual([
      "That Facebook account manages no Pages this app can use — check you granted access to the studio Page.",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @bnb/core -- src/services/channels/meta-oauth.test.ts`
Expected: FAIL — `Failed to resolve import "./meta-oauth"`.

- [ ] **Step 3: Implement `channels/meta-oauth.ts`**

```ts
import {
  upsertChannelConnection,
  type ChannelConnectionRow,
} from "../channel-connections";
import { metaGraphUrl, metaGraphVersion } from "./meta";

/**
 * Facebook Login for Business → `ChannelConnection` rows.
 *
 * The owner is sent to Meta's OAuth dialog, comes back with a `code`, and this
 * module turns it into: a short-lived user token → a long-lived user token →
 * the Pages that account manages (each with its own page token) → one
 * connection per Page plus one per linked Instagram business account → a
 * webhook subscription on each Page.
 *
 * Every network call is behind `MetaOAuthDeps`, so the whole orchestration is
 * testable without a socket.
 */

/**
 * pages_messaging          send and receive Messenger messages
 * pages_manage_metadata    subscribe the app to the Page's webhooks
 * pages_show_list          enumerate the Pages the account manages
 * instagram_basic          read the linked IG business account
 * instagram_manage_messages send and receive Instagram DMs
 * business_management      required for App Review of the above
 */
export const META_OAUTH_SCOPES = [
  "pages_messaging",
  "pages_manage_metadata",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
] as const;

/** The webhook fields each connected Page is subscribed to. */
export const META_SUBSCRIBED_FIELDS =
  "messages,message_echoes,messaging_postbacks";

export function metaLoginDialogUrl(input: {
  appId: string;
  redirectUri: string;
  /** Signed nonce, echoed back by Meta — the CSRF guard on the callback. */
  state: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const url = new URL(
    `https://www.facebook.com/${metaGraphVersion(input.env)}/dialog/oauth`,
  );
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
  return url.toString();
}

export interface MetaPageAccount {
  id: string;
  name: string;
  accessToken: string;
  igAccountId: string | null;
  igUsername: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}` */
export function parseMetaAccounts(body: unknown): MetaPageAccount[] {
  if (typeof body !== "object" || body === null) return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const out: MetaPageAccount[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const page = item as {
      id?: unknown;
      name?: unknown;
      access_token?: unknown;
      instagram_business_account?: { id?: unknown; username?: unknown };
    };
    const id = str(page.id);
    const accessToken = str(page.access_token);
    // A Page with no token is a Page we cannot act on — skip it rather than
    // storing a connection that can never send.
    if (!id || !accessToken) continue;
    out.push({
      id,
      name: str(page.name) ?? id,
      accessToken,
      igAccountId: str(page.instagram_business_account?.id),
      igUsername: str(page.instagram_business_account?.username),
    });
  }
  return out;
}

export interface MetaOAuthDeps {
  exchangeCode(input: { code: string; redirectUri: string }): Promise<string>;
  exchangeLongLived(userToken: string): Promise<string>;
  listAccounts(userToken: string): Promise<MetaPageAccount[]>;
  subscribeApp(input: { pageId: string; pageToken: string }): Promise<boolean>;
}

const OAUTH_TIMEOUT_MS = 15_000;

/** Graph error bodies carry the useful message; never echo the request back. */
async function graphJson(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json()) as Record<string, unknown>;
  const error = body.error as { message?: unknown } | undefined;
  if (error) {
    throw new Error(
      typeof error.message === "string" ? error.message : "Graph API error",
    );
  }
  if (!res.ok) throw new Error(`Graph API returned ${res.status}`);
  return body;
}

export function metaOAuthDeps(
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): MetaOAuthDeps {
  function credentials(): { appId: string; appSecret: string } {
    const appId = env.META_APP_ID?.trim();
    const appSecret = env.META_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new Error(
        "META_APP_ID and META_APP_SECRET must both be set to connect a Page.",
      );
    }
    return { appId, appSecret };
  }

  // Token exchanges are documented as GET with query parameters — that is the
  // only Graph endpoint family where the secret cannot travel in a body. It is
  // an outbound request to graph.facebook.com over TLS and is never logged by
  // us; nothing else in this codebase puts a credential in a URL.
  async function get(path: string, params: Record<string, string>) {
    const url = new URL(metaGraphUrl(path, env));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
    });
    return graphJson(res);
  }

  return {
    async exchangeCode({ code, redirectUri }) {
      const { appId, appSecret } = credentials();
      const body = await get("oauth/access_token", {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      });
      const token = str(body.access_token);
      if (!token) throw new Error("Meta returned no access token for the code.");
      return token;
    },

    async exchangeLongLived(userToken) {
      const { appId, appSecret } = credentials();
      const body = await get("oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userToken,
      });
      const token = str(body.access_token);
      if (!token) throw new Error("Meta returned no long-lived access token.");
      return token;
    },

    async listAccounts(userToken) {
      const res = await fetchImpl(
        metaGraphUrl(
          "me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D",
          env,
        ),
        {
          headers: { authorization: `Bearer ${userToken}` },
          signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
        },
      );
      return parseMetaAccounts(await graphJson(res));
    },

    async subscribeApp({ pageId, pageToken }) {
      try {
        const res = await fetchImpl(
          metaGraphUrl(`${pageId}/subscribed_apps`, env),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              subscribed_fields: META_SUBSCRIBED_FIELDS,
              access_token: pageToken,
            }),
            signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
          },
        );
        const body = (await res.json()) as { success?: unknown };
        return res.ok && body.success !== false;
      } catch (err) {
        console.error(`[meta] subscribe failed for page ${pageId}:`, err);
        return false;
      }
    },
  };
}

export interface ConnectMetaResult {
  connected: ChannelConnectionRow[];
  /** Things the owner should know, shown as a flash. Never fatal. */
  warnings: string[];
}

export async function connectMetaPages(input: {
  code: string;
  redirectUri: string;
  deps?: MetaOAuthDeps;
}): Promise<ConnectMetaResult> {
  const deps = input.deps ?? metaOAuthDeps();

  const shortLived = await deps.exchangeCode({
    code: input.code,
    redirectUri: input.redirectUri,
  });
  // Short-lived tokens last ~1 hour; the long-lived one lasts ~60 days and is
  // what makes the page tokens below effectively permanent.
  const longLived = await deps.exchangeLongLived(shortLived);
  const pages = await deps.listAccounts(longLived);

  if (pages.length === 0) {
    return {
      connected: [],
      warnings: [
        "That Facebook account manages no Pages this app can use — check you granted access to the studio Page.",
      ],
    };
  }

  const connected: ChannelConnectionRow[] = [];
  const warnings: string[] = [];

  for (const page of pages) {
    // Subscribe FIRST so the stored `webhookSubscribedAt` reflects reality.
    const subscribed = await deps.subscribeApp({
      pageId: page.id,
      pageToken: page.accessToken,
    });
    if (!subscribed) {
      warnings.push(
        `${page.name}: connected, but the webhook subscription failed — retry Connect.`,
      );
    }
    const webhookSubscribedAt = subscribed ? new Date() : null;

    connected.push(
      await upsertChannelConnection({
        channel: "messenger",
        externalId: page.id,
        pageId: page.id,
        igAccountId: page.igAccountId,
        name: page.name,
        accessToken: page.accessToken,
        webhookSubscribedAt,
      }),
    );

    if (page.igAccountId) {
      connected.push(
        await upsertChannelConnection({
          channel: "instagram",
          // Instagram webhooks address the IG business account id…
          externalId: page.igAccountId,
          // …but a send goes through the PAGE endpoint, so the page id rides
          // along. The same page token authorises both.
          pageId: page.id,
          igAccountId: page.igAccountId,
          name: page.igUsername
            ? `${page.name} (@${page.igUsername})`
            : `${page.name} (Instagram)`,
          accessToken: page.accessToken,
          webhookSubscribedAt,
        }),
      );
    }
  }

  return { connected, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channels/meta-oauth.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the admin actions + callback**

Create `apps/admin/src/app/(staff)/studio/channels/meta-actions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireRole = vi.fn();
const deleteConnection = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@bnb/core/services/channel-connections", () => ({
  deleteConnection: (...a: unknown[]) => deleteConnection(...a),
}));

const { connectMetaAction, disconnectMetaAction, META_STATE_COOKIE } =
  await import("./meta-actions");

const ORIGINAL = {
  appId: process.env.META_APP_ID,
  origin: process.env.APP_ORIGIN,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = "1234567890";
  process.env.APP_ORIGIN = "https://admin.example.test";
  requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
});

afterEach(() => {
  if (ORIGINAL.appId === undefined) delete process.env.META_APP_ID;
  else process.env.META_APP_ID = ORIGINAL.appId;
  if (ORIGINAL.origin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = ORIGINAL.origin;
});

describe("connectMetaAction", () => {
  it("is owner-only", async () => {
    await expect(connectMetaAction()).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("OWNER");
  });

  it("stores a short-lived httpOnly state nonce and redirects to Meta", async () => {
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);

    const [name, value, options] = cookieSet.mock.calls[0];
    expect(name).toBe(META_STATE_COOKIE);
    expect(String(value).length).toBeGreaterThan(20);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const url = new URL(String(redirect.mock.calls[0][0]));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.searchParams.get("state")).toBe(value);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/meta/oauth/callback",
    );
  });

  it("redirects back with an error when the app is not configured", async () => {
    delete process.env.META_APP_ID;
    await expect(connectMetaAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(String(redirect.mock.calls[0][0])).toBe(
      "/studio/channels?meta_error=not_configured",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe("disconnectMetaAction", () => {
  it("deletes the connection an owner named", async () => {
    const fd = new FormData();
    fd.set("id", "conn1");
    await disconnectMetaAction(fd);
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(deleteConnection).toHaveBeenCalledWith("conn1");
  });

  it("does nothing without an id, rather than throwing at the owner", async () => {
    await disconnectMetaAction(new FormData());
    expect(deleteConnection).not.toHaveBeenCalled();
  });
});
```

Create `apps/admin/src/app/api/meta/oauth/callback/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const connectMetaPages = vi.fn();
const cookieGet = vi.fn();
const cookieDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, delete: cookieDelete, set: vi.fn() }),
}));
vi.mock("@bnb/core/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@bnb/core/services/channels/meta-oauth", () => ({
  connectMetaPages: (...a: unknown[]) => connectMetaPages(...a),
}));

import { GET } from "./route";

const ORIGINAL = process.env.APP_ORIGIN;

function callback(query: Record<string, string>) {
  const url = new URL("https://admin.example.test/api/meta/oauth/callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_ORIGIN = "https://admin.example.test";
  requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
  cookieGet.mockReturnValue({ value: "nonce-abc" });
  connectMetaPages.mockResolvedValue({
    connected: [{ id: "c1" }, { id: "c2" }],
    warnings: [],
  });
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = ORIGINAL;
});

describe("GET /api/meta/oauth/callback", () => {
  it("connects the pages and redirects back with a count", async () => {
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/studio/channels?meta_connected=2");
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(connectMetaPages).toHaveBeenCalledWith({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
    });
    // The single-use nonce is spent whatever happened.
    expect(cookieDelete).toHaveBeenCalled();
  });

  it("refuses a mismatched or missing state without exchanging anything", async () => {
    const res = await GET(callback({ code: "CODE", state: "nonce-other" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();

    cookieGet.mockReturnValue(undefined);
    const res2 = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res2.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
  });

  it("passes Meta's own cancellation through as a readable error", async () => {
    const res = await GET(
      callback({ error: "access_denied", state: "nonce-abc" }),
    );
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=access_denied",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();
  });

  it("reports a failed exchange instead of a 500", async () => {
    connectMetaPages.mockRejectedValue(new Error("Invalid verification code."));
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=exchange_failed",
    );
  });

  it("carries a subscription warning back to the panel", async () => {
    connectMetaPages.mockResolvedValue({
      connected: [{ id: "c1" }],
      warnings: ["Boots 'n' Bandit: connected, but the webhook subscription failed — retry Connect."],
    });
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_connected=1&meta_warning=subscribe_failed",
    );
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio/channels/meta-actions.test.ts" src/app/api/meta/oauth/callback/route.test.ts`
Expected: FAIL — neither module resolves.

- [ ] **Step 7: Implement the admin action module**

Create `apps/admin/src/app/(staff)/studio/channels/meta-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@bnb/core/auth";
import { generateToken } from "@bnb/core/auth/tokens";
import { deleteConnection } from "@bnb/core/services/channel-connections";
import { metaLoginDialogUrl } from "@bnb/core/services/channels/meta-oauth";

/**
 * Connect / disconnect a Facebook Page from Studio › Channels.
 *
 * A server action rather than a `GET /studio/channels/meta/connect` page: it
 * inherits the owner check and Next's action CSRF protection, and it can write
 * the state cookie before redirecting — a plain GET link could be followed by
 * anyone who could get the owner to click it.
 */

export const META_STATE_COOKIE = "bb_meta_oauth_state";
export const META_STATE_TTL_SECONDS = 600;
const CHANNELS_PATH = "/studio/channels";

export function metaRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const origin = env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return `${origin}/api/meta/oauth/callback`;
}

export async function connectMetaAction(): Promise<void> {
  await requireRole("OWNER");

  const appId = process.env.META_APP_ID?.trim();
  if (!appId || !process.env.APP_ORIGIN?.trim()) {
    redirect(`${CHANNELS_PATH}?meta_error=not_configured`);
  }

  // Single-use nonce: Meta echoes it back as `state`, and the callback only
  // proceeds when the two match. Without it, anyone could feed the callback a
  // `code` of their own and attach THEIR Page to this studio.
  const state = generateToken(32);
  const jar = await cookies();
  jar.set(META_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // the callback is a top-level GET navigation from Meta
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: META_STATE_TTL_SECONDS,
  });

  redirect(
    metaLoginDialogUrl({
      appId: appId!,
      redirectUri: metaRedirectUri(),
      state,
    }),
  );
}

export async function disconnectMetaAction(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  // A missing id is a hidden-input value the owner never typed — no-op rather
  // than throwing them into an error boundary.
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;
  await deleteConnection(id);
  revalidatePath(CHANNELS_PATH);
}
```

- [ ] **Step 8: Implement the callback route**

Create `apps/admin/src/app/api/meta/oauth/callback/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireRole } from "@bnb/core/auth";
import { connectMetaPages } from "@bnb/core/services/channels/meta-oauth";

/**
 * GET /api/meta/oauth/callback — where Facebook Login for Business lands.
 *
 * Owner-only (a top-level GET navigation, so the Lax session cookie rides
 * along) and guarded by the single-use `state` nonce the connect action set.
 * Every outcome is a redirect back to Studio › Channels with a flash code —
 * the owner is in a browser, and an error page with a stack trace would be
 * both useless and a place for a Graph message to leak.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS_PATH = "/studio/channels";
const STATE_COOKIE = "bb_meta_oauth_state";

function back(query: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `${CHANNELS_PATH}?${query}` },
  });
}

function sameNonce(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Meta's own error slugs are safe, short and useful; anything else is not. */
const SAFE_ERROR = /^[a-z_]{1,40}$/;

export async function GET(req: Request): Promise<Response> {
  await requireRole("OWNER");

  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value ?? null;
  // Single use, whatever happens next.
  jar.delete(STATE_COOKIE);

  const denied = params.get("error");
  if (denied) {
    return back(
      `meta_error=${SAFE_ERROR.test(denied) ? denied : "access_denied"}`,
    );
  }

  const state = params.get("state");
  if (!expected || !state || !sameNonce(state, expected)) {
    return back("meta_error=bad_state");
  }

  const code = params.get("code");
  if (!code) return back("meta_error=no_code");

  const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  try {
    const result = await connectMetaPages({
      code,
      // Must be byte-identical to the one the dialog was opened with, or Meta
      // rejects the exchange.
      redirectUri: `${origin}/api/meta/oauth/callback`,
    });
    const query = [`meta_connected=${result.connected.length}`];
    if (result.warnings.length > 0) query.push("meta_warning=subscribe_failed");
    return back(query.join("&"));
  } catch (err) {
    // Graph's message can name the app and the token; it goes to the server
    // log, and the owner gets a slug plus the runbook.
    console.error("[meta] OAuth exchange failed:", err);
    return back("meta_error=exchange_failed");
  }
}
```

- [ ] **Step 9: Run them to verify they pass**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio/channels" src/app/api/meta/oauth/callback/route.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/services/channels/meta-oauth.ts \
  packages/core/src/services/channels/meta-oauth.test.ts \
  "apps/admin/src/app/(staff)/studio/channels/meta-actions.ts" \
  "apps/admin/src/app/(staff)/studio/channels/meta-actions.test.ts" \
  apps/admin/src/app/api/meta/oauth/callback/route.ts \
  apps/admin/src/app/api/meta/oauth/callback/route.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): Connect Facebook Page — Login for Business OAuth → ChannelConnection

An owner-only server action mints a single-use httpOnly state nonce and opens
Meta's OAuth dialog with the six scopes the channel needs. The callback checks
the nonce in constant time, exchanges the code for a long-lived user token,
lists the Pages that account manages, subscribes each to messages /
message_echoes / messaging_postbacks, and stores one encrypted connection per
Page plus one per linked Instagram business account (carrying the page id, so
an IG send can route through the page endpoint). Every outcome is a redirect
back to Studio › Channels with a flash slug — Graph messages stay in the log.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 9: Channels panel Meta section, `meta` retry, thread badges

**Files:**
- Modify: `apps/admin/src/app/(staff)/studio/channels/page.tsx`, `apps/admin/src/app/(staff)/studio/channels/page.test.tsx`, `apps/admin/src/app/(staff)/studio/channels/actions.ts`, `apps/admin/src/app/(staff)/studio/channels/actions.test.ts`, `apps/admin/src/app/(staff)/studio/page.tsx`, `apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx`, `apps/admin/src/app/(staff)/enquiries/EnquiryThread.test.tsx`, `apps/admin/src/app/(staff)/enquiries/page.tsx`

**Interfaces:**
- Consumes: `listChannelConnections` / `ChannelConnectionRow` / `deleteConnection` (T3); `connectMetaAction` / `disconnectMetaAction` (T8); `parseMetaWebhook` (T4); `ingestMetaEvent` (T5); `ThreadMessageRow.senderVerified` (T2); the Phase-2 panel pieces, verbatim:
  ```ts
  export const WEBHOOK_FAILURE_WINDOW_DAYS = 7;
  export async function listRecentWebhookFailures(opts?: { provider?: string; sinceDays?: number; take?: number; openOnly?: boolean }): Promise<WebhookFailureRow[]>
  export async function countOpenWebhookFailures(opts?: { provider?: string; sinceDays?: number }): Promise<number>
  export async function getWebhookFailure(id: string): Promise<{ id: string; provider: string; payload: unknown } | null>
  export async function markWebhookFailureRetried(id: string, at?: Date): Promise<void>
  export async function setWebhookFailureError(id: string, error: string): Promise<void>
  export async function retryWebhookFailureAction(fd: FormData): Promise<void>
  ```
- Produces:
  ```ts
  // EnquiryThread.tsx
  ThreadItem gains: senderVerified: boolean | null;
  export const CHANNEL_LABEL: Record<ThreadItem["channel"], string>;  // unchanged
  export const CHANNEL_ICON: Record<ThreadItem["channel"], LucideIcon>;
  ```

- [ ] **Step 1: Write the failing test for the retry branch**

Append to `apps/admin/src/app/(staff)/studio/channels/actions.test.ts` (it already mocks `@bnb/core/auth`, `next/cache`, `@bnb/core/services/webhook-failures` and `@bnb/core/services/channels/email-inbound`; add the Meta mock alongside):

```ts
vi.mock("@bnb/core/services/channels/meta-inbound", () => ({
  ingestMetaEvent: vi.fn(),
}));
const { ingestMetaEvent } = await import(
  "@bnb/core/services/channels/meta-inbound"
);

describe("retryWebhookFailureAction on a meta failure", () => {
  const STORED = {
    object: "page",
    entry: [
      {
        id: "102938475610293",
        time: 1788000000000,
        messaging: [
          {
            sender: { id: "7213456789012345" },
            recipient: { id: "102938475610293" },
            timestamp: 1788000000000,
            message: { mid: "m_AbC0dEf1GhI2jKl3MnO4pQ", text: "hiya" },
          },
        ],
      },
    ],
  };

  it("replays the stored event through the SAME ingest the webhook uses", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf1",
      provider: "meta",
      payload: STORED,
    });
    vi.mocked(ingestMetaEvent).mockResolvedValue({
      status: "recorded",
      direction: "inbound",
      enquiryId: "e1",
      messageId: "m1",
      createdEnquiry: false,
    } as never);

    const fd = new FormData();
    fd.set("id", "wf1");
    await retryWebhookFailureAction(fd);

    expect(ingestMetaEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ingestMetaEvent).mock.calls[0][0]).toMatchObject({
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      channel: "messenger",
    });
    expect(markWebhookFailureRetried).toHaveBeenCalledWith("wf1");
  });

  it("does not declare victory on a payload that holds no event", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf2",
      provider: "meta",
      payload: { raw: "not json at all" },
    });
    const fd = new FormData();
    fd.set("id", "wf2");
    await retryWebhookFailureAction(fd);

    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
    expect(setWebhookFailureError).toHaveBeenCalledWith(
      "wf2",
      expect.stringContaining("not a replayable Meta event"),
    );
  });

  it("writes the new error back when the replay fails again", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf3",
      provider: "meta",
      payload: STORED,
    });
    vi.mocked(ingestMetaEvent).mockRejectedValue(new Error("Graph is down"));
    const fd = new FormData();
    fd.set("id", "wf3");
    await retryWebhookFailureAction(fd);
    expect(setWebhookFailureError).toHaveBeenCalledWith("wf3", "Graph is down");
  });

  it("ignores a provider it does not know how to replay", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf4",
      provider: "stripe",
      payload: {},
    });
    const fd = new FormData();
    fd.set("id", "wf4");
    await retryWebhookFailureAction(fd);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio/channels/actions.test.ts"`
Expected: FAIL — the action returns early for any provider that is not `"resend"`, so `ingestMetaEvent` is never called.

- [ ] **Step 3: Implement the retry branch**

In `apps/admin/src/app/(staff)/studio/channels/actions.ts` add the imports:

```ts
import { parseMetaWebhook } from "@bnb/core/services/channels/meta";
import { ingestMetaEvent } from "@bnb/core/services/channels/meta-inbound";
```

and replace the body of `retryWebhookFailureAction` after the row load:

```ts
  const row = await getWebhookFailure(id);
  if (!row) return;

  try {
    if (row.provider === "resend") {
      const outcome = await ingestResendEvent(row.payload);
      if (outcome.status === "ignored" && outcome.reason === "unsupported_event") {
        // The route stored this because the original body could not even be
        // parsed as an event (e.g. malformed JSON) — there is nothing to
        // replay, so treat it as a fresh failure rather than declaring victory.
        await setWebhookFailureError(
          id,
          "Stored payload is not a replayable Resend event (original body could not be parsed) — check the delivery in the Resend dashboard.",
        );
      } else {
        await markWebhookFailureRetried(id);
      }
    } else if (row.provider === "meta") {
      // The webhook stores ONE event per failure (`singleEventBody`), so this
      // parses back to exactly the event that broke.
      const events = parseMetaWebhook(row.payload);
      if (events.length === 0) {
        await setWebhookFailureError(
          id,
          "Stored payload is not a replayable Meta event (original body could not be parsed) — check the delivery in the Meta app dashboard.",
        );
      } else {
        for (const event of events) await ingestMetaEvent(event);
        await markWebhookFailureRetried(id);
      }
    } else {
      // An unknown provider has no replay path; leave the row open.
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[channels] retry of ${id} failed again:`, err);
    await setWebhookFailureError(id, message);
  }
  revalidatePath(CHANNELS_PATH);
```

- [ ] **Step 4: Write the failing test for the panel**

Append to `apps/admin/src/app/(staff)/studio/channels/page.test.tsx`, and extend the top-of-file mocks with:

```ts
vi.mock("./meta-actions", () => ({
  connectMetaAction: vi.fn(),
  disconnectMetaAction: vi.fn(),
}));
const listChannelConnections = vi.fn();
vi.mock("@bnb/core/services/channel-connections", () => ({
  listChannelConnections: (...a: unknown[]) => listChannelConnections(...a),
}));
```

with `listChannelConnections.mockResolvedValue([])` added to `beforeEach`, then:

```ts
describe("ChannelsPage — Meta", () => {
  const CONNECTIONS = [
    {
      id: "c1",
      channel: "messenger" as const,
      externalId: "102938475610293",
      pageId: "102938475610293",
      igAccountId: "17841400000000000",
      name: "Boots 'n' Bandit",
      active: true,
      webhookSubscribedAt: new Date("2026-09-05T10:00:00Z"),
      lastEventAt: new Date("2026-09-08T11:22:33Z"),
      connectedAt: new Date("2026-09-05T10:00:00Z"),
    },
    {
      id: "c2",
      channel: "instagram" as const,
      externalId: "17841400000000000",
      pageId: "102938475610293",
      igAccountId: "17841400000000000",
      name: "Boots 'n' Bandit (@bootsnbandit)",
      active: true,
      webhookSubscribedAt: null,
      lastEventAt: null,
      connectedAt: new Date("2026-09-05T10:00:00Z"),
    },
  ];

  it("says Meta is not configured, and does not offer Connect", async () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_VERIFY_TOKEN;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("META_APP_ID");
    expect(html).toContain("META_VERIFY_TOKEN");
    expect(html).toContain("docs/CHANNELS.md");
    expect(html).not.toContain("Connect a Facebook Page");
  });

  it("shows the webhook URL and a Connect button once configured", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("https://admin.bootsnbandit.test/api/webhooks/meta");
    expect(html).toContain("Connect a Facebook Page");
    expect(html).toContain("No Pages connected yet");
    // Never the values themselves.
    expect(html).not.toContain("1234567890");
  });

  it("lists each connection with its last event and subscription state", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    listChannelConnections.mockResolvedValue(CONNECTIONS);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Boots &#x27;n&#x27; Bandit");
    expect(html).toContain("Messenger");
    expect(html).toContain("Instagram");
    expect(html).toContain("8 September 2026");
    expect(html).toContain("Nothing received yet");
    expect(html).toContain("Not subscribed");
    expect(html).toContain("Disconnect");
  });

  it("shows the flash from a finished connect", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const ok = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ meta_connected: "3" }) }),
    );
    expect(ok).toContain("Connected 3");
    const bad = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ meta_error: "bad_state" }) }),
    );
    expect(bad).toContain("could not be completed");
  });

  it("lists failed events from both providers, naming which is which", async () => {
    countOpenWebhookFailures.mockResolvedValue(1);
    listRecentWebhookFailures.mockResolvedValue([
      {
        id: "wf1",
        provider: "meta",
        externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
        error: "Graph is down",
        createdAt: new Date("2026-09-08T09:00:00Z"),
        retriedAt: null,
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Graph is down");
    expect(html).toContain("meta");
    // No provider filter any more — the panel owns both channels.
    expect(listRecentWebhookFailures).toHaveBeenCalledWith({ openOnly: true });
    expect(countOpenWebhookFailures).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio/channels/page.test.tsx"`
Expected: FAIL — the page takes no props, renders no Meta section, and still filters failures to `provider: "resend"`.

- [ ] **Step 6: Implement the Meta section**

In `apps/admin/src/app/(staff)/studio/channels/page.tsx`:

Add to the imports:

```ts
import { Facebook, Instagram, Link2 } from "lucide-react";
import { listChannelConnections } from "@bnb/core/services/channel-connections";
import { connectMetaAction, disconnectMetaAction } from "./meta-actions";
```

Give the page its flash props and load the connections:

```ts
const META_FLASH: Record<string, string> = {
  not_configured:
    "Meta is not configured — set META_APP_ID, META_APP_SECRET and META_VERIFY_TOKEN.",
  bad_state: "That connection attempt could not be completed — start again.",
  no_code: "That connection attempt could not be completed — start again.",
  access_denied: "The connection was cancelled at Facebook.",
  exchange_failed:
    "Facebook rejected the connection — check the app's redirect URI, then try again.",
};

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("OWNER");
  const flash = await searchParams;
  const one = (key: string): string | null => {
    const value = flash[key];
    return typeof value === "string" ? value : null;
  };

  // …existing email lookups…
  const metaAppId = Boolean(process.env.META_APP_ID?.trim());
  const metaSecret = Boolean(process.env.META_APP_SECRET?.trim());
  const metaVerify = Boolean(process.env.META_VERIFY_TOKEN?.trim());
  const metaConfigured = metaAppId && metaSecret && metaVerify;
  const metaWebhookUrl = `${origin || "https://<admin-origin>"}/api/webhooks/meta`;
  const connections = await listChannelConnections();
```

and change the failures queries to cover both providers:

```ts
    listRecentWebhookFailures({ openOnly: true }),
    countOpenWebhookFailures(),
```

Add the section between the email section and the failures section:

```tsx
      <section className="mb-8 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Facebook className="h-4 w-4" /> Messenger &amp; Instagram (Meta)
        </h2>

        {one("meta_connected") ? (
          <p className="mb-3 text-sm text-bb-teal">
            Connected {one("meta_connected")} destination
            {one("meta_connected") === "1" ? "" : "s"}.
            {one("meta_warning") === "subscribe_failed"
              ? " One or more Pages could not be subscribed to the webhook — press Connect again."
              : ""}
          </p>
        ) : null}
        {one("meta_error") ? (
          <p className="mb-3 text-sm text-bb-gold">
            {META_FLASH[one("meta_error") ?? ""] ??
              "That connection attempt could not be completed — start again."}
          </p>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-text-muted">Webhook URL</dt>
          <dd className="text-text-secondary">
            <code className="break-all">{metaWebhookUrl}</code>
          </dd>
          <dt className="text-text-muted">Subscribed fields</dt>
          <dd className="text-text-secondary">
            <code>messages, message_echoes, messaging_postbacks</code>
          </dd>
        </dl>

        <ul className="mt-4 space-y-2 border-t border-border-default pt-4">
          <li>
            <Status ok={metaAppId}>
              <code>META_APP_ID</code> {metaAppId ? "— set" : "— Not set"}
            </Status>
          </li>
          <li>
            <Status ok={metaSecret}>
              <code>META_APP_SECRET</code>{" "}
              {metaSecret
                ? "— set (inbound deliveries are verified)"
                : "— Not set; the webhook answers 503"}
            </Status>
          </li>
          <li>
            <Status ok={metaVerify}>
              <code>META_VERIFY_TOKEN</code>{" "}
              {metaVerify
                ? "— set (the subscription handshake works)"
                : "— Not set; Meta cannot verify the webhook"}
            </Status>
          </li>
        </ul>

        {metaConfigured ? (
          <>
            {connections.length > 0 ? (
              <ul className="mt-4 divide-y divide-border-default border-t border-border-default">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-text-primary">
                        {c.channel === "instagram" ? (
                          <Instagram className="h-4 w-4" />
                        ) : (
                          <Facebook className="h-4 w-4" />
                        )}
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {c.channel === "instagram" ? "Instagram" : "Messenger"} ·
                        Connected {DATE.format(c.connectedAt)} ·{" "}
                        {c.webhookSubscribedAt ? "Subscribed" : "Not subscribed"}{" "}
                        · Last event received{" "}
                        {c.lastEventAt
                          ? DATE.format(c.lastEventAt)
                          : "— Nothing received yet"}
                      </span>
                    </span>
                    <form action={disconnectMetaAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center rounded-md border border-border-default px-3 text-sm text-text-secondary transition-colors hover:border-bb-crimson/50"
                      >
                        Disconnect
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-text-muted">
                No Pages connected yet.
              </p>
            )}

            <form action={connectMetaAction} className="mt-4">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border-default px-4 text-sm text-text-secondary transition-colors hover:border-bb-teal/50"
              >
                <Link2 className="h-4 w-4" /> Connect a Facebook Page
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Not configured. Create the Meta app and set the three variables
            first — the steps are in <code>docs/CHANNELS.md</code>.
          </p>
        )}
      </section>
```

In the failures list, add the provider so a mixed list reads unambiguously — change the metadata line to:

```tsx
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {f.provider} · {DATE.format(f.createdAt)}
                    {f.externalId ? ` · ${f.externalId}` : ""}
                    {f.retriedAt ? ` · Retried ${DATE.format(f.retriedAt)}` : ""}
                  </span>
```

In `apps/admin/src/app/(staff)/studio/page.tsx` update the Channels card description:

```ts
    desc: "Email, Messenger and Instagram — connections, webhook status and failed events.",
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/studio"`
Expected: PASS.

- [ ] **Step 8: Write the failing test for the thread badges**

Append to `apps/admin/src/app/(staff)/enquiries/EnquiryThread.test.tsx` (and add `senderVerified: null` to the `base` fixture):

```tsx
describe("channel and verification badges", () => {
  it("names Messenger and Instagram bubbles with their own icon", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          { ...base, id: "m1", channel: "messenger", bodyText: "hiya" },
          { ...base, id: "m2", channel: "instagram", bodyText: "the moth?" },
        ]}
      />,
    );
    expect(html).toContain("Messenger");
    expect(html).toContain("Instagram");
    // Two distinct lucide icons, one per bubble.
    expect(html).toContain("lucide-facebook");
    expect(html).toContain("lucide-instagram");
  });

  it("badges an inbound email whose sender did not authenticate", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          { ...base, id: "m1", channel: "email", senderVerified: false },
        ]}
      />,
    );
    expect(html).toContain("Unverified sender");
  });

  it("says nothing when the sender authenticated, or when nobody checked", () => {
    for (const senderVerified of [true, null]) {
      const html = renderToStaticMarkup(
        <EnquiryThread
          items={[{ ...base, id: "m1", channel: "email", senderVerified }]}
        />,
      );
      expect(html).not.toContain("Unverified sender");
    }
  });

  it("never badges an outbound message, whatever the column says", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          {
            ...base,
            id: "m1",
            direction: "outbound",
            channel: "email",
            senderVerified: false,
          },
        ]}
      />,
    );
    expect(html).not.toContain("Unverified sender");
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/EnquiryThread.test.tsx"`
Expected: FAIL — `senderVerified` is not a `ThreadItem` field and no icon is rendered.

- [ ] **Step 10: Implement the badges**

In `apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx`:

```tsx
import {
  Facebook,
  Globe,
  Instagram,
  Mail,
  ShieldAlert,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
```

```ts
export interface ThreadItem {
  // …existing fields…
  /**
   * Did the sending MTA authenticate the sender? null = unknown, which is
   * every web and Meta message — those channels authenticate the account.
   */
  senderVerified: boolean | null;
}

export const CHANNEL_ICON: Record<ThreadItem["channel"], LucideIcon> = {
  web: Globe,
  email: Mail,
  messenger: Facebook,
  instagram: Instagram,
  note: StickyNote,
};
```

In the bubble header, render the icon inside the channel badge and the warning after it:

```tsx
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <Badge variant="outline" className="gap-1">
                    {(() => {
                      const Icon = CHANNEL_ICON[m.channel];
                      return <Icon className="h-3 w-3" aria-hidden />;
                    })()}
                    {CHANNEL_LABEL[m.channel]}
                  </Badge>
                  {/*
                    Only ever on INBOUND mail, and only when the MTA actually
                    said "no" — an unknown verdict (web, Meta, an MTA that
                    added no header) must not look like a warning. Nothing is
                    ever dropped on this: it is a label, not a filter.
                  */}
                  {!outbound && !internal && m.senderVerified === false && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-bb-gold/50 text-bb-gold"
                      title="This message failed SPF/DKIM/DMARC checks — the From address may be forged."
                    >
                      <ShieldAlert className="h-3 w-3" aria-hidden />
                      Unverified sender
                    </Badge>
                  )}
                  {who && <span className="text-text-primary">{who}</span>}
                  {/* …unchanged deliveryStatus badge and timestamp… */}
                </div>
```

In `apps/admin/src/app/(staff)/enquiries/page.tsx`, carry the field through `toThreadItems`:

```ts
      deliveryStatus: m.deliveryStatus,
      senderVerified: m.senderVerified,
```

- [ ] **Step 11: Run the admin suite**

Run: `npm test -w @bnb/admin`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add "apps/admin/src/app/(staff)/studio/channels/page.tsx" \
  "apps/admin/src/app/(staff)/studio/channels/page.test.tsx" \
  "apps/admin/src/app/(staff)/studio/channels/actions.ts" \
  "apps/admin/src/app/(staff)/studio/channels/actions.test.ts" \
  "apps/admin/src/app/(staff)/studio/page.tsx" \
  "apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx" \
  "apps/admin/src/app/(staff)/enquiries/EnquiryThread.test.tsx" \
  "apps/admin/src/app/(staff)/enquiries/page.tsx"
git commit -m "$(cat <<'EOF'
feat(admin): Channels panel Meta section, meta replay, thread badges

Studio › Channels gains a Meta section: webhook URL, subscribed fields, the
three env vars as presence-only rows, Connect a Facebook Page, and one line per
connection with its channel, subscription state and last event received (the
spec's "send yourself a message" is impossible before someone messages the
Page, so liveness is shown instead). Failed events now list both providers and
Retry replays a stored Meta event through the same ingestMetaEvent the webhook
uses. Thread bubbles carry a per-channel icon and inbound email that failed
SPF/DKIM/DMARC gets an "Unverified sender" badge — a label, never a filter.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

### Task 10: Runbook + deploy configuration

**Files:**
- Modify: `docs/CHANNELS.md`, `docs/DEPLOY.md`, `docs/PROJECT-BRIEF.md`, `.env.production.example`, `apps/admin/.env.example`, `docker-compose.prod.yml`

- [ ] **Step 1: Retitle `docs/CHANNELS.md` and add the Meta half**

Change the document's first two lines from

```markdown
# Channels — inbound and outbound email

The enquiry inbox is two-way on email: replies from customers land back on the
```

to

```markdown
# Channels — email, Messenger and Instagram

The enquiry inbox is two-way on email: replies from customers land back on the
```

and replace the line

```markdown
Facebook Messenger and Instagram are Phase 3 and are not covered here.
```

with

```markdown
Facebook Messenger and Instagram are covered in **[Meta channels](#meta-channels-messenger--instagram)** below.
```

Then append this section to the end of the file (after *Local development*):

```markdown
---

# Meta channels (Messenger + Instagram)

Messenger and Instagram DMs land on the same enquiry threads as email, and
staff reply to them from the same composer. Everything is **off until three
environment variables are set** — the webhook answers `503`, Studio › Channels
says "not configured", and replies quietly fall back to email.

## How it works

1. A customer messages the studio's Facebook Page or Instagram account.
2. Meta POSTs the event to `https://<admin-origin>/api/webhooks/meta`, signed
   `X-Hub-Signature-256: sha256=<HMAC-SHA256 of the raw body with META_APP_SECRET>`.
3. Admin verifies the signature, matches `entry[].id` to a connected Page or
   IG account, resolves the sender's PSID/IGSID to a `CustomerIdentity`
   (fetching their display name from Graph the first time), threads the message
   with the same 30-day rule email uses, and records it.
4. A staff reply goes back out through `POST /{page-id}/messages` with the
   Page's stored (encrypted) access token.
5. If a staff member replies from Meta's own inbox instead, the echo comes back
   on the `message_echoes` field and is recorded on the thread as an outbound
   message from "Meta inbox", so the admin thread stays complete.

**The 24-hour rule.** Meta only permits a business to message a person within
24 hours of that person's last message. Past it the composer refuses with
*"Messenger/Instagram only allows replies within 24 hours of the customer's
last message — email them instead."* There is no way around this; it is policy,
not a limit we chose.

## One-time setup

Everything below is done once, by the studio owner, in a browser. Budget an
afternoon: business verification and App Review are Meta's timelines, not ours.

### 1. Prerequisites

- A **Facebook Page** for the studio.
- An **Instagram professional account** (Business or Creator) **linked to that
  Page** (Instagram app → Settings → Account type and tools → *Share to other
  apps* / Page linking). Without the link there are no Instagram DMs to receive.
- A **Meta Business Portfolio** (business.facebook.com) that owns the Page.
- Admin rights on all three, from the same Facebook account.

### 2. Create the app

1. <https://developers.facebook.com/apps> → **Create app**.
2. Use case: **Other** → app type **Business** → attach it to the Business
   Portfolio that owns the Page.
3. Note the **App ID** and, under *App settings → Basic*, the **App secret**
   (click *Show*). These become `META_APP_ID` and `META_APP_SECRET`.

### 3. Add the products

Add both, from the app dashboard:

- **Messenger** (adds *Messenger API settings*).
- **Instagram** (adds *Instagram API setup with Facebook login*).

### 4. Permissions

The Connect flow requests exactly these; App Review must approve the same set:

| Permission | Why |
| --- | --- |
| `pages_messaging` | send and receive Messenger messages |
| `pages_manage_metadata` | subscribe the app to the Page's webhooks |
| `pages_show_list` | list the Pages the connecting account manages |
| `instagram_basic` | read the linked Instagram business account |
| `instagram_manage_messages` | send and receive Instagram DMs |
| `business_management` | required for review of the above |

### 5. Choose a verify token and set the variables

The verify token is a shared secret **you invent** — Meta echoes it back during
the subscription handshake so the endpoint knows the request is yours.

```bash
openssl rand -hex 32
```

In Coolify, on the compose resource's Environment Variables (admin only — the
web and reception apps have no Meta surface):

| Var | Value |
| --- | --- |
| `META_APP_ID` | the App ID from step 2 |
| `META_APP_SECRET` | the App secret from step 2 |
| `META_VERIFY_TOKEN` | the random string you just generated |
| `META_GRAPH_VERSION` | optional; defaults to `v21.0`. Set it only when Meta deprecates that version |

`SESSION_SECRET` must be **at least 32 characters** — the Page access tokens
are encrypted with a key derived from it, and a shorter secret is refused
outright. Redeploy before continuing: the next step calls back into the app.

### 6. Register the webhook

1. App dashboard → **Messenger → Messenger API settings → Webhooks** →
   **Configure**.
2. Callback URL: `https://<admin-origin>/api/webhooks/meta`
   (Studio › Channels prints the exact URL for the deployed environment.)
3. Verify token: the `META_VERIFY_TOKEN` you set.
4. **Verify and save.** Meta immediately GETs the URL; a failure here is almost
   always a wrong token, a typo in the URL, or a redeploy that has not finished.
5. Subscribe the fields **`messages`**, **`message_echoes`**,
   **`messaging_postbacks`**. Nothing else is consumed.
6. Repeat under **Instagram → Configure webhooks**, with the same callback URL
   and verify token, subscribing the same fields.

### 7. Connect the Page

1. Open **Studio › Channels** in the admin app as the owner.
2. Press **Connect a Facebook Page** and complete the Facebook dialog,
   granting access to the studio Page (and its Instagram account).
3. You land back on the panel with each Page and Instagram account listed,
   marked **Subscribed**.

Connecting stores a long-lived Page access token, encrypted with a key derived
from `SESSION_SECRET`. **Rotating `SESSION_SECRET` makes every stored token
unreadable** — the panel keeps showing the connections and replies fall back to
email; press **Connect** again to re-store them.

### 8. Test before App Review

A new app is in **development mode**: only people with a role on it can message
the Page and have it reach the webhook.

1. App dashboard → **App roles → Roles** → add your own Facebook account (and
   any tester) as **Administrator** or **Tester**; accept the invitation.
2. From that account, message the studio Page. Within seconds the enquiry
   appears in the admin inbox with a Messenger badge, and Studio › Channels
   shows a fresh **Last event received**.
3. Reply from the composer. It should arrive in Messenger from the Page.
4. Send an image; it renders inline in the thread.
5. Repeat by DMing the Instagram account.

### 9. Go live

1. **Business verification** — Business Portfolio → *Security Center* → verify
   the business (documents; Meta's timeline, often days).
2. **App Review** — request the six permissions above with a screencast of the
   Connect flow and of a message arriving and being replied to. Explain the use
   plainly: "a tattoo studio replying to customer enquiries in its own admin".
3. Switch the app from **Development** to **Live**.
4. Message the Page from an account with **no** role on the app and confirm it
   still lands. Until this passes, only testers reach the inbox.

**Go-live checklist:** app Live · business verified · six permissions approved ·
both webhook subscriptions saved with all three fields · Page (and Instagram)
connected and Subscribed in Studio › Channels · a non-tester message arrives ·
a reply sends · Studio › Channels shows no failed events.

## Operations

### Where things are visible

Studio › Channels lists every connection with its channel, when it was
connected, whether the webhook subscription succeeded, and **Last event
received** — the liveness signal. (There is deliberately no "send yourself a
test message" button: sending needs a PSID, which does not exist until someone
messages the Page.) **Disconnect** removes a connection; the thread history
stays, and replies on those threads fall back to email.

### Failed events

Identical to email: a correctly-signed event we could not process is stored
whole and the endpoint answers `200` — Meta retries and eventually *disables* a
webhook that keeps erroring, so a 5xx would take the channel down. One row is
written **per event**, so **Retry** replays exactly what broke.

| Error | Cause |
| --- | --- |
| `Meta refused the message: Invalid OAuth access token` | the Page token was revoked — press Connect again |
| `Meta refused the message: … outside of allowed window` | the 24-hour window shut mid-send |
| `connection … has an unreadable access token` (in the log) | `SESSION_SECRET` changed — press Connect again |
| `Stored payload is not a replayable Meta event` | a signed body that was not JSON; check the delivery in the app dashboard |

### What is deliberately dropped

- **Delivery and read receipts** — not conversation.
- **`messaging_postbacks`** — subscribed so the field exists for later, but
  ignored: we ship no menu or Get Started button, so a postback can only be
  Meta's own default entry point.
- **Echoes of messages we sent ourselves** — recognised by their `mid` and
  skipped, so a reply is never recorded twice.
- **Events for a Page nobody connected** — logged as `unknown_page`.

### Attachments

Images are fetched **only** from Meta's own CDN hosts (`*.fbcdn.net`,
`*.cdninstagram.com`, `lookaside.fbsbx.com`) over https, capped at 8 MB each
and 16 MB per message, and stored under their **sniffed** mime. Everything else
— video, audio, files, and any image from an unexpected host — is kept as a
link. **Meta's attachment URLs expire**; anything worth keeping should be saved
at the time.

### Testing the endpoint by hand

```bash
APP_SECRET='…'
BODY='{"object":"page","entry":[{"id":"<connected page id>","time":1788000000000,"messaging":[{"sender":{"id":"<a psid>"},"recipient":{"id":"<page id>"},"timestamp":1788000000000,"message":{"mid":"m_manual_test_1","text":"hello"}}]}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" -r | cut -d' ' -f1)"
curl -i -X POST https://<admin-origin>/api/webhooks/meta \
  -H 'content-type: application/json' -H "x-hub-signature-256: $SIG" -d "$BODY"
```

Expected: `200` with `{"ok":true,"outcomes":[…]}`. `401` means the signature or
`META_APP_SECRET` is wrong. `503` means `META_APP_SECRET` is unset. The
handshake can be checked the same way:

```bash
curl -i "https://<admin-origin>/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=12345"
# → 200 with the body 12345
```

## Local development

Meta will not deliver to `localhost`. Point a tunnel (`cloudflared`, `ngrok`) at
`http://localhost:3001`, register that URL as the callback on a **second,
development** Meta app, and set that app's id/secret/verify token locally.
Outbound needs a real Page token, so most work is done against the
`ingestMetaEvent` and `sendMetaMessage` suites instead.
```

- [ ] **Step 2: Add the variables to `.env.production.example`**

After the `INBOUND_EMAIL_DOMAIN` / `RESEND_WEBHOOK_SECRET` block:

```bash
# Facebook Messenger + Instagram DMs (admin only). All three are optional:
# without them /api/webhooks/meta answers 503, Studio › Channels shows "not
# configured", and enquiry replies fall back to email. META_APP_ID and
# META_APP_SECRET come from the Meta app (developers.facebook.com);
# META_VERIFY_TOKEN is a random string you invent and paste into Meta's webhook
# configuration (openssl rand -hex 32). META_GRAPH_VERSION is optional and
# defaults to v21.0. NOTE: Page access tokens are encrypted with a key derived
# from SESSION_SECRET, which must be at least 32 characters for this to work,
# and rotating it makes stored tokens unreadable (reconnect the Page). Full
# setup, permissions and the App Review checklist: docs/CHANNELS.md.
META_APP_ID=""
META_APP_SECRET=""
META_VERIFY_TOKEN=""
META_GRAPH_VERSION=""
```

- [ ] **Step 3: Add them to `apps/admin/.env.example`**

After the two-way email block:

```bash
# Facebook Messenger + Instagram DMs (all optional in dev; the channel is off
# without them). META_VERIFY_TOKEN is a string you choose and also paste into
# Meta's webhook configuration. Meta cannot reach localhost — use a tunnel and
# a separate development app. Full setup: docs/CHANNELS.md.
# META_APP_ID=""
# META_APP_SECRET=""
# META_VERIFY_TOKEN=""
# META_GRAPH_VERSION="v21.0"
```

- [ ] **Step 4: Add them to the admin service in `docker-compose.prod.yml`**

In the `admin:` service's `environment:` block, after `RESEND_WEBHOOK_SECRET`
(admin only — do **not** add these to `web` or `reception`):

```yaml
      META_APP_ID: ${META_APP_ID:-}
      META_APP_SECRET: ${META_APP_SECRET:-}
      META_VERIFY_TOKEN: ${META_VERIFY_TOKEN:-}
      META_GRAPH_VERSION: ${META_GRAPH_VERSION:-}
```

- [ ] **Step 5: Cross-link from `docs/DEPLOY.md`**

In the environment-variable list, immediately after the
`INBOUND_EMAIL_DOMAIN` / `RESEND_WEBHOOK_SECRET` bullet, add:

```markdown
   - `META_APP_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN` (all optional,
     **admin only**; `META_GRAPH_VERSION` optional, defaults `v21.0`) — the
     Messenger + Instagram channel. Without them `/api/webhooks/meta` answers
     503, Studio › Channels shows "not configured" and enquiry replies fall
     back to email. Page access tokens are encrypted with a key derived from
     `SESSION_SECRET`, which must therefore be **at least 32 characters**;
     rotating it makes stored tokens unreadable and the Pages must be
     reconnected. App creation, permissions, webhook fields and the App Review
     checklist are in `docs/CHANNELS.md`.
```

and, in the migration section, note the new one:

```markdown
The `20260909100000_meta_channels` migration is additive (a new
`ChannelConnection` table and two nullable `EnquiryMessage` columns) and needs
no data migration or downtime.
```

- [ ] **Step 6: Add the build-log entry to `docs/PROJECT-BRIEF.md`**

Append after the Phase 2 entry:

```markdown
## Enquiries omnichannel — Phase 3: Meta channels (2026-09-08) — DONE
Facebook Messenger and Instagram DMs are now two-way on the same enquiry threads, shipping **dark** behind `META_APP_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN` (optional `META_GRAPH_VERSION`, default `v21.0`) because the studio has a Page and an IG professional account but no developer app yet. `GET/POST /api/webhooks/meta` (admin) answers Meta's `hub.challenge` handshake and verifies `X-Hub-Signature-256` over a streamed, 1 MiB-capped raw body, then runs each `entry[].messaging[]` event through `ingestMetaEvent`: PSID/IGSID → `CustomerIdentity` (display name fetched from Graph only for an unseen handle, else "Messenger user"/"Instagram user"), the Phase-1 30-day threading rule, then an inbound `EnquiryMessage` idempotent on the Meta `mid`. Image attachments are fetched **only** from Meta's own CDN hosts and stored under their sniffed mime; everything else is a link. A staff reply typed into Meta's own inbox arrives as an echo and is recorded as outbound from "Meta inbox". Outbound uses `POST /{page-id}/messages` with the token in the request **body**, splitting past 2000 characters into one recorded message per part; the 24-hour messaging window is enforced before the request (and Graph's code 10 / subcode 2018278 mapped to the same error) and surfaces in the composer as "email them instead". Page tokens are stored AES-256-GCM encrypted under an HKDF key derived from `SESSION_SECRET` (**min 32 chars**; rotating it means reconnecting) in the new `ChannelConnection` table, and `EnquiryMessage` gained `connectionId` (so a reply reaches the Page the customer wrote to) and `senderVerified` (the inbound MTA's DMARC/SPF+DKIM verdict, shown as an "Unverified sender" badge — a label, never a filter). Owners connect Pages from **Studio › Channels** via Facebook Login for Business (single-use state nonce, long-lived token exchange, one connection per Page plus one per linked Instagram account, `messages`/`message_echoes`/`messaging_postbacks` subscribed automatically); the panel lists each connection with its **Last event received** and replays failed events for both providers. **Also in this release (Phase-2 hardening):** `channels/email.ts` split into `email-parse`/`email-outbound` behind a barrel, a 90-day `WebhookFailure` prune in the hourly cron, a strict 16 MB inline-attachment budget, one `DEFAULT_EMAIL_FROM`, one enquiry read per reply, a validated `INBOUND_EMAIL_DOMAIN` (warn once), and numeric-entity decoding in `htmlToText`. Migration: `20260909100000_meta_channels` (additive). Runbook: `docs/CHANNELS.md` → *Meta channels*. Spec: `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md`.
```

- [ ] **Step 7: Verify the whole repo is green**

```bash
npm test -w @bnb/core && npm test -w @bnb/admin && npm test -w @bnb/web
npm run lint
npx tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: all suites pass, lint clean, no type errors. (`apps/web` is untouched
this phase; its suite runs as a regression check, including the guard test that
it never imports `@bnb/core/auth`.)

- [ ] **Step 8: Commit**

```bash
git add docs/CHANNELS.md docs/DEPLOY.md docs/PROJECT-BRIEF.md \
  .env.production.example apps/admin/.env.example docker-compose.prod.yml
git commit -m "$(cat <<'EOF'
docs(channels): Meta setup runbook + deploy configuration

docs/CHANNELS.md becomes the email + Messenger + Instagram runbook: app
creation, the Messenger and Instagram products, the six permissions, the
webhook callback URL and verify token, the three subscribed fields, testing
with app roles before review, business verification, the go-live checklist and
the operational notes (24-hour window, expiring attachment URLs, what is
deliberately dropped, hand-testing both verbs). META_APP_ID / META_APP_SECRET /
META_VERIFY_TOKEN / META_GRAPH_VERSION are added to the admin service only, in
both env examples and docker-compose.prod.yml, with the SESSION_SECRET
minimum-length and rotation consequences called out.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
EOF
)"
```

---

## Self-review

**1. Spec coverage** — every requirement of the spec that Phase 3 owns, mapped to a task:

| Spec | Task |
| --- | --- |
| §1 `CustomerIdentity` | Already shipped in Phase 1 — verified against `schema.prisma`, no delta (Task 2 notes it explicitly) |
| §1 `ChannelConnection` (channel, externalId, name, accessToken encrypted, active, connectedAt) | Task 2, plus `pageId` / `igAccountId` / `webhookSubscribedAt` / `lastEventAt` |
| §2 `channels/meta.ts` — `verifyWebhookSignature` | Task 4 as `verifyMetaSignature` (see ambiguity 8 below) |
| §2 `channels/meta.ts` — `parseMetaWebhook` (Messenger + Instagram, text, attachments, echoes) | Task 4 |
| §2 `channels/meta.ts` — `sendMetaMessage`, 24-hour window, friendly failure | Task 7 (`channels/meta-outbound.ts`) |
| §2 `channels/meta.ts` — `fetchProfile(psid)` | Task 5 (`MetaInboundDeps.fetchProfile`) |
| §2 `secrets.ts` — AES-GCM + HKDF from `SESSION_SECRET` | Task 3 |
| §3 `GET/POST /api/webhooks/meta` — hub.challenge, HMAC, echoes, identity, threading, always 200, sequential | Tasks 5 + 6 |
| §4 reply channel selection (messenger/instagram → `sendMetaMessage`) | Task 7 |
| §6 Channels panel — Meta connection status, Connect Facebook Page (OAuth → `ChannelConnection`) | Tasks 8 + 9 |
| §6 "send yourself a message" button | Task 9 — replaced by per-connection **Last event received** (ambiguity 4) |
| §8 config `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `SESSION_SECRET` | Task 10 (+ optional `META_GRAPH_VERSION`) |
| §8 runbook: app creation, Page + IG linking, permissions, business verification, app review, webhook subscription fields, test-user flow | Task 10 |
| Error handling: failures logged + 200 + `WebhookFailure` + retry button | Tasks 6 + 9 |
| Error handling: 24-hour violations → composer error suggesting email | Task 7 |
| Error handling: attachment over 8 MB or non-image → `url` only | Task 5 |
| Testing: pure units for verification/parsing, DB tests for identity, route tests with fixtures and bad signatures, action tests for reply channel, render tests | Tasks 3–9 |
| Notifications: in-app only | Inherited — `recordInbound` drives `unreadCountsFor`; nothing added |

Deliberately **not** in this phase and correctly so: §5 visibility (Phase 1), §6 component split / customer timeline / `?open=` deep links (Phase 4), §7 public web changes (Phase 1). Phase-2 leftovers are Task 1.

**2. Placeholder scan** — searched the plan for `TBD`, `TODO`, `FIXME`, `similar to Task`, `as above`, `and so on`, `etc.`, `implement later`, `add appropriate`, `handle edge cases`, `<your`, `fill in`. The only `…` occurrences are inside quoted UI copy, a runbook shell placeholder the operator fills (`APP_SECRET='…'`, `<admin-origin>`, `<a psid>` — deliberate, and named as such), and three `// …unchanged …` comments in **Task 7 step 8** and **Task 9 step 6**, each of which points at a block quoted verbatim earlier in that same task or in the Consumes block. Every file is given in full or as an exact, quoted edit. No step says "write tests for the above" — every test step carries its code.

**3. Type consistency** (checked against the real source in this worktree, not from memory):

- **Phase-1/2 types reused unchanged:** `RecordMessageInput`, `ThreadMessageRow`, `InboxViewer`, `StoreAttachmentInput`, `AttachmentMeta`, `DbClient`, `ResolveThreadInput`, `ResolvedThread`, `EnquiryChannel`, `MessageChannelKind`, `SendEmailInput`, `SendEmailResult`, `WebhookFailureRow`, `RecordWebhookFailureInput`, `SessionUser`, `CronJobResult`. Only `RecordMessageInput` (+`senderVerified`, +`connectionId`), `ThreadMessageRow` (+`senderVerified`), `ParsedInboundEmail` (+`senderVerified`) and `EnquiryEmailContext` (+`lastInboundFromAddress`, +`lastInboundConnectionId`, +`lastInboundAt`) are extended, each in a named task with its test.
- **`MessageChannelKind`** (`web|email|messenger|instagram|note`) vs **`EnquiryChannel`** (`web|flash|inkling|email|messenger|instagram`): both real Prisma enums, verified in `schema.prisma`. `resolveThread` takes the enquiry-level one, `recordInbound`/`recordOutbound` the message-level one. `MetaChannelKind = "messenger" | "instagram"` is the narrow literal union both accept, so no cast is needed at either call site. `IdentityChannel` in `contact-identity.ts` is the same pair of literals, so `identity: { channel: event.channel }` type-checks.
- **New names, used identically everywhere they appear:** `SecretConfigError`, `SECRET_ENVELOPE_VERSION`, `MIN_SESSION_SECRET_CHARS`, `encryptSecret`, `decryptSecret`, `isEncryptedSecret`, `MetaChannel`, `ChannelConnectionRow`, `MetaConnection`, `UpsertChannelConnectionInput`, `upsertChannelConnection`, `listChannelConnections`, `findConnectionByExternalId`, `getConnection`, `touchConnectionEvent`, `deleteConnection`, `META_SIGNATURE_HEADER`, `signMetaPayload`, `verifyMetaSignature`, `MetaVerification`, `verifyHubChallenge`, `HubChallengeResult`, `MetaChannelKind`, `MetaAttachment`, `MetaMessagingEvent`, `parseMetaWebhook`, `singleEventBody`, `META_ATTACHMENT_HOST_SUFFIXES`, `META_ATTACHMENT_HOSTS`, `isAllowedMetaAttachmentUrl`, `MAX_META_MESSAGE_CHARS`, `splitOutboundText`, `DEFAULT_META_GRAPH_VERSION`, `metaGraphVersion`, `metaGraphUrl`, `META_SEND_WINDOW_MS`, `MetaWindowClosedError`, `isWithinSendWindow`, `isWindowGraphError`, `MAX_META_ATTACHMENTS`, `MAX_META_INLINE_TOTAL_BYTES`, `UNKNOWN_SENDER_NAME`, `META_INBOX_AUTHOR`, `MetaProfile`, `MetaInboundDeps`, `metaInboundDeps`, `MetaIngestOutcome`, `ingestMetaEvent`, `MetaSendError`, `MetaReplyTarget`, `loadMetaReplyTarget`, `SendMetaMessageInput`, `MetaSentPart`, `sendMetaMessage`, `SendEnquiryMetaInput`, `sendEnquiryMetaMessage`, `META_OAUTH_SCOPES`, `META_SUBSCRIBED_FIELDS`, `metaLoginDialogUrl`, `MetaPageAccount`, `parseMetaAccounts`, `MetaOAuthDeps`, `metaOAuthDeps`, `ConnectMetaResult`, `connectMetaPages`, `META_STATE_COOKIE`, `META_STATE_TTL_SECONDS`, `metaRedirectUri`, `connectMetaAction`, `disconnectMetaAction`, `REPLY_CHANNEL_LABEL`, `DEFAULT_EMAIL_FROM`, `configuredEmailFrom`, `parseAuthenticationResults`, `WEBHOOK_FAILURE_RETENTION_DAYS`, `purgeOldWebhookFailures`, `runWebhookFailurePurge`, `ENQUIRY_EMAIL_CONTEXT_SELECT`, `EnquiryEmailContextRow`, `toEnquiryEmailContext`, `CHANNEL_ICON`.
- **`ReplyChannel`** widens from `"email" | "none"` to `"email" | "messenger" | "instagram" | "none"` in exactly one place (Task 7), and every consumer (`actions.ts`, `REPLY_CHANNEL_LABEL`, the helper suite) is rewritten in that same task.
- **Module resolution:** every new file lives under `packages/core/src/services/**` or `packages/core/src/email/**`, both already covered by existing `exports` patterns and the vitest alias. No `package.json` change.

**Issues found and fixed while reviewing:**

- The first draft recorded a multi-part Meta reply as ONE `EnquiryMessage` keyed by the first `mid`. Meta echoes every API send back to us, so parts 2..n would have returned as unknown echoes and been re-recorded as "Meta inbox" messages — one reply for the customer, three bubbles for staff. `sendEnquiryMetaMessage` now records one row per part, and the reasoning is written into the code and the task.
- `ChannelConnection` originally had only `externalId` + `igAccountId`. An `instagram` row keyed by the IG business account id then had no way to route a send, because Instagram Messaging goes through the **Page's** `/messages` endpoint. Added `pageId`, set on both row kinds.
- The ruling's ignore reason `echo_known` looked dead against "known echoes are duplicates". Kept it alive with a real distinction: a known **echo** is our own send round-tripping (nothing to record → `echo_known`), a known **non-echo** is a replayed customer message (→ `duplicate`). Both are checked off the same `mid` lookup.
- The first draft's attachment budget pre-check charged only bytes actually received, so every fresh attachment always looked affordable and the 16 MB cap never bound. Task 1(c) now prices an unknown size at the full per-file cap and passes `min(perFileCap, remaining)` to `download`, so the stream is cut at the budget.
- `senderVerified` needed a column but ruling 1(h) placed it in Task 1, before the migration. Split explicitly: pure parser in Task 1, column + plumbing in Task 2, badge in Task 9 — recorded at each site rather than left to be discovered.
- `replyToEnquiry` originally chose the channel and *then* looked for a Meta target, which made a disconnected Page a hard failure instead of an email fallback. The target is now resolved first and feeds `metaTargetReady`.
- The Channels panel filtered failures to `provider: "resend"`, which would have hidden every Meta failure the moment the retry branch existed. The filter is dropped and the provider is printed on each row.
- The connect entry point was going to be a `GET /studio/channels/meta/connect` page. A plain GET link is followable by anyone who can get the owner to click it, and it cannot set the state cookie transactionally; it is a server action instead.
- The OAuth token exchange is the one Graph call that must carry the app secret in a query string (Meta documents no body form). Called out in the code comment rather than silently contradicting the "never a credential in a URL" constraint.

**Ambiguities resolved (also listed in the hand-off):**

1. `CustomerIdentity` and both `messenger`/`instagram` enum values already exist from Phase 1, so the migration is a new table plus two nullable columns and contains **no** `ALTER TYPE`.
2. The spec never says how a Meta reply finds its Page. `EnquiryMessage.connectionId` (a real FK, `SetNull`) plus the PSID/IGSID in `fromAddress`; a `pageId` on `Enquiry` was rejected because a customer can move channel inside one thread.
3. `ChannelConnection` needs `pageId` as well as `igAccountId`: an Instagram send goes through the owning Page's `/messages` endpoint.
4. The spec's "send yourself a message" button is impossible before someone messages the Page (no PSID exists), so it is a per-connection **Last event received** timestamp.
5. Connect is a **server action**, not a GET route — owner check, action CSRF protection, and the state cookie written before the redirect.
6. `senderVerified` is `null` (unknown), not `false`, for web and Meta traffic and for mail with no `Authentication-Results` header; only an explicit failure badges the bubble, and nothing is ever dropped on it.
7. A staff reply over 2000 characters becomes several Meta messages and several thread rows — one per `mid` — so Meta's echo of each part is recognised rather than re-recorded.
8. The spec names `verifyWebhookSignature(appSecret, raw, header)`; Phase 2 already exports a function of that name (Svix/Standard-Webhooks) from `channels/webhook-signature.ts`. The Meta one is `verifyMetaSignature` in `channels/meta.ts` and takes a named-argument object — the two schemes are unrelated and must not share a name in a package where both are importable.
9. The spec's single `channels/meta.ts` is split the way Phase 2 split email — `meta.ts` (pure), `meta-inbound.ts`, `meta-outbound.ts`, `meta-oauth.ts` — because one file would repeat the ~570-line problem Task 1 exists to fix.
10. `messaging_postbacks` is subscribed (so the field exists when a menu is added) but ignored, since this phase ships no menu or Get Started button.
11. Meta attachment URLs are fetched only from an allow-list of Meta CDN hosts; anything else is stored as a link. The spec says nothing about SSRF, but the URL arrives in a payload and is fetched server-side.
12. Graph's token exchange is a GET with the app secret in the query string — Meta documents no alternative. Every other Graph call in this plan puts the token in the request body or an `Authorization` header.
13. `SESSION_SECRET` must be ≥ 32 characters for channel tokens (Phase-1 auth only demands 16). Documented in the runbook, `.env.production.example` and `docs/DEPLOY.md`, and enforced by `SecretConfigError`.
14. Rotating `SESSION_SECRET` makes stored Page tokens unreadable. That degrades to "connection listed, replies fall back to email, press Connect again" rather than an exception — and the runbook says so.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-08-enquiries-phase-3-meta-channels.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints.

Which approach?
