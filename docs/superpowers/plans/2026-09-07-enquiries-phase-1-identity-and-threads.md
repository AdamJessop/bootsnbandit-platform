# Enquiries Omnichannel — Phase 1: Identity + Threads Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every enquiry a real message thread and every customer a unique identity. Schema for `EnquiryMessage` / `Attachment` / `EnquiryRead` / `CustomerIdentity`, a one-off duplicate-customer merge followed by unique email/phone indexes, normalised find-or-create identity resolution, a pure threading rule, an admin thread view that replaces the flat MessageLog history, generalised visibility (artists see their own + every unassigned enquiry), the artist close-authorisation fix, internal notes, and an unread badge in the staff nav.

**Architecture:** Identity and threading live in `@bnb/core/services` as four focused modules — `contact-identity.ts` (normalisation + `findOrCreateCustomer` + `linkIdentity`), `enquiry-threading.ts` (pure `chooseThread` + DB `resolveThread`), `enquiry-messages.ts` (record/list/read/unread) and `assets.ts` (attachment bytes in Postgres, mirroring `moodboard-assets.ts`). `createEnquiry` routes through `findOrCreateCustomer` and writes the first inbound web message, so every enquiry has a thread from birth. `sendEmail` gains an optional `enquiryId` and records the matching outbound `EnquiryMessage`; channel-specific sending (Resend inbound, Meta) is Phases 2–3 and is **not** built here. Admin renders the thread in `EnquiryThread.tsx`, serves inline attachments from a staff-gated `/api/attachments/[id]`, and shows unread counts in the shell.

**Tech Stack:** Node 22, npm workspaces, Next.js 15 App Router, React 19, TypeScript, Prisma 7 (Postgres 16), zod 4, vitest 4 (`renderToStaticMarkup` for components, `testdb` harness for DB suites), libphonenumber-js (new), shadcn/ui + Tailwind (admin), plain CSS classes (web).

**Spec:** `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md` (Phasing → phase 1)

## Global Constraints

- Node 22, npm workspaces. Tests: `npm test -w @bnb/core`, `npm test -w @bnb/web`, `npm test -w @bnb/admin`. Dev Postgres is `docker compose up -d` (port 5435); DB suites use the `testdb` harness (`testDb`, `dbReachable`, `closeTestDb`, `uid`) and **return early** when `dbReachable()` is false.
- Load env for CLI work with `set -a && . ./.env && set +a` from the repo root. Prisma CLI loads the root `.env` itself via `packages/core/prisma.config.ts`.
- Migrations: `npm -w @bnb/core run db:migrate -- --name <name>` (= `prisma migrate dev`). Every migration in this plan also ships its exact `packages/core/prisma/migrations/<timestamp>_<name>/migration.sql` so it can be written by hand and applied with `npm -w @bnb/core run db:migrate` when `migrate dev` cannot generate it. After any schema change run `npm run db:generate`.
- **Migration ordering is load-bearing.** Task 2 adds columns/tables/enum values only. `scripts/merge-duplicate-customers.ts` (Task 4) runs next and collapses duplicate customers. Only then does Task 5 add the unique indexes on `Customer.email` / `Customer.phone`. Never reorder these three.
- `apps/web` must never import `@bnb/core/auth` (a guard test enforces it). Nothing in this phase changes that.
- Admin uses shadcn/ui + Tailwind design tokens (`text-text-muted`, `border-border-default`, `bg-bg-card`, …); web uses plain CSS classes. Images are plain `<img>` with `{/* eslint-disable-next-line @next/next/no-img-element */}`, never `next/image`.
- New runtime dependency: **`libphonenumber-js` only** (added to `packages/core/package.json` and root `package.json`, then `npm install`). No other new runtime dependencies.
- `packages/core/package.json` already maps `"./services/*": "./src/services/*.ts"`, so `@bnb/core/services/contact-identity`, `/enquiry-threading`, `/enquiry-messages`, `/assets` and `/customer-merge` resolve without an exports change. Do not add per-file entries.
- Threading rule (verbatim, implemented in Task 6): **token match → same customer's most recent enquiry with status in (new, replied, customer_replied) whose `lastMessageAt`/`createdAt` is within 30 days → otherwise create a new enquiry.** Inbound on `replied` → `customer_replied`; on `new` stays `new`; `closed`/`converted` are never reopened.
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
| `packages/core/package.json`, root `package.json` | `libphonenumber-js` dependency; `customers:merge` script |
| `packages/core/src/services/contact-identity.ts` (+test) | `normaliseEmail`, `normalisePhone`, `findOrCreateCustomer`, `linkIdentity` |
| `packages/core/prisma/schema.prisma` + 2 migrations | channels/direction enums, `customer_replied`, `Enquiry` additions, `EnquiryMessage`, `Attachment`, `EnquiryRead`, `CustomerIdentity`, unique `Customer.email`/`phone` |
| `packages/core/src/services/enquiry-schema.test.ts` | schema contract (DB) for the new models |
| `packages/core/src/services/customer-merge.ts` (+test) | pure `planCustomerMerges` + DB `mergeDuplicateCustomers` |
| `scripts/merge-duplicate-customers.ts` | idempotent CLI wrapper with `--dry-run` |
| `packages/core/src/services/customers.ts` | `upsertCustomerByContact` delegates to `findOrCreateCustomer`; create/update normalise |
| `packages/core/src/services/customer-welcome.ts` | normalises + friendly duplicate error |
| `packages/core/src/services/enquiry-threading.ts` (+test) | pure `chooseThread`, DB `resolveThread` |
| `packages/core/src/services/assets.ts` (+test) | `storeAttachment`, `getAttachment` |
| `packages/core/src/services/enquiry-messages.ts` (+test) | record/list/read/unread + `visibleEnquiryWhere` |
| `packages/core/src/services/enquiries.ts` (+test) | identity + `channel` + first inbound message + ack in-thread |
| `packages/core/src/email/index.ts` (+test) | optional `enquiryId` → outbound `EnquiryMessage` |
| `apps/admin/src/app/api/attachments/[id]/route.ts` (+test) | staff-gated inline attachment bytes |
| `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+test) | `isUnassigned`, generalised `artistInboxWhere`/`canAccessEnquiry`, `attachmentHref`, `countByStatus` |
| `apps/admin/src/app/(staff)/enquiries/actions.ts` (+test) | outbound recording, `addInternalNote`, `markEnquiryRead`, close authorisation |
| `apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx` (+test) | chronological bubbles + attachments |
| `apps/admin/src/app/(staff)/enquiries/{page,EnquiryInbox,EnquiryDetailSections}.tsx` | thread wiring, tabs, assigned pill, unread dot, note composer |
| `apps/admin/src/app/(staff)/_shared/labels.ts` (+test) | `customer_replied` label + variant |
| `apps/admin/src/app/(staff)/layout.tsx`, `apps/admin/src/components/admin/AppShell.tsx` | unread badge + 60 s refresh |

---

### Task 1: `libphonenumber-js` + contact normalisation

**Files:**
- Modify: `packages/core/package.json`, root `package.json`
- Create: `packages/core/src/services/contact-identity.ts`, `packages/core/src/services/contact-identity.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function normaliseEmail(raw: string | null | undefined): string | null
  export function normalisePhone(raw: string | null | undefined): string | null
  export const PHONE_DEFAULT_REGION = "GB";
  ```

- [ ] **Step 1: Add the dependency**

Add to `packages/core/package.json` `dependencies` (alphabetical, after `"ical-generator"`):
```json
    "libphonenumber-js": "^1.12.0",
```
Add the identical line to the root `package.json` `dependencies` (after `"ical-generator"`), then from the repo root:
```bash
npm install
node -e "const{parsePhoneNumberFromString}=require('libphonenumber-js');console.log(parsePhoneNumberFromString('07700 900123','GB').number)"
```
Expected: prints `+447700900123`.

- [ ] **Step 2: Write the failing test**

`packages/core/src/services/contact-identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normaliseEmail, normalisePhone } from "./contact-identity";

describe("normaliseEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normaliseEmail("  Amy.Jones@Example.COM ")).toBe(
      "amy.jones@example.com",
    );
  });

  it("returns null for blank / missing / malformed values", () => {
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
    expect(normaliseEmail("   ")).toBeNull();
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
    expect(normaliseEmail("two words@example.com")).toBeNull();
  });

  it("keeps plus-addressing and dots (they are distinct mailboxes)", () => {
    expect(normaliseEmail("amy+ink@example.com")).toBe("amy+ink@example.com");
  });
});

describe("normalisePhone", () => {
  it("converts UK national formats to E.164", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("07700900123")).toBe("+447700900123");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("(020) 7946 0958")).toBe("+442079460958");
  });

  it("keeps an explicit international number in its own country", () => {
    expect(normalisePhone("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns null for blank / missing / unparseable values", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone("  ")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("12345")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/contact-identity.test.ts`
Expected: FAIL — `Failed to load url ./contact-identity` / cannot find module `./contact-identity`.

- [ ] **Step 4: Implement**

`packages/core/src/services/contact-identity.ts`:

```ts
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Customer identity resolution: one CRM record per human, keyed by a
 * normalised email and/or phone (both unique in the schema) plus per-channel
 * external ids (Messenger PSID / Instagram IGSID) that carry no contact
 * details at all.
 *
 * Normalisation is the whole point of the unique indexes — "Amy@X.com" and
 * "amy@x.com", "07700 900123" and "+447700900123" must collapse to one row.
 */

/** The studio is in the UK; bare national numbers are read as GB. */
export const PHONE_DEFAULT_REGION = "GB";

/**
 * Lowercase + trim. Deliberately does NOT strip dots or plus-addressing:
 * `amy+ink@example.com` is a mailbox the customer chose and may be a different
 * person's alias elsewhere. Returns null for anything that is not shaped like
 * an address so junk never occupies the unique index.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Parse to E.164 with a GB default region. Returns null when the number is
 * missing or cannot be parsed as a valid number — callers keep the raw value
 * out of the unique column rather than storing an un-matchable string.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, PHONE_DEFAULT_REGION);
  return parsed?.isValid() ? parsed.number : null;
}
```

- [ ] **Step 5: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/contact-identity.test.ts`
Expected: PASS (9 assertions across 6 tests).

```bash
git add package.json package-lock.json packages/core/package.json packages/core/src/services/contact-identity.ts packages/core/src/services/contact-identity.test.ts
git commit -m "feat(core): email + E.164 phone normalisation for customer identity

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 2: Migration A — thread schema (additive only)

**Files:**
- Modify: `packages/core/prisma/schema.prisma`
- Create: `packages/core/prisma/migrations/20260907130000_enquiry_threads/migration.sql`
- Create: `packages/core/src/services/enquiry-schema.test.ts`

**Interfaces:**
- Produces (Prisma client models/enums consumed by every later task):
  ```ts
  EnquiryChannel: "web" | "flash" | "inkling" | "email" | "messenger" | "instagram"
  EnquiryStatus:  "new" | "replied" | "customer_replied" | "converted" | "closed"
  MessageDirection: "inbound" | "outbound" | "internal"
  MessageChannelKind: "web" | "email" | "messenger" | "instagram" | "note"
  models: EnquiryMessage, Attachment, EnquiryRead, CustomerIdentity
  Enquiry gains: channel, subject, threadToken (unique), lastMessageAt, lastInboundAt, assignedAt, messages[], reads[]
  Customer gains: identities[], enquiryMessages[]
  User gains: enquiryMessages[], enquiryReads[]
  ```
- **Not** in this migration: the unique indexes on `Customer.email` / `Customer.phone` (Task 5, after the merge script).

- [ ] **Step 1: Write the failing schema-contract test**

`packages/core/src/services/enquiry-schema.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

/**
 * Contract test for the Phase-1 thread schema: the new enum values, the
 * auto-generated per-enquiry reply token, and the four new tables with their
 * cascade + uniqueness behaviour. Guards the migration, not business logic.
 */
describe("enquiry thread schema (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("auto-generates a unique threadToken and accepts customer_replied", async () => {
    if (!(await dbReachable())) return;
    const a = await db().enquiry.create({
      data: { contactName: `Tok ${uid()}`, channel: "email" },
    });
    const b = await db().enquiry.create({
      data: { contactName: `Tok ${uid()}`, channel: "web" },
    });
    enquiries.push(a.id, b.id);
    expect(a.threadToken).toBeTruthy();
    expect(a.threadToken).not.toBe(b.threadToken);
    expect(a.channel).toBe("email");
    expect(a.lastMessageAt).toBeNull();
    expect(a.lastInboundAt).toBeNull();

    const updated = await db().enquiry.update({
      where: { id: a.id },
      data: { status: "customer_replied" },
    });
    expect(updated.status).toBe("customer_replied");
  });

  it("stores messages with attachments and cascades on enquiry delete", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Msg ${uid()}` },
    });
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "web",
        bodyText: "Hello there",
        fromName: "Amy",
        attachments: {
          create: [
            { mime: "image/png", size: 3, bytes: new Uint8Array([1, 2, 3]) },
            { mime: "application/pdf", size: 0, url: "https://x.test/a.pdf" },
          ],
        },
      },
      include: { attachments: true },
    });
    expect(message.deliveryStatus).toBe("logged");
    expect(message.attachments).toHaveLength(2);

    await db().enquiry.delete({ where: { id: enquiry.id } });
    expect(
      await db().enquiryMessage.findUnique({ where: { id: message.id } }),
    ).toBeNull();
    expect(
      await db().attachment.count({ where: { messageId: message.id } }),
    ).toBe(0);
  });

  it("rejects a duplicate externalId on EnquiryMessage", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Ext ${uid()}` },
    });
    enquiries.push(enquiry.id);
    const externalId = uid("ext");
    await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "email",
        bodyText: "one",
        externalId,
      },
    });
    await expect(
      db().enquiryMessage.create({
        data: {
          enquiryId: enquiry.id,
          direction: "inbound",
          channel: "email",
          bodyText: "two",
          externalId,
        },
      }),
    ).rejects.toThrow();
  });

  it("keys EnquiryRead by (enquiryId, userId) and CustomerIdentity by (channel, externalId)", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const enquiry = await db().enquiry.create({
      data: { contactName: `Read ${uid()}` },
    });
    enquiries.push(enquiry.id);

    const first = new Date("2026-09-01T10:00:00.000Z");
    const later = new Date("2026-09-02T10:00:00.000Z");
    await db().enquiryRead.upsert({
      where: { enquiryId_userId: { enquiryId: enquiry.id, userId: user.id } },
      create: { enquiryId: enquiry.id, userId: user.id, readAt: first },
      update: { readAt: first },
    });
    const bumped = await db().enquiryRead.upsert({
      where: { enquiryId_userId: { enquiryId: enquiry.id, userId: user.id } },
      create: { enquiryId: enquiry.id, userId: user.id, readAt: later },
      update: { readAt: later },
    });
    expect(bumped.readAt.toISOString()).toBe(later.toISOString());
    expect(
      await db().enquiryRead.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);

    const customer = await db().customer.create({
      data: { name: `Ident ${uid()}` },
    });
    customers.push(customer.id);
    const psid = uid("psid");
    await db().customerIdentity.create({
      data: {
        customerId: customer.id,
        channel: "messenger",
        externalId: psid,
        displayName: "Amy J",
      },
    });
    await expect(
      db().customerIdentity.create({
        data: { customerId: customer.id, channel: "messenger", externalId: psid },
      }),
    ).rejects.toThrow();
    // Same external id on a different channel is a different person.
    await db().customerIdentity.create({
      data: { customerId: customer.id, channel: "instagram", externalId: psid },
    });
    expect(
      await db().customerIdentity.count({ where: { customerId: customer.id } }),
    ).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/enquiry-schema.test.ts`
Expected: FAIL — `db().enquiryMessage` is undefined (`TypeError: Cannot read properties of undefined (reading 'create')`), and `channel`/`threadToken` are rejected as unknown args on `enquiry.create`.

- [ ] **Step 3: Edit the schema**

In `packages/core/prisma/schema.prisma`:

Replace the `EnquiryStatus` enum with:
```prisma
enum EnquiryStatus {
  new
  replied
  customer_replied
  converted
  closed
}
```

Add three enums directly after `EnquirySource`:
```prisma
// Originating channel of an enquiry (superset of EnquirySource, which stays
// as the legacy web/flash/inkling form marker).
enum EnquiryChannel {
  web
  flash
  inkling
  email
  messenger
  instagram
}

enum MessageDirection {
  inbound
  outbound
  internal
}

enum MessageChannelKind {
  web
  email
  messenger
  instagram
  note
}
```

Inside `model Enquiry`, after `source            EnquirySource @default(web)`:
```prisma
  channel           EnquiryChannel @default(web)
  subject           String?
  threadToken       String        @unique @default(cuid())
  lastMessageAt     DateTime?
  lastInboundAt     DateTime?
  assignedAt        DateTime?
```
and in its relation block, after `moodboardAssets MoodboardAsset[]`:
```prisma
  messages        EnquiryMessage[]
  reads           EnquiryRead[]
```
and add two indexes alongside the existing ones:
```prisma
  @@index([lastMessageAt])
  @@index([channel])
```

Inside `model Customer`, after `passwordTokens CustomerPasswordToken[]`:
```prisma
  identities      CustomerIdentity[]
  enquiryMessages EnquiryMessage[]
```

Inside `model User`, after `artist         Artist?`:
```prisma
  enquiryMessages EnquiryMessage[]
  enquiryReads    EnquiryRead[]
```

Add four models immediately after `model MoodboardAsset`:
```prisma
// ---------------------------------------------------------------------------
// Enquiry threads (omnichannel inbox)
// ---------------------------------------------------------------------------

// One message on an enquiry thread: inbound from the customer, outbound from
// staff, or an internal note never sent anywhere. `externalId` is the
// provider's id (Resend email id / Meta mid) and is unique so webhook retries
// are idempotent.
model EnquiryMessage {
  id             String             @id @default(cuid())
  enquiryId      String
  customerId     String?
  direction      MessageDirection
  channel        MessageChannelKind
  authorUserId   String?
  fromName       String?
  fromAddress    String?
  subject        String?
  bodyText       String
  bodyHtml       String?
  externalId     String?            @unique
  deliveryStatus MessageStatus      @default(logged)
  createdAt      DateTime           @default(now())

  enquiry     Enquiry      @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  customer    Customer?    @relation(fields: [customerId], references: [id], onDelete: SetNull)
  authorUser  User?        @relation(fields: [authorUserId], references: [id], onDelete: SetNull)
  attachments Attachment[]

  @@index([enquiryId, createdAt])
  @@index([customerId])
}

// Generalised asset store for message attachments. Images up to 8 MB are held
// inline as bytes (same reasoning as MoodboardAsset: ephemeral container
// disks); anything larger or non-image keeps a source `url` only.
model Attachment {
  id        String   @id @default(cuid())
  messageId String?
  mime      String
  size      Int
  filename  String?
  bytes     Bytes?
  url       String?
  createdAt DateTime @default(now())

  message EnquiryMessage? @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@index([createdAt])
}

// Per-staff-user read marker. An enquiry is unread for a user when its
// lastInboundAt is later than that user's readAt (or there is no row).
model EnquiryRead {
  enquiryId String
  userId    String
  readAt    DateTime @default(now())

  enquiry Enquiry @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([enquiryId, userId])
  @@index([userId])
}

// A customer's handle on a channel that carries no email/phone (Messenger
// PSID, Instagram IGSID). One handle belongs to exactly one customer.
model CustomerIdentity {
  id          String             @id @default(cuid())
  customerId  String
  channel     MessageChannelKind
  externalId  String
  displayName String?
  createdAt   DateTime           @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([channel, externalId])
  @@index([customerId])
}
```

- [ ] **Step 4: Generate + apply the migration**

Preferred:
```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate -- --name enquiry_threads
```

**`migrate dev` cannot add `threadToken` on its own** (a required unique column on a table that already has rows). Use `--create-only`, then replace the generated SQL with the file below and apply:
```bash
set -a && . ./.env && set +a && npx prisma migrate dev --create-only --name enquiry_threads --schema=packages/core/prisma/schema.prisma
```

Fallback — write `packages/core/prisma/migrations/20260907130000_enquiry_threads/migration.sql` by hand with exactly:
```sql
-- CreateEnum
CREATE TYPE "EnquiryChannel" AS ENUM ('web', 'flash', 'inkling', 'email', 'messenger', 'instagram');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound', 'internal');

-- CreateEnum
CREATE TYPE "MessageChannelKind" AS ENUM ('web', 'email', 'messenger', 'instagram', 'note');

-- AlterEnum
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- is not USED in the same transaction. Nothing below writes 'customer_replied'.
ALTER TYPE "EnquiryStatus" ADD VALUE 'customer_replied' AFTER 'replied';

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "channel" "EnquiryChannel" NOT NULL DEFAULT 'web',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "threadToken" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "assignedAt" TIMESTAMP(3);

-- Backfill: every existing enquiry needs a reply token before the NOT NULL.
UPDATE "Enquiry" SET "threadToken" = replace(gen_random_uuid()::text, '-', '') WHERE "threadToken" IS NULL;
ALTER TABLE "Enquiry" ALTER COLUMN "threadToken" SET NOT NULL;

-- Backfill: mirror the legacy source into the new channel column.
UPDATE "Enquiry" SET "channel" = 'flash' WHERE "source" = 'flash';
UPDATE "Enquiry" SET "channel" = 'inkling' WHERE "source" = 'inkling';

-- Backfill: give the inbox a sensible activity ordering from day one.
UPDATE "Enquiry" SET "lastMessageAt" = "createdAt" WHERE "lastMessageAt" IS NULL;
UPDATE "Enquiry" SET "assignedAt" = "updatedAt" WHERE "preferredArtistId" IS NOT NULL AND "assignedAt" IS NULL;

-- CreateTable
CREATE TABLE "EnquiryMessage" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "customerId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "authorUserId" TEXT,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "externalId" TEXT,
    "deliveryStatus" "MessageStatus" NOT NULL DEFAULT 'logged',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filename" TEXT,
    "bytes" BYTEA,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryRead" (
    "enquiryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryRead_pkey" PRIMARY KEY ("enquiryId","userId")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_threadToken_key" ON "Enquiry"("threadToken");

-- CreateIndex
CREATE INDEX "Enquiry_lastMessageAt_idx" ON "Enquiry"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Enquiry_channel_idx" ON "Enquiry"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryMessage_externalId_key" ON "EnquiryMessage"("externalId");

-- CreateIndex
CREATE INDEX "EnquiryMessage_enquiryId_createdAt_idx" ON "EnquiryMessage"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryMessage_customerId_idx" ON "EnquiryMessage"("customerId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

-- CreateIndex
CREATE INDEX "EnquiryRead_userId_idx" ON "EnquiryRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_channel_externalId_key" ON "CustomerIdentity"("channel", "externalId");

-- CreateIndex
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EnquiryMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRead" ADD CONSTRAINT "EnquiryRead_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRead" ADD CONSTRAINT "EnquiryRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Apply and regenerate:
```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate && npm run db:generate
npx prisma validate --schema=packages/core/prisma/schema.prisma
```
Expected: migration applied, `The schema at ... is valid`.

- [ ] **Step 5: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/enquiry-schema.test.ts` — PASS.
Then `npm test -w @bnb/core` — PASS (the existing suites are untouched by an additive migration).

```bash
git add packages/core/prisma/schema.prisma packages/core/prisma/migrations packages/core/src/services/enquiry-schema.test.ts
git commit -m "feat(core): enquiry thread schema — messages, attachments, reads, customer identities, customer_replied

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 3: `findOrCreateCustomer` + `linkIdentity`

**Files:**
- Modify: `packages/core/src/services/contact-identity.ts`, `packages/core/src/services/contact-identity.test.ts`, `packages/core/src/services/customers.ts`, `packages/core/src/services/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type IdentityChannel = "messenger" | "instagram";
  export interface ContactIdentityInput { channel: IdentityChannel; externalId: string; displayName?: string | null }
  export interface FindOrCreateCustomerInput {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    marketingConsent?: boolean;
    identity?: ContactIdentityInput | null;
  }
  export function findOrCreateCustomer(input: FindOrCreateCustomerInput): Promise<Customer>
  export function linkIdentity(customerId: string, channel: IdentityChannel, externalId: string, displayName?: string | null): Promise<CustomerIdentity>
  export function displayNameFor(input: { name?: string | null; email?: string | null; identity?: ContactIdentityInput | null }): string
  ```
- Consumes: `normaliseEmail`, `normalisePhone` (Task 1); `CustomerIdentity` model (Task 2).
- Changes: `upsertCustomerByContact(input: CreateCustomerInput): Promise<Customer>` keeps its signature but delegates to `findOrCreateCustomer` (callers: `services/enquiries.ts`, `services/reception.ts`).

- [ ] **Step 1: Append the failing DB tests**

Append to `packages/core/src/services/contact-identity.test.ts` (and add the imports at the top of the file):

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  displayNameFor,
  findOrCreateCustomer,
  linkIdentity,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";
```

```ts
describe("displayNameFor", () => {
  it("prefers the given name, then the identity display name, then the email local part", () => {
    expect(displayNameFor({ name: " Amy Jones " })).toBe("Amy Jones");
    expect(
      displayNameFor({
        name: "  ",
        identity: { channel: "messenger", externalId: "p1", displayName: "Amy J" },
      }),
    ).toBe("Amy J");
    expect(displayNameFor({ email: "amy.jones@example.com" })).toBe(
      "amy.jones",
    );
    expect(displayNameFor({})).toBe("Customer");
  });
});

describe("findOrCreateCustomer + linkIdentity (DB)", () => {
  const db = () => testDb();
  const customers: string[] = [];

  afterAll(async () => {
    if ((await dbReachable()) && customers.length) {
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  const track = (c: { id: string }) => {
    if (!customers.includes(c.id)) customers.push(c.id);
    return c;
  };

  it("stores normalised contact details on create", async () => {
    if (!(await dbReachable())) return;
    const local = uid("amy");
    const created = track(
      await findOrCreateCustomer({
        name: "Amy",
        email: `  ${local}@Example.COM `,
        phone: "07700 900123",
      }),
    );
    expect(created.email).toBe(`${local}@example.com`);
    expect(created.phone).toBe("+447700900123");
  });

  it("matches an existing customer on a differently-formatted email or phone", async () => {
    if (!(await dbReachable())) return;
    const local = uid("bee");
    const first = track(
      await findOrCreateCustomer({
        name: "Bee",
        email: `${local}@example.com`,
        phone: "07700 900124",
      }),
    );
    const byEmail = await findOrCreateCustomer({
      name: "Someone Else",
      email: `  ${local.toUpperCase()}@EXAMPLE.com`,
    });
    const byPhone = await findOrCreateCustomer({
      name: "Someone Else",
      phone: "+44 7700 900124",
    });
    expect(byEmail.id).toBe(first.id);
    expect(byPhone.id).toBe(first.id);
    // Contact-takeover guard: a match is returned UNMUTATED.
    expect(byEmail.name).toBe("Bee");
    expect(byPhone.email).toBe(`${local}@example.com`);
  });

  it("creates a fresh row when nothing matches, falling back for the name", async () => {
    if (!(await dbReachable())) return;
    const local = uid("cee");
    const created = track(
      await findOrCreateCustomer({ email: `${local}@example.com` }),
    );
    expect(created.name).toBe(local);
    expect(created.phone).toBeNull();
  });

  it("keeps an unparseable phone out of the contact column", async () => {
    if (!(await dbReachable())) return;
    const created = track(
      await findOrCreateCustomer({ name: `Dee ${uid()}`, phone: "call me" }),
    );
    expect(created.phone).toBeNull();
  });

  it("resolves a Meta handle to its customer and links new handles", async () => {
    if (!(await dbReachable())) return;
    const psid = uid("psid");
    const first = track(
      await findOrCreateCustomer({
        identity: { channel: "messenger", externalId: psid, displayName: "Zed M" },
      }),
    );
    expect(first.name).toBe("Zed M");

    const again = await findOrCreateCustomer({
      identity: { channel: "messenger", externalId: psid },
    });
    expect(again.id).toBe(first.id);
    expect(
      await db().customerIdentity.count({ where: { customerId: first.id } }),
    ).toBe(1);

    // Linking is idempotent and attaches extra handles to the same customer.
    const igsid = uid("igsid");
    await linkIdentity(first.id, "instagram", igsid, "zed.m");
    await linkIdentity(first.id, "instagram", igsid, "zed.m");
    expect(
      await db().customerIdentity.count({ where: { customerId: first.id } }),
    ).toBe(2);
  });

  it("links a handle onto an existing customer matched by email", async () => {
    if (!(await dbReachable())) return;
    const local = uid("eff");
    const first = track(
      await findOrCreateCustomer({ name: "Eff", email: `${local}@example.com` }),
    );
    const psid = uid("psid");
    const same = await findOrCreateCustomer({
      email: `${local}@example.com`,
      identity: { channel: "messenger", externalId: psid, displayName: "Eff" },
    });
    expect(same.id).toBe(first.id);
    expect(
      await db().customerIdentity.findUnique({
        where: { channel_externalId: { channel: "messenger", externalId: psid } },
      }),
    ).toMatchObject({ customerId: first.id });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/contact-identity.test.ts`
Expected: FAIL — `findOrCreateCustomer is not a function` / `No "displayNameFor" export is defined on the module`.

- [ ] **Step 3: Implement**

Append to `packages/core/src/services/contact-identity.ts` (and add the imports at the top, after the libphonenumber import):

```ts
import type { Customer, CustomerIdentity, Prisma } from "@prisma/client";
import { prisma } from "@bnb/core/db";
```

```ts
/** Channels whose users are known by an opaque handle rather than contact details. */
export type IdentityChannel = "messenger" | "instagram";

export interface ContactIdentityInput {
  channel: IdentityChannel;
  externalId: string;
  displayName?: string | null;
}

export interface FindOrCreateCustomerInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  marketingConsent?: boolean;
  identity?: ContactIdentityInput | null;
}

/** Best available human-readable name, never blank (the column is required). */
export function displayNameFor(input: {
  name?: string | null;
  email?: string | null;
  identity?: ContactIdentityInput | null;
}): string {
  const given = input.name?.trim();
  if (given) return given;
  const fromIdentity = input.identity?.displayName?.trim();
  if (fromIdentity) return fromIdentity;
  const email = normaliseEmail(input.email);
  if (email) return email.split("@")[0];
  return "Customer";
}

/**
 * Attach a channel handle to a customer. Idempotent: re-linking the same
 * handle refreshes the display name instead of failing the unique index.
 */
export async function linkIdentity(
  customerId: string,
  channel: IdentityChannel,
  externalId: string,
  displayName?: string | null,
): Promise<CustomerIdentity> {
  return prisma.customerIdentity.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { customerId, channel, externalId, displayName: displayName ?? null },
    update: displayName ? { displayName } : {},
  });
}

/**
 * Resolve the one CRM record for a person: by channel handle first (Meta users
 * have no contact details), then by normalised email or phone, otherwise a new
 * row with normalised values.
 *
 * SECURITY: an existing match is returned UNMUTATED — the public enquiry paths
 * call this, so writing contact/consent onto a match would let a stranger take
 * over a record by matching on the other field. Only the identity link is
 * added to a match, because a channel handle is proof of that account.
 */
export async function findOrCreateCustomer(
  input: FindOrCreateCustomerInput,
): Promise<Customer> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const identity = input.identity ?? null;

  if (identity) {
    const link = await prisma.customerIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: identity.channel,
          externalId: identity.externalId,
        },
      },
      select: { customer: true },
    });
    if (link) return link.customer;
  }

  const or: Prisma.CustomerWhereInput[] = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  const existing = or.length
    ? await prisma.customer.findFirst({
        where: { OR: or },
        orderBy: { createdAt: "asc" },
      })
    : null;

  if (existing) {
    if (identity) {
      await linkIdentity(
        existing.id,
        identity.channel,
        identity.externalId,
        identity.displayName,
      );
    }
    return existing;
  }

  const data = {
    name: displayNameFor({ name: input.name, email: input.email, identity }),
    email,
    phone,
    marketingConsent: input.marketingConsent ?? false,
  };

  let created: Customer;
  try {
    created = await prisma.customer.create({ data });
  } catch (err) {
    // Unique email/phone: a concurrent request won the race — take theirs.
    if (isUniqueViolation(err) && or.length) {
      const winner = await prisma.customer.findFirst({
        where: { OR: or },
        orderBy: { createdAt: "asc" },
      });
      if (!winner) throw err;
      created = winner;
    } else {
      throw err;
    }
  }

  if (identity) {
    await linkIdentity(
      created.id,
      identity.channel,
      identity.externalId,
      identity.displayName,
    );
  }
  return created;
}

/** Prisma's P2002 (unique constraint) without importing the error class. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}
```

- [ ] **Step 4: Point `upsertCustomerByContact` at it**

In `packages/core/src/services/customers.ts`, add the import:
```ts
import { findOrCreateCustomer } from "./contact-identity";
```
and replace the whole `upsertCustomerByContact` body (keep the doc comment, adding the delegation note):

```ts
/**
 * Find an existing customer by normalised email (preferred) or phone,
 * otherwise create one. Used by public enquiry/flash flows and the front-desk
 * walk-in path where the visitor isn't authenticated.
 *
 * Thin alias for `findOrCreateCustomer` (services/contact-identity), which
 * owns normalisation, the identity handles and the no-mutation guard: a match
 * is returned UNMUTATED so a stranger cannot overwrite an existing customer's
 * email/phone/marketingConsent by matching on the other field.
 */
export async function upsertCustomerByContact(
  input: CreateCustomerInput,
): Promise<Customer> {
  return findOrCreateCustomer({
    name: input.name,
    email: input.email,
    phone: input.phone,
    marketingConsent: input.marketingConsent,
  });
}
```

Add `export * from "./contact-identity";` to `packages/core/src/services/index.ts` (after `export * from "./customers";`).

- [ ] **Step 5: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/contact-identity.test.ts src/services/customers.test.ts src/services/reception.test.ts`
Expected: all PASS. The existing `customers.test.ts` cases still hold — the "does NOT overwrite contact/consent on match" test is exactly the no-mutation guard, and "creates anew when no contact match" passes a name only.

Then `npm test -w @bnb/core` — PASS.

```bash
git add packages/core/src/services/contact-identity.ts packages/core/src/services/contact-identity.test.ts packages/core/src/services/customers.ts packages/core/src/services/index.ts
git commit -m "feat(core): findOrCreateCustomer + linkIdentity; upsertCustomerByContact normalises via them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 4: Duplicate-customer merge — planner, service, CLI script

**Files:**
- Create: `packages/core/src/services/customer-merge.ts`, `packages/core/src/services/customer-merge.test.ts`, `scripts/merge-duplicate-customers.ts`
- Modify: `packages/core/src/services/index.ts`, root `package.json` (script)

**Interfaces:**
- Produces:
  ```ts
  export interface MergeCandidate {
    id: string; createdAt: Date; name: string;
    email: string | null; phone: string | null; notes: string | null;
    tags: string[]; marketingConsent: boolean; loyaltyStamps: number; loyaltyTier: number;
  }
  export interface NormalisedContact { email: string | null; phone: string | null }
  export function contactKeys(row: { email: string | null; phone: string | null }): { keys: string[]; normalised: NormalisedContact }
  export interface MergeGroup { keepId: string; mergeIds: string[]; keys: string[] }
  export function planCustomerMerges(rows: MergeCandidate[]): MergeGroup[]
  export interface MergedFields { name: string; email: string | null; phone: string | null; notes: string | null; tags: string[]; marketingConsent: boolean; loyaltyStamps: number; loyaltyTier: number }
  export function mergedFields(keep: MergeCandidate, dupes: MergeCandidate[]): MergedFields
  export interface MergeReport { scanned: number; groups: number; merged: number; renormalised: number; dryRun: boolean }
  export function mergeDuplicateCustomers(opts?: { dryRun?: boolean; log?: (line: string) => void }): Promise<MergeReport>
  ```
- Consumes: `normaliseEmail`, `normalisePhone` (Task 1).
- Re-points these customer foreign keys: `Enquiry`, `Booking`, `MessageLog`, `Review`, `CustomerPasswordToken`, `EnquiryMessage`, `CustomerIdentity`. (The spec also lists `Session`; this schema's `Session` hangs off `Booking`, not `Customer`, so it moves with the booking and needs no re-point.)

- [ ] **Step 1: Write the failing planner tests**

`packages/core/src/services/customer-merge.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  contactKeys,
  mergeDuplicateCustomers,
  mergedFields,
  planCustomerMerges,
  type MergeCandidate,
} from "./customer-merge";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const at = (iso: string) => new Date(iso);

function row(over: Partial<MergeCandidate> & { id: string }): MergeCandidate {
  return {
    createdAt: at("2026-01-01T00:00:00Z"),
    name: "Someone",
    email: null,
    phone: null,
    notes: null,
    tags: [],
    marketingConsent: false,
    loyaltyStamps: 0,
    loyaltyTier: 0,
    ...over,
  };
}

describe("contactKeys", () => {
  it("keys on normalised values", () => {
    const { keys, normalised } = contactKeys({
      email: " Amy@Example.COM ",
      phone: "07700 900123",
    });
    expect(normalised).toEqual({
      email: "amy@example.com",
      phone: "+447700900123",
    });
    expect(keys).toEqual(["email:amy@example.com", "phone:+447700900123"]);
  });

  it("falls back to a raw key for an unparseable phone so it still de-dupes", () => {
    const { keys, normalised } = contactKeys({ email: null, phone: " 12 345 " });
    expect(normalised.phone).toBeNull();
    expect(keys).toEqual(["phone-raw:12345"]);
  });

  it("has no keys when there is nothing to match on", () => {
    expect(contactKeys({ email: "nonsense", phone: "  " }).keys).toEqual([]);
  });
});

describe("planCustomerMerges", () => {
  it("keeps the oldest record per duplicate email", () => {
    const groups = planCustomerMerges([
      row({ id: "b", createdAt: at("2026-02-01T00:00:00Z"), email: "AMY@x.com" }),
      row({ id: "a", createdAt: at("2026-01-01T00:00:00Z"), email: "amy@x.com" }),
      row({ id: "c", createdAt: at("2026-03-01T00:00:00Z"), email: " amy@X.com " }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("a");
    expect(groups[0].mergeIds.sort()).toEqual(["b", "c"]);
  });

  it("chains transitively: A~B by phone, B~C by email", () => {
    const groups = planCustomerMerges([
      row({ id: "a", createdAt: at("2026-01-01T00:00:00Z"), phone: "07700 900123" }),
      row({
        id: "b",
        createdAt: at("2026-02-01T00:00:00Z"),
        phone: "+447700900123",
        email: "shared@x.com",
      }),
      row({ id: "c", createdAt: at("2026-03-01T00:00:00Z"), email: "SHARED@x.com" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("a");
    expect(groups[0].mergeIds.sort()).toEqual(["b", "c"]);
  });

  it("leaves singletons and contact-less rows alone, and is deterministic on ties", () => {
    expect(
      planCustomerMerges([
        row({ id: "a", email: "one@x.com" }),
        row({ id: "b", email: "two@x.com" }),
        row({ id: "c" }),
        row({ id: "d" }),
      ]),
    ).toEqual([]);
    const tied = planCustomerMerges([
      row({ id: "zz", email: "t@x.com" }),
      row({ id: "aa", email: "t@x.com" }),
    ]);
    expect(tied[0].keepId).toBe("aa"); // same createdAt → lowest id wins
  });
});

describe("mergedFields", () => {
  it("sums stamps, maxes tier, unions tags, ORs consent and keeps the survivor's contacts", () => {
    const keep = row({
      id: "a",
      name: "Amy",
      email: "AMY@x.com",
      phone: "07700 900123",
      notes: "Allergic to red",
      tags: ["vip"],
      loyaltyStamps: 3,
      loyaltyTier: 1,
    });
    const dupes = [
      row({
        id: "b",
        name: "Amy Jones",
        email: "amy.j@x.com",
        phone: null,
        notes: "Prefers mornings",
        tags: ["vip", "walk-in"],
        marketingConsent: true,
        loyaltyStamps: 4,
        loyaltyTier: 2,
      }),
    ];
    const out = mergedFields(keep, dupes);
    expect(out.email).toBe("amy@x.com");
    expect(out.phone).toBe("+447700900123");
    expect(out.loyaltyStamps).toBe(7);
    expect(out.loyaltyTier).toBe(2);
    expect(out.tags).toEqual(["vip", "walk-in"]);
    expect(out.marketingConsent).toBe(true);
    expect(out.notes).toContain("Allergic to red");
    expect(out.notes).toContain("Prefers mornings");
    // Contact details only the duplicate held are preserved in the notes.
    expect(out.notes).toContain("amy.j@x.com");
  });

  it("keeps a survivor name and drops empty note fragments", () => {
    const out = mergedFields(row({ id: "a", name: "Amy" }), [
      row({ id: "b", name: "Amy" }),
    ]);
    expect(out.name).toBe("Amy");
    expect(out.notes).toBeNull();
  });
});

describe("mergeDuplicateCustomers (DB)", () => {
  const db = () => testDb();
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("dry run reports without writing; the real run merges and is idempotent", async () => {
    if (!(await dbReachable())) return;
    const local = uid("merge");
    const older = await db().customer.create({
      data: {
        name: "Older",
        email: `${local}@example.com`,
        loyaltyStamps: 2,
        tags: ["vip"],
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const newer = await db().customer.create({
      data: {
        name: "Newer",
        email: `${local.toUpperCase()}@EXAMPLE.com`,
        loyaltyStamps: 3,
        marketingConsent: true,
        tags: ["walk-in"],
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    });
    customers.push(older.id, newer.id);
    const enquiry = await db().enquiry.create({
      data: { contactName: "Newer", customerId: newer.id },
    });
    enquiries.push(enquiry.id);

    const dry = await mergeDuplicateCustomers({ dryRun: true, log: () => {} });
    expect(dry.dryRun).toBe(true);
    expect(dry.groups).toBeGreaterThanOrEqual(1);
    expect(await db().customer.findUnique({ where: { id: newer.id } })).not.toBeNull();

    const run = await mergeDuplicateCustomers({ log: () => {} });
    expect(run.merged).toBeGreaterThanOrEqual(1);
    expect(await db().customer.findUnique({ where: { id: newer.id } })).toBeNull();
    const survivor = await db().customer.findUniqueOrThrow({
      where: { id: older.id },
    });
    expect(survivor.email).toBe(`${local}@example.com`);
    expect(survivor.loyaltyStamps).toBe(5);
    expect(survivor.marketingConsent).toBe(true);
    expect(survivor.tags.sort()).toEqual(["vip", "walk-in"]);
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } }))
        .customerId,
    ).toBe(older.id);

    // Idempotent: a second run finds nothing left to merge for this pair.
    const again = await mergeDuplicateCustomers({ log: () => {} });
    expect(
      await db().customer.findUnique({ where: { id: newer.id } }),
    ).toBeNull();
    expect(again.scanned).toBeGreaterThan(0);
  });

  it("re-normalises contact details on rows that have no duplicate", async () => {
    if (!(await dbReachable())) return;
    const local = uid("solo");
    const solo = await db().customer.create({
      data: { name: "Solo", email: `${local}@EXAMPLE.com`, phone: "07700 900125" },
    });
    customers.push(solo.id);
    await mergeDuplicateCustomers({ log: () => {} });
    const after = await db().customer.findUniqueOrThrow({ where: { id: solo.id } });
    expect(after.email).toBe(`${local}@example.com`);
    expect(after.phone).toBe("+447700900125");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/customer-merge.test.ts`
Expected: FAIL — cannot find module `./customer-merge`.

- [ ] **Step 3: Implement the service**

`packages/core/src/services/customer-merge.ts`:

```ts
import { prisma } from "@bnb/core/db";
import { normaliseEmail, normalisePhone } from "./contact-identity";

/**
 * One-off (but idempotent) consolidation of duplicate customer records, run by
 * `scripts/merge-duplicate-customers.ts` BEFORE the migration that makes
 * `Customer.email` / `Customer.phone` unique.
 *
 * Duplicates are found by normalised email or phone and chained transitively
 * (A~B by phone, B~C by email → one group), because merging only pairwise
 * would leave a second duplicate behind and the unique index would still fail.
 * The oldest record survives; everything else is re-pointed at it and deleted.
 */

export interface MergeCandidate {
  id: string;
  createdAt: Date;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  loyaltyStamps: number;
  loyaltyTier: number;
}

export interface NormalisedContact {
  email: string | null;
  phone: string | null;
}

/**
 * Match keys for one row. An unparseable phone still gets a `phone-raw:` key
 * so obvious duplicates ("12 345" twice) collapse even though the value can
 * never reach E.164.
 */
export function contactKeys(row: { email: string | null; phone: string | null }): {
  keys: string[];
  normalised: NormalisedContact;
} {
  const email = normaliseEmail(row.email);
  const phone = normalisePhone(row.phone);
  const keys: string[] = [];
  if (email) keys.push(`email:${email}`);
  if (phone) keys.push(`phone:${phone}`);
  else {
    const raw = row.phone?.replace(/\s+/g, "") ?? "";
    if (raw) keys.push(`phone-raw:${raw}`);
  }
  return { keys, normalised: { email, phone } };
}

export interface MergeGroup {
  keepId: string;
  mergeIds: string[];
  keys: string[];
}

/** Oldest first, then lowest id — deterministic survivor choice. */
function olderFirst(a: MergeCandidate, b: MergeCandidate): number {
  const d = a.createdAt.getTime() - b.createdAt.getTime();
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

/** Union-find over contact keys so chained duplicates end in one group. */
export function planCustomerMerges(rows: MergeCandidate[]): MergeGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== undefined && parent.get(r) !== r) {
      r = parent.get(r) as string;
    }
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const keysById = new Map<string, string[]>();
  const ownerByKey = new Map<string, string>();
  for (const row of rows) {
    parent.set(row.id, parent.get(row.id) ?? row.id);
    const { keys } = contactKeys(row);
    keysById.set(row.id, keys);
    for (const key of keys) {
      const owner = ownerByKey.get(key);
      if (owner) union(owner, row.id);
      else ownerByKey.set(key, row.id);
    }
  }

  const byRoot = new Map<string, MergeCandidate[]>();
  for (const row of rows) {
    if ((keysById.get(row.id) ?? []).length === 0) continue;
    const root = find(row.id);
    const list = byRoot.get(root) ?? [];
    list.push(row);
    byRoot.set(root, list);
  }

  const groups: MergeGroup[] = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(olderFirst);
    const [keep, ...dupes] = sorted;
    const keys = new Set<string>();
    for (const m of sorted) for (const k of keysById.get(m.id) ?? []) keys.add(k);
    groups.push({
      keepId: keep.id,
      mergeIds: dupes.map((d) => d.id),
      keys: [...keys].sort(),
    });
  }
  return groups.sort((a, b) => a.keepId.localeCompare(b.keepId));
}

export interface MergedFields {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  loyaltyStamps: number;
  loyaltyTier: number;
}

/**
 * Survivor's field values after absorbing its duplicates: stamps summed, tier
 * maxed, tags unioned, consent OR-ed, notes concatenated. Contact details only
 * a duplicate held cannot go in the (now unique) columns, so they are recorded
 * in the notes rather than dropped.
 */
export function mergedFields(
  keep: MergeCandidate,
  dupes: MergeCandidate[],
): MergedFields {
  const kept = contactKeys(keep).normalised;
  const tags = new Set(keep.tags);
  const noteParts: string[] = [];
  if (keep.notes?.trim()) noteParts.push(keep.notes.trim());

  let stamps = keep.loyaltyStamps;
  let tier = keep.loyaltyTier;
  let consent = keep.marketingConsent;

  for (const d of dupes) {
    for (const t of d.tags) tags.add(t);
    stamps += d.loyaltyStamps;
    tier = Math.max(tier, d.loyaltyTier);
    consent = consent || d.marketingConsent;
    const dn = contactKeys(d).normalised;
    const extras: string[] = [];
    if (dn.email && dn.email !== kept.email) extras.push(dn.email);
    if (dn.phone && dn.phone !== kept.phone) extras.push(dn.phone);
    const body = d.notes?.trim();
    const bits: string[] = [];
    if (body) bits.push(body);
    if (extras.length) bits.push(`also known as ${extras.join(", ")}`);
    if (bits.length) noteParts.push(`[merged ${d.name}] ${bits.join(" — ")}`);
  }

  return {
    name: keep.name,
    email: kept.email,
    phone: kept.phone,
    notes: noteParts.length ? noteParts.join("\n") : null,
    tags: [...tags],
    marketingConsent: consent,
    loyaltyStamps: stamps,
    loyaltyTier: tier,
  };
}

export interface MergeReport {
  scanned: number;
  groups: number;
  merged: number;
  renormalised: number;
  dryRun: boolean;
}

const SELECT = {
  id: true,
  createdAt: true,
  name: true,
  email: true,
  phone: true,
  notes: true,
  tags: true,
  marketingConsent: true,
  loyaltyStamps: true,
  loyaltyTier: true,
} as const;

/**
 * Merge every duplicate group, then re-normalise the contact details of every
 * remaining row. Each group is one transaction, so a failure mid-run leaves
 * the earlier groups merged and the rest untouched — safe to re-run.
 */
export async function mergeDuplicateCustomers(
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<MergeReport> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? ((line: string) => console.log(line));

  const rows = await prisma.customer.findMany({
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  const groups = planCustomerMerges(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  log(`Scanned ${rows.length} customers — ${groups.length} duplicate group(s).`);

  let merged = 0;
  for (const group of groups) {
    const keep = byId.get(group.keepId);
    const dupes = group.mergeIds
      .map((id) => byId.get(id))
      .filter((r): r is MergeCandidate => Boolean(r));
    if (!keep || dupes.length === 0) continue;
    const fields = mergedFields(keep, dupes);
    log(
      `${dryRun ? "[dry-run] " : ""}keep ${keep.id} (${keep.name}) ← ${dupes
        .map((d) => `${d.id} (${d.name})`)
        .join(", ")} [${group.keys.join(", ")}]`,
    );
    if (dryRun) {
      merged += dupes.length;
      continue;
    }
    const ids = dupes.map((d) => d.id);
    await prisma.$transaction([
      prisma.enquiry.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.booking.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.messageLog.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.enquiryMessage.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.review.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.customerPasswordToken.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.customerIdentity.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.customer.update({ where: { id: keep.id }, data: fields }),
      prisma.customer.deleteMany({ where: { id: { in: ids } } }),
    ]);
    merged += dupes.length;
  }

  // Anything left with an un-normalised email/phone would still break the
  // unique index comparison later — fix it now.
  let renormalised = 0;
  const remaining = dryRun
    ? rows.filter((r) => !groups.some((g) => g.mergeIds.includes(r.id)))
    : await prisma.customer.findMany({ select: SELECT });
  for (const row of remaining) {
    const { normalised } = contactKeys(row);
    const emailChanged = (row.email ?? null) !== normalised.email;
    const phoneChanged =
      normalised.phone !== null && row.phone !== normalised.phone;
    if (!emailChanged && !phoneChanged) continue;
    renormalised += 1;
    if (dryRun) continue;
    await prisma.customer.update({
      where: { id: row.id },
      data: {
        ...(emailChanged ? { email: normalised.email } : {}),
        ...(phoneChanged ? { phone: normalised.phone } : {}),
      },
    });
  }
  log(
    `${dryRun ? "[dry-run] " : ""}Merged ${merged} duplicate row(s); re-normalised ${renormalised} row(s).`,
  );

  return { scanned: rows.length, groups: groups.length, merged, renormalised, dryRun };
}
```

Add `export * from "./customer-merge";` to `packages/core/src/services/index.ts`.

> Note on the survivor's contacts: a group merged by phone may hold two different emails. The survivor keeps the oldest record's email (`mergedFields`), and the other address is written into the notes rather than silently lost.

- [ ] **Step 4: The CLI script**

`scripts/merge-duplicate-customers.ts` (same `@bnb/core/db` import style as `scripts/admin-link.ts`):

```ts
/**
 * Collapse duplicate customer records before the unique email/phone indexes
 * land (Phase 1 of the enquiries omnichannel work).
 *
 * Usage:
 *   npm run customers:merge -- --dry-run    # report only, writes nothing
 *   npm run customers:merge                 # merge for real
 *
 * Idempotent: a second run finds no groups and re-normalises nothing. Run it
 * AFTER the enquiry_threads migration and BEFORE customer_contact_unique.
 */
import { prisma } from "@bnb/core/db";
import { mergeDuplicateCustomers } from "@bnb/core/services/customer-merge";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("Dry run — no changes will be written.\n");
  const report = await mergeDuplicateCustomers({ dryRun });
  console.log(
    `\nDone. scanned=${report.scanned} groups=${report.groups} merged=${report.merged} renormalised=${report.renormalised}${
      report.dryRun ? " (dry run)" : ""
    }`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

Add to root `package.json` `scripts`, after `"admin:link"`:
```json
    "customers:merge": "tsx --env-file=.env scripts/merge-duplicate-customers.ts"
```

- [ ] **Step 5: Run the tests, then run the script for real**

```bash
npm test -w @bnb/core -- src/services/customer-merge.test.ts
npm run customers:merge -- --dry-run
npm run customers:merge
npm run customers:merge -- --dry-run
```
Expected: tests PASS; the first dry run lists any groups; the real run merges them; the second dry run prints `0 duplicate group(s)` and `re-normalised 0 row(s)` — proving idempotency and that Task 5's unique indexes will apply cleanly.

Belt and braces before moving on:
```bash
set -a && . ./.env && set +a && psql "$DATABASE_URL" -c "SELECT lower(email) AS e, count(*) FROM \"Customer\" WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1; SELECT phone, count(*) FROM \"Customer\" WHERE phone IS NOT NULL GROUP BY 1 HAVING count(*) > 1;"
```
Expected: both queries return zero rows. (If `psql` is unavailable, run the same two queries through `npx prisma studio` or a `tsx -e` one-liner.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/customer-merge.ts packages/core/src/services/customer-merge.test.ts packages/core/src/services/index.ts scripts/merge-duplicate-customers.ts package.json
git commit -m "feat(core): idempotent duplicate-customer merge (planner, service, --dry-run CLI)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 5: Migration B — unique `Customer.email` / `Customer.phone`

**Prerequisite:** Task 4's script has been run for real and both duplicate-check queries return zero rows. Do not start otherwise — the migration will fail.

**Files:**
- Modify: `packages/core/prisma/schema.prisma`, `packages/core/src/services/customers.ts`, `packages/core/src/services/customer-welcome.ts`, `packages/core/src/services/contact-identity.test.ts`
- Create: `packages/core/prisma/migrations/20260907140000_customer_contact_unique/migration.sql`

**Interfaces:**
- Produces:
  ```ts
  export class DuplicateContactError extends Error {}   // services/contact-identity.ts
  ```
- Changes: `createCustomer` and `updateCustomer` (services/customers.ts) normalise `email`/`phone` and translate P2002 into `DuplicateContactError`; `createCustomerWithWelcome` does the same. `Customer.email` / `Customer.phone` become unique (their plain `@@index` entries are replaced).

- [ ] **Step 1: Append the failing uniqueness tests**

Append to `packages/core/src/services/contact-identity.test.ts`, inside the existing `describe("findOrCreateCustomer + linkIdentity (DB)")` block:

```ts
  it("the database refuses a second customer with the same email or phone", async () => {
    if (!(await dbReachable())) return;
    const local = uid("uniq");
    const first = track(
      await findOrCreateCustomer({
        name: "Uniq",
        email: `${local}@example.com`,
        phone: "07700 900126",
      }),
    );
    await expect(
      db().customer.create({
        data: { name: "Copy", email: `${local}@example.com` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db().customer.create({ data: { name: "Copy", phone: "+447700900126" } }),
    ).rejects.toMatchObject({ code: "P2002" });
    // Many contact-less customers are fine — Postgres treats NULLs as distinct.
    const a = track(await db().customer.create({ data: { name: `Blank ${uid()}` } }));
    const b = track(await db().customer.create({ data: { name: `Blank ${uid()}` } }));
    expect(a.id).not.toBe(b.id);
    expect(first.email).toBe(`${local}@example.com`);
  });
```

And a new top-level block in the same file:

```ts
describe("duplicate-contact guards (DB)", () => {
  const db = () => testDb();
  const made: string[] = [];

  afterAll(async () => {
    if ((await dbReachable()) && made.length) {
      await db().customer.deleteMany({ where: { id: { in: made } } });
    }
    await closeTestDb();
  });

  it("createCustomer normalises and reports a duplicate readably", async () => {
    if (!(await dbReachable())) return;
    const { createCustomer } = await import("./customers");
    const { DuplicateContactError } = await import("./contact-identity");
    const local = uid("guard");
    const c = await createCustomer({
      name: "Guard",
      email: `  ${local}@EXAMPLE.com `,
      phone: "07700 900127",
    });
    made.push(c.id);
    expect(c.email).toBe(`${local}@example.com`);
    expect(c.phone).toBe("+447700900127");
    await expect(
      createCustomer({ name: "Guard 2", email: `${local}@example.com` }),
    ).rejects.toBeInstanceOf(DuplicateContactError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/contact-identity.test.ts`
Expected: FAIL — the duplicate `customer.create` calls resolve instead of rejecting (`promise resolved instead of rejecting`), and `DuplicateContactError` is not exported.

- [ ] **Step 3: Schema + migration**

In `packages/core/prisma/schema.prisma`, inside `model Customer`:
```prisma
  email             String?  @unique
  phone             String?  @unique
```
and delete the now-redundant index lines from that model:
```prisma
  @@index([email])
  @@index([phone])
```

Generate:
```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate -- --name customer_contact_unique
```

Fallback — `packages/core/prisma/migrations/20260907140000_customer_contact_unique/migration.sql`:
```sql
-- DropIndex
DROP INDEX "Customer_email_idx";

-- DropIndex
DROP INDEX "Customer_phone_idx";

-- CreateIndex
-- Postgres treats NULLs as distinct, so any number of contact-less customers
-- coexist; only real duplicate values are rejected. scripts/merge-duplicate-
-- customers.ts must have been run first or this statement fails.
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
```
Apply with `npm -w @bnb/core run db:migrate`, then `npm run db:generate`.

If the migration errors with `could not create unique index`, it means duplicates remain: re-run `npm run customers:merge`, then `npm -w @bnb/core run db:migrate` again.

- [ ] **Step 4: Guard the remaining write paths**

Add to `packages/core/src/services/contact-identity.ts` (after `isUniqueViolation`):

```ts
/** A write hit the unique email/phone index — surfaced with a readable message. */
export class DuplicateContactError extends Error {
  constructor(message = "A customer with that email or phone already exists.") {
    super(message);
    this.name = "DuplicateContactError";
  }
}
```

In `packages/core/src/services/customers.ts`, extend the import and rewrite the two writers:

```ts
import {
  DuplicateContactError,
  findOrCreateCustomer,
  isUniqueViolation,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";
```

```ts
/**
 * Create a customer with normalised contact details. Email and phone are
 * unique at the database, so a clash raises DuplicateContactError rather than
 * a raw P2002 — callers surface `err.message` to staff.
 */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  try {
    return await prisma.customer.create({
      data: {
        name: input.name,
        email: normaliseEmail(input.email),
        phone: normalisePhone(input.phone),
        notes: input.notes ?? null,
        marketingConsent: input.marketingConsent ?? false,
        tags: input.tags ?? [],
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateContactError();
    throw err;
  }
}
```

```ts
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const data: Prisma.CustomerUpdateInput = { ...input };
  if ("email" in input) data.email = normaliseEmail(input.email);
  if ("phone" in input) data.phone = normalisePhone(input.phone);
  try {
    return await prisma.customer.update({ where: { id }, data });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateContactError();
    throw err;
  }
}
```

In `packages/core/src/services/customer-welcome.ts`, add the import and wrap the create in `createCustomerWithWelcome`:

```ts
import {
  DuplicateContactError,
  isUniqueViolation,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";
```
```ts
  let customer: Customer;
  try {
    customer = await prisma.customer.create({
      data: {
        name: input.name,
        email: normaliseEmail(input.email),
        phone: normalisePhone(input.phone),
        dob: input.dob ?? null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateContactError(
        "A customer with that email or phone already exists — search for them instead.",
      );
    }
    throw err;
  }
```
(`saveBookingAction` in `apps/admin/src/app/(staff)/calendar/actions.ts` already catches and returns `err.message`, so this surfaces as a toast with no further change; its existing "does not create the booking when customer creation fails" test still passes.)

- [ ] **Step 5: Run tests, commit**

```bash
npm test -w @bnb/core
npm test -w @bnb/admin
```
Expected: both PASS. If `customer-welcome.test.ts` or `reception.test.ts` reuse a fixed email across cases, give each case a `uid()`-suffixed address — duplicates are now rejected.

```bash
git add packages/core/prisma/schema.prisma packages/core/prisma/migrations packages/core/src/services/contact-identity.ts packages/core/src/services/contact-identity.test.ts packages/core/src/services/customers.ts packages/core/src/services/customer-welcome.ts
git commit -m "feat(core): unique customer email + phone with normalising write guards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 6: `enquiry-threading.ts` — the 30-day threading rule

**Files:**
- Create: `packages/core/src/services/enquiry-threading.ts`, `packages/core/src/services/enquiry-threading.test.ts`
- Modify: `packages/core/src/services/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export const THREAD_WINDOW_DAYS = 30;
  export const THREADABLE_STATUSES: readonly EnquiryStatus[] = ["new", "replied", "customer_replied"];
  export function isThreadable(status: EnquiryStatus): boolean
  export interface ThreadCandidate { id: string; status: EnquiryStatus; lastMessageAt: Date | null; createdAt: Date }
  export function activityAt(candidate: ThreadCandidate): Date
  export interface ChooseThreadInput { tokenMatch?: ThreadCandidate | null; candidates: ThreadCandidate[]; now?: Date }
  export type ThreadChoice = { kind: "existing"; enquiryId: string } | { kind: "new" };
  export function chooseThread(input: ChooseThreadInput): ThreadChoice
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
  export interface ResolvedThread { enquiryId: string; created: boolean }
  export function resolveThread(input: ResolveThreadInput): Promise<ResolvedThread>
  export function sourceForChannel(channel: EnquiryChannel): EnquirySource
  ```
- Consumes: `Enquiry.threadToken`, `lastMessageAt`, `customer_replied` (Task 2).

- [ ] **Step 1: Write the failing tests**

`packages/core/src/services/enquiry-threading.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  activityAt,
  chooseThread,
  isThreadable,
  resolveThread,
  sourceForChannel,
  type ThreadCandidate,
} from "./enquiry-threading";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const NOW = new Date("2026-09-07T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600_000);

function cand(over: Partial<ThreadCandidate> & { id: string }): ThreadCandidate {
  return {
    status: "replied",
    lastMessageAt: daysAgo(1),
    createdAt: daysAgo(10),
    ...over,
  };
}

describe("threading primitives", () => {
  it("treats new / replied / customer_replied as threadable, never closed or converted", () => {
    expect(isThreadable("new")).toBe(true);
    expect(isThreadable("replied")).toBe(true);
    expect(isThreadable("customer_replied")).toBe(true);
    expect(isThreadable("converted")).toBe(false);
    expect(isThreadable("closed")).toBe(false);
  });

  it("falls back to createdAt when there is no lastMessageAt", () => {
    expect(activityAt(cand({ id: "a", lastMessageAt: null })).toISOString()).toBe(
      daysAgo(10).toISOString(),
    );
    expect(activityAt(cand({ id: "a" })).toISOString()).toBe(
      daysAgo(1).toISOString(),
    );
  });

  it("maps a channel to the legacy source column", () => {
    expect(sourceForChannel("flash")).toBe("flash");
    expect(sourceForChannel("inkling")).toBe("inkling");
    expect(sourceForChannel("web")).toBe("web");
    expect(sourceForChannel("email")).toBe("web");
    expect(sourceForChannel("messenger")).toBe("web");
  });
});

describe("chooseThread", () => {
  it("uses the token match first, ignoring the 30-day window", () => {
    const res = chooseThread({
      tokenMatch: cand({ id: "tok", lastMessageAt: daysAgo(200) }),
      candidates: [cand({ id: "recent", lastMessageAt: daysAgo(1) })],
      now: NOW,
    });
    expect(res).toEqual({ kind: "existing", enquiryId: "tok" });
  });

  it("ignores a token match on a closed or converted enquiry", () => {
    for (const status of ["closed", "converted"] as const) {
      expect(
        chooseThread({
          tokenMatch: cand({ id: "tok", status }),
          candidates: [],
          now: NOW,
        }),
      ).toEqual({ kind: "new" });
    }
  });

  it("falls back to the most recently active threadable enquiry inside 30 days", () => {
    const res = chooseThread({
      candidates: [
        cand({ id: "old", lastMessageAt: daysAgo(20) }),
        cand({ id: "newest", lastMessageAt: daysAgo(2), status: "new" }),
        cand({ id: "mid", lastMessageAt: daysAgo(5), status: "customer_replied" }),
      ],
      now: NOW,
    });
    expect(res).toEqual({ kind: "existing", enquiryId: "newest" });
  });

  it("skips closed / converted candidates entirely", () => {
    expect(
      chooseThread({
        candidates: [
          cand({ id: "closed", status: "closed", lastMessageAt: daysAgo(1) }),
          cand({ id: "converted", status: "converted", lastMessageAt: daysAgo(1) }),
        ],
        now: NOW,
      }),
    ).toEqual({ kind: "new" });
  });

  it("starts a new enquiry past the 30-day window (boundary inclusive)", () => {
    expect(
      chooseThread({
        candidates: [cand({ id: "stale", lastMessageAt: daysAgo(31) })],
        now: NOW,
      }),
    ).toEqual({ kind: "new" });
    expect(
      chooseThread({
        candidates: [cand({ id: "edge", lastMessageAt: daysAgo(30) })],
        now: NOW,
      }),
    ).toEqual({ kind: "existing", enquiryId: "edge" });
  });

  it("starts a new enquiry when there is nothing to attach to", () => {
    expect(chooseThread({ candidates: [], now: NOW })).toEqual({ kind: "new" });
  });
});

describe("resolveThread (DB)", () => {
  const db = () => testDb();
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  async function customer() {
    const c = await db().customer.create({ data: { name: `Thread ${uid()}` } });
    customers.push(c.id);
    return c;
  }

  it("attaches to the customer's recent open enquiry", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const open = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "replied",
        lastMessageAt: daysAgo(3),
      },
    });
    enquiries.push(open.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "email",
      contactName: "Amy",
      now: NOW,
    });
    expect(res).toEqual({ enquiryId: open.id, created: false });
  });

  it("follows the reply token even when the thread is old", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const old = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "replied",
        lastMessageAt: daysAgo(120),
      },
    });
    enquiries.push(old.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "email",
      threadToken: old.threadToken,
      contactName: "Amy",
      now: NOW,
    });
    expect(res).toEqual({ enquiryId: old.id, created: false });
  });

  it("creates a new enquiry beside a closed one, never reopening it", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const closed = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "closed",
        lastMessageAt: daysAgo(1),
      },
    });
    enquiries.push(closed.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "messenger",
      threadToken: closed.threadToken,
      contactName: "Amy Jones",
      subject: "One more thing",
      now: NOW,
    });
    expect(res.created).toBe(true);
    expect(res.enquiryId).not.toBe(closed.id);
    enquiries.push(res.enquiryId);
    const made = await db().enquiry.findUniqueOrThrow({
      where: { id: res.enquiryId },
    });
    expect(made.channel).toBe("messenger");
    expect(made.source).toBe("web");
    expect(made.status).toBe("new");
    expect(made.contactName).toBe("Amy Jones");
    expect(made.subject).toBe("One more thing");
    expect(made.customerId).toBe(c.id);
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: closed.id } })).status,
    ).toBe("closed");
  });

  it("never crosses customers", async () => {
    if (!(await dbReachable())) return;
    const mine = await customer();
    const theirs = await customer();
    const other = await db().enquiry.create({
      data: {
        contactName: "Other",
        customerId: theirs.id,
        status: "new",
        lastMessageAt: daysAgo(1),
      },
    });
    enquiries.push(other.id);
    const res = await resolveThread({
      customerId: mine.id,
      channel: "web",
      contactName: "Mine",
      now: NOW,
    });
    expect(res.created).toBe(true);
    enquiries.push(res.enquiryId);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/enquiry-threading.test.ts`
Expected: FAIL — cannot find module `./enquiry-threading`.

- [ ] **Step 3: Implement**

`packages/core/src/services/enquiry-threading.ts`:

```ts
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
```

Add `export * from "./enquiry-threading";` to `packages/core/src/services/index.ts`.

- [ ] **Step 4: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/enquiry-threading.test.ts` — PASS. Then `npm test -w @bnb/core` — PASS.

```bash
git add packages/core/src/services/enquiry-threading.ts packages/core/src/services/enquiry-threading.test.ts packages/core/src/services/index.ts
git commit -m "feat(core): enquiry threading rule — reply token, 30-day window, never reopen closed threads

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 7: `assets.ts` + staff-gated `GET /api/attachments/[id]`

**Files:**
- Create: `packages/core/src/services/assets.ts`, `packages/core/src/services/assets.test.ts`
- Create: `apps/admin/src/app/api/attachments/[id]/route.ts`, `apps/admin/src/app/api/attachments/[id]/route.test.ts`
- Modify: `packages/core/src/services/index.ts`

**Interfaces:**
- Produces:
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
  export interface AttachmentMeta { id: string; mime: string; size: number; filename: string | null; url: string | null; hasBytes: boolean }
  export function storeAttachment(input: StoreAttachmentInput): Promise<AttachmentMeta>
  export function getAttachment(id: string): Promise<(AttachmentMeta & { bytes: Uint8Array | null }) | null>
  export function listAttachmentsFor(messageIds: string[]): Promise<Map<string, AttachmentMeta[]>>
  ```
- Consumes: `Attachment` model (Task 2).
- HTTP: `GET /api/attachments/[id]` (admin origin) → bytes with `content-type`, `content-disposition: inline`, immutable cache; 404 when unknown or bytes-less; redirects to `/sign-in` for anonymous callers via `requireRole()`.

- [ ] **Step 1: Write the failing service test**

`packages/core/src/services/assets.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  getAttachment,
  isInlineableAttachment,
  listAttachmentsFor,
  MAX_INLINE_ATTACHMENT_BYTES,
  storeAttachment,
} from "./assets";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe("isInlineableAttachment", () => {
  it("accepts images within the cap and rejects everything else", () => {
    expect(isInlineableAttachment("image/png", 1024)).toBe(true);
    expect(isInlineableAttachment("image/jpeg", MAX_INLINE_ATTACHMENT_BYTES)).toBe(true);
    expect(isInlineableAttachment("image/png", MAX_INLINE_ATTACHMENT_BYTES + 1)).toBe(false);
    expect(isInlineableAttachment("application/pdf", 10)).toBe(false);
    expect(isInlineableAttachment("image/svg+xml", 10)).toBe(false);
  });
});

describe("attachments (DB)", () => {
  const db = () => testDb();
  const ids: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (ids.length) await db().attachment.deleteMany({ where: { id: { in: ids } } });
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    }
    await closeTestDb();
  });

  it("stores image bytes inline and reads them back", async () => {
    if (!(await dbReachable())) return;
    const meta = await storeAttachment({
      mime: "image/png",
      filename: "ref.png",
      bytes: PNG,
    });
    ids.push(meta.id);
    expect(meta).toMatchObject({
      mime: "image/png",
      size: PNG.length,
      filename: "ref.png",
      url: null,
      hasBytes: true,
    });
    const got = await getAttachment(meta.id);
    expect(Array.from(got!.bytes!)).toEqual(Array.from(PNG));
    expect(await getAttachment("nope")).toBeNull();
  });

  it("keeps a link only for non-images and oversize files", async () => {
    if (!(await dbReachable())) return;
    const pdf = await storeAttachment({
      mime: "application/pdf",
      filename: "brief.pdf",
      bytes: PNG,
      url: "https://files.test/brief.pdf",
    });
    ids.push(pdf.id);
    expect(pdf.hasBytes).toBe(false);
    expect(pdf.url).toBe("https://files.test/brief.pdf");
    expect((await getAttachment(pdf.id))!.bytes).toBeNull();

    // Over the inline cap: the size is real, so the bytes are dropped and only
    // the source link survives. Allocated once, freed at the end of the case.
    const huge = await storeAttachment({
      mime: "image/png",
      filename: "huge.png",
      bytes: new Uint8Array(MAX_INLINE_ATTACHMENT_BYTES + 1),
      url: "https://files.test/huge.png",
    });
    ids.push(huge.id);
    expect(huge.hasBytes).toBe(false);
    expect(huge.size).toBe(MAX_INLINE_ATTACHMENT_BYTES + 1);
    expect(huge.url).toBe("https://files.test/huge.png");
  });

  it("stores a link-only attachment with no bytes at all", async () => {
    if (!(await dbReachable())) return;
    const link = await storeAttachment({
      mime: "application/zip",
      url: "https://files.test/pack.zip",
    });
    ids.push(link.id);
    expect(link.size).toBe(0);
    expect(link.hasBytes).toBe(false);
  });

  it("groups attachments by message id", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Att ${uid()}` },
    });
    enquiries.push(enquiry.id);
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "email",
        bodyText: "see attached",
      },
    });
    const a = await storeAttachment({ mime: "image/png", bytes: PNG, messageId: message.id });
    const b = await storeAttachment({ mime: "image/png", bytes: PNG, messageId: message.id });
    ids.push(a.id, b.id);
    const map = await listAttachmentsFor([message.id, "missing"]);
    expect(map.get(message.id)?.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    expect(map.get("missing")).toBeUndefined();
    expect(await listAttachmentsFor([])).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/assets.test.ts`
Expected: FAIL — cannot find module `./assets`.

- [ ] **Step 3: Implement the service**

`packages/core/src/services/assets.ts`:

```ts
import { prisma } from "@bnb/core/db";

/**
 * Generalised message-attachment store, following MoodboardAsset's reasoning:
 * container disks are ephemeral and the apps are separate services, so small
 * images live in Postgres as bytea. Anything non-image or over the cap keeps
 * a source link instead — the inbox renders it as a download link rather than
 * pulling megabytes through the database.
 *
 * SVG is never inlined: it is XML and can carry script, and these bytes are
 * served back to signed-in staff.
 */

export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function isInlineableAttachment(mime: string, size: number): boolean {
  return INLINE_MIMES.has(mime) && size <= MAX_INLINE_ATTACHMENT_BYTES;
}

export interface StoreAttachmentInput {
  mime: string;
  filename?: string | null;
  bytes?: Uint8Array | null;
  url?: string | null;
  messageId?: string | null;
}

export interface AttachmentMeta {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  hasBytes: boolean;
}

function toMeta(row: {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  bytes: Uint8Array | null;
}): AttachmentMeta {
  return {
    id: row.id,
    mime: row.mime,
    size: row.size,
    filename: row.filename,
    url: row.url,
    hasBytes: row.bytes !== null,
  };
}

export async function storeAttachment(
  input: StoreAttachmentInput,
): Promise<AttachmentMeta> {
  const size = input.bytes?.byteLength ?? 0;
  const inline = Boolean(input.bytes) && isInlineableAttachment(input.mime, size);
  const row = await prisma.attachment.create({
    data: {
      messageId: input.messageId ?? null,
      mime: input.mime,
      filename: input.filename ?? null,
      size,
      bytes: inline ? Uint8Array.from(input.bytes as Uint8Array) : null,
      url: input.url ?? null,
    },
    select: { id: true, mime: true, size: true, filename: true, url: true, bytes: true },
  });
  return toMeta({ ...row, bytes: row.bytes ? new Uint8Array(row.bytes) : null });
}

export async function getAttachment(
  id: string,
): Promise<(AttachmentMeta & { bytes: Uint8Array | null }) | null> {
  const row = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, filename: true, url: true, bytes: true },
  });
  if (!row) return null;
  const bytes = row.bytes ? new Uint8Array(row.bytes) : null;
  return { ...toMeta({ ...row, bytes }), bytes };
}

/** Attachments for a batch of messages, grouped by message id (inbox render). */
export async function listAttachmentsFor(
  messageIds: string[],
): Promise<Map<string, AttachmentMeta[]>> {
  const map = new Map<string, AttachmentMeta[]>();
  if (messageIds.length === 0) return map;
  const rows = await prisma.attachment.findMany({
    where: { messageId: { in: messageIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mime: true,
      size: true,
      filename: true,
      url: true,
      bytes: true,
      messageId: true,
    },
  });
  for (const row of rows) {
    if (!row.messageId) continue;
    const list = map.get(row.messageId) ?? [];
    list.push(toMeta({ ...row, bytes: row.bytes ? new Uint8Array(row.bytes) : null }));
    map.set(row.messageId, list);
  }
  return map;
}
```

> Performance note: `listAttachmentsFor` selects `bytes` only to derive `hasBytes`. If the inbox ever feels heavy, replace it with a `$queryRaw` selecting `bytes IS NOT NULL`; for a studio-sized inbox the simple form is fine and keeps the code honest.

Add `export * from "./assets";` to `packages/core/src/services/index.ts`.

- [ ] **Step 4: Failing route test**

`apps/admin/src/app/api/attachments/[id]/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
const getAttachment = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/assets", () => ({ getAttachment }));

const { requireRole } = await import("@bnb/core/auth");
const { GET } = await import("./route");

const call = (id: string) =>
  GET(new Request(`http://admin.test/api/attachments/${id}`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    email: "o@x",
    role: "OWNER",
    displayName: "Owner",
  } as never);
});

describe("GET /api/attachments/[id]", () => {
  it("requires a signed-in staff user", async () => {
    getAttachment.mockResolvedValue({
      id: "a1",
      mime: "image/png",
      size: 3,
      filename: null,
      url: null,
      hasBytes: true,
      bytes: new Uint8Array([1, 2, 3]),
    });
    await call("a1");
    expect(requireRole).toHaveBeenCalled();
  });

  it("streams inline bytes with the stored mime and immutable caching", async () => {
    getAttachment.mockResolvedValue({
      id: "a1",
      mime: "image/png",
      size: 3,
      filename: "ref.png",
      url: null,
      hasBytes: true,
      bytes: new Uint8Array([1, 2, 3]),
    });
    const res = await call("a1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toContain("ref.png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("404s for an unknown id and for a link-only attachment", async () => {
    getAttachment.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
    getAttachment.mockResolvedValueOnce({
      id: "a2",
      mime: "application/pdf",
      size: 0,
      filename: "brief.pdf",
      url: "https://files.test/brief.pdf",
      hasBytes: false,
      bytes: null,
    });
    expect((await call("a2")).status).toBe(404);
  });
});
```

Run: `npm test -w @bnb/admin -- src/app/api/attachments` — FAIL (cannot find `./route`).

- [ ] **Step 5: Implement the route**

`apps/admin/src/app/api/attachments/[id]/route.ts`:

```ts
import { requireRole } from "@bnb/core/auth";
import { getAttachment } from "@bnb/core/services/assets";
import { handleApiError, jsonError } from "@bnb/core/http";

/**
 * GET /api/attachments/[id] — serves an inbox attachment's stored bytes to
 * signed-in staff (requireRole redirects anonymous callers to /sign-in). Only
 * inline attachments are served: a link-only row (non-image or oversize) is
 * rendered by the thread as an external link, and this route deliberately
 * does NOT redirect to that URL — a staff-gated open redirect is not worth it.
 */

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole();
    const { id } = await ctx.params;
    const asset = await getAttachment(id);
    if (!asset || !asset.bytes) return jsonError(404, "Not found");
    const filename = (asset.filename ?? `attachment-${asset.id}`).replace(
      /["\\\r\n]/g,
      "",
    );
    return new Response(Uint8Array.from(asset.bytes), {
      status: 200,
      headers: {
        "content-type": asset.mime,
        "content-length": String(asset.size),
        "content-disposition": `inline; filename="${filename}"`,
        // Private: the bytes are only for signed-in staff, never a shared cache.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
```

- [ ] **Step 6: Run tests, commit**

```bash
npm test -w @bnb/core -- src/services/assets.test.ts
npm test -w @bnb/admin -- src/app/api/attachments
```
Expected: both PASS.

```bash
git add packages/core/src/services/assets.ts packages/core/src/services/assets.test.ts packages/core/src/services/index.ts "apps/admin/src/app/api/attachments"
git commit -m "feat(core,admin): attachment store in Postgres + staff-gated /api/attachments/[id]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 8: `enquiry-messages.ts` — record, list, read, unread

**Files:**
- Create: `packages/core/src/services/enquiry-messages.ts`, `packages/core/src/services/enquiry-messages.test.ts`
- Modify: `packages/core/src/services/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface InboxViewer { userId: string; role: "OWNER" | "ARTIST"; artistId: string | null }
  export function visibleEnquiryWhere(viewer: InboxViewer): Prisma.EnquiryWhereInput
  export interface ThreadAttachment { id: string; mime: string; size: number; filename: string | null; url: string | null; hasBytes: boolean }
  export interface ThreadMessageRow {
    id: string; enquiryId: string; direction: MessageDirection; channel: MessageChannelKind;
    authorUserId: string | null; authorName: string | null; fromName: string | null; fromAddress: string | null;
    subject: string | null; bodyText: string; deliveryStatus: MessageStatus; createdAt: Date;
    attachments: ThreadAttachment[];
  }
  export interface RecordMessageInput {
    enquiryId: string; customerId?: string | null; channel: MessageChannelKind;
    bodyText: string; bodyHtml?: string | null; subject?: string | null;
    fromName?: string | null; fromAddress?: string | null; externalId?: string | null;
    deliveryStatus?: MessageStatus; attachments?: StoreAttachmentInput[]; at?: Date;
  }
  export function recordInbound(input: RecordMessageInput): Promise<ThreadMessageRow>
  export function recordOutbound(input: RecordMessageInput & { authorUserId?: string | null }): Promise<ThreadMessageRow>
  export function recordNote(input: { enquiryId: string; authorUserId: string; bodyText: string; at?: Date }): Promise<ThreadMessageRow>
  export function listThread(enquiryId: string): Promise<ThreadMessageRow[]>
  export function listThreadsFor(enquiryIds: string[]): Promise<Map<string, ThreadMessageRow[]>>
  export function markRead(enquiryId: string, userId: string, at?: Date): Promise<void>
  export interface UnreadCounts { total: number; enquiryIds: string[] }
  export function unreadCountsFor(viewer: InboxViewer): Promise<UnreadCounts>
  ```
- Consumes: `storeAttachment`, `StoreAttachmentInput` (Task 7); the thread schema (Task 2).
- Behaviour contract:
  - `recordInbound` sets `lastMessageAt` **and** `lastInboundAt`; `replied → customer_replied`; `new` stays `new`; `converted`/`closed` are untouched. Idempotent on `externalId` (returns the stored row).
  - `recordOutbound` sets `lastMessageAt` only and never changes status (callers own that — `replyToEnquiry` sets `replied`, and the enquiry-ack must not reclassify a brand-new enquiry).
  - `recordNote` touches neither timestamp nor status: an internal note is not customer traffic.
  - Unread = visible to the viewer, status in (new, replied, customer_replied), `lastInboundAt` set, and no read row or `readAt < lastInboundAt`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/services/enquiry-messages.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  listThread,
  listThreadsFor,
  markRead,
  recordInbound,
  recordNote,
  recordOutbound,
  unreadCountsFor,
  visibleEnquiryWhere,
} from "./enquiry-messages";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]);

describe("visibleEnquiryWhere", () => {
  it("owners see everything", () => {
    expect(
      visibleEnquiryWhere({ userId: "u1", role: "OWNER", artistId: null }),
    ).toEqual({});
  });

  it("artists see their own plus every unassigned enquiry", () => {
    expect(
      visibleEnquiryWhere({ userId: "u2", role: "ARTIST", artistId: "art1" }),
    ).toEqual({
      OR: [{ preferredArtistId: "art1" }, { preferredArtistId: null }],
    });
  });

  it("an artist user with no artist record sees nothing", () => {
    expect(
      visibleEnquiryWhere({ userId: "u3", role: "ARTIST", artistId: null }),
    ).toEqual({ id: "__none__" });
  });
});

describe("enquiry messages (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  async function seed(status: "new" | "replied" | "closed" = "new") {
    const customer = await db().customer.create({
      data: { name: `Msg ${uid()}` },
    });
    customers.push(customer.id);
    const enquiry = await db().enquiry.create({
      data: { contactName: customer.name, customerId: customer.id, status },
    });
    enquiries.push(enquiry.id);
    return { customer, enquiry };
  }

  it("records an inbound message, bumps both timestamps and keeps 'new' as new", async () => {
    if (!(await dbReachable())) return;
    const { customer, enquiry } = await seed("new");
    const at = new Date("2026-09-05T09:00:00.000Z");
    const msg = await recordInbound({
      enquiryId: enquiry.id,
      customerId: customer.id,
      channel: "email",
      bodyText: "Hello, is Tuesday free?",
      fromName: "Amy",
      fromAddress: "amy@example.com",
      subject: "Tuesday?",
      at,
    });
    expect(msg.direction).toBe("inbound");
    expect(msg.attachments).toEqual([]);
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("new");
    expect(after.lastInboundAt?.toISOString()).toBe(at.toISOString());
    expect(after.lastMessageAt?.toISOString()).toBe(at.toISOString());
  });

  it("promotes a replied enquiry to customer_replied, but never a closed one", async () => {
    if (!(await dbReachable())) return;
    const replied = await seed("replied");
    await recordInbound({
      enquiryId: replied.enquiry.id,
      channel: "email",
      bodyText: "Any update?",
    });
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: replied.enquiry.id } }))
        .status,
    ).toBe("customer_replied");

    const closed = await seed("closed");
    await recordInbound({
      enquiryId: closed.enquiry.id,
      channel: "email",
      bodyText: "Thanks!",
    });
    const after = await db().enquiry.findUniqueOrThrow({
      where: { id: closed.enquiry.id },
    });
    expect(after.status).toBe("closed");
    expect(after.lastInboundAt).not.toBeNull();
  });

  it("is idempotent on externalId", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const externalId = uid("mid");
    const first = await recordInbound({
      enquiryId: enquiry.id,
      channel: "messenger",
      bodyText: "first",
      externalId,
    });
    const again = await recordInbound({
      enquiryId: enquiry.id,
      channel: "messenger",
      bodyText: "duplicate delivery",
      externalId,
    });
    expect(again.id).toBe(first.id);
    expect(again.bodyText).toBe("first");
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);
  });

  it("stores inbound attachments", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const msg = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "reference attached",
      attachments: [
        { mime: "image/png", filename: "ref.png", bytes: PNG },
        { mime: "application/pdf", filename: "brief.pdf", url: "https://f.test/b.pdf" },
      ],
    });
    expect(msg.attachments).toHaveLength(2);
    expect(msg.attachments[0]).toMatchObject({ hasBytes: true, filename: "ref.png" });
    expect(msg.attachments[1]).toMatchObject({ hasBytes: false, url: "https://f.test/b.pdf" });
  });

  it("outbound bumps lastMessageAt only and leaves the status alone", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed("new");
    const user = await db().user.findFirstOrThrow();
    const at = new Date("2026-09-06T09:00:00.000Z");
    const msg = await recordOutbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "Tuesday works!",
      authorUserId: user.id,
      deliveryStatus: "sent",
      at,
    });
    expect(msg.direction).toBe("outbound");
    expect(msg.authorName).toBe(user.displayName);
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("new");
    expect(after.lastMessageAt?.toISOString()).toBe(at.toISOString());
    expect(after.lastInboundAt).toBeNull();
  });

  it("notes are internal: no timestamps, no status change, still on the thread", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed("replied");
    const user = await db().user.findFirstOrThrow();
    const note = await recordNote({
      enquiryId: enquiry.id,
      authorUserId: user.id,
      bodyText: "Chased on Instagram too.",
    });
    expect(note.direction).toBe("internal");
    expect(note.channel).toBe("note");
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("replied");
    expect(after.lastMessageAt).toBeNull();
    const thread = await listThread(enquiry.id);
    expect(thread.map((m) => m.id)).toContain(note.id);
  });

  it("lists a thread oldest-first and batches by enquiry", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const other = await seed();
    const first = await recordInbound({
      enquiryId: enquiry.id,
      channel: "web",
      bodyText: "one",
      at: new Date("2026-09-01T10:00:00.000Z"),
    });
    const second = await recordOutbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "two",
      at: new Date("2026-09-02T10:00:00.000Z"),
    });
    await recordInbound({
      enquiryId: other.enquiry.id,
      channel: "web",
      bodyText: "elsewhere",
    });
    expect((await listThread(enquiry.id)).map((m) => m.id)).toEqual([
      first.id,
      second.id,
    ]);
    const map = await listThreadsFor([enquiry.id, other.enquiry.id, "missing"]);
    expect(map.get(enquiry.id)).toHaveLength(2);
    expect(map.get(other.enquiry.id)).toHaveLength(1);
    expect(map.get("missing")).toBeUndefined();
    expect(await listThreadsFor([])).toEqual(new Map());
  });

  it("counts unread until read, then again after a newer inbound", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const viewer = { userId: user.id, role: "OWNER" as const, artistId: null };
    const { enquiry } = await seed("replied");

    await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "unread please",
      at: new Date("2026-09-03T10:00:00.000Z"),
    });
    const before = await unreadCountsFor(viewer);
    expect(before.enquiryIds).toContain(enquiry.id);
    expect(before.total).toBe(before.enquiryIds.length);

    await markRead(enquiry.id, user.id, new Date("2026-09-03T11:00:00.000Z"));
    expect((await unreadCountsFor(viewer)).enquiryIds).not.toContain(enquiry.id);

    await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "and again",
      at: new Date("2026-09-04T10:00:00.000Z"),
    });
    expect((await unreadCountsFor(viewer)).enquiryIds).toContain(enquiry.id);
  });

  it("never counts an enquiry the viewer cannot see, or one with no inbound", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const artist = await db().artist.findFirstOrThrow();
    const mine = await seed();
    await db().enquiry.update({
      where: { id: mine.enquiry.id },
      data: { preferredArtistId: artist.id },
    });
    await recordInbound({
      enquiryId: mine.enquiry.id,
      channel: "email",
      bodyText: "for the assigned artist",
    });

    const silent = await seed();
    const owner = await unreadCountsFor({
      userId: user.id,
      role: "OWNER",
      artistId: null,
    });
    expect(owner.enquiryIds).toContain(mine.enquiry.id);
    expect(owner.enquiryIds).not.toContain(silent.enquiry.id);

    const stranger = await unreadCountsFor({
      userId: user.id,
      role: "ARTIST",
      artistId: `${artist.id}-not`,
    });
    expect(stranger.enquiryIds).not.toContain(mine.enquiry.id);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts`
Expected: FAIL — cannot find module `./enquiry-messages`.

- [ ] **Step 3: Implement**

`packages/core/src/services/enquiry-messages.ts`:

```ts
import type {
  MessageChannelKind,
  MessageDirection,
  MessageStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import {
  listAttachmentsFor,
  storeAttachment,
  type AttachmentMeta,
  type StoreAttachmentInput,
} from "./assets";

/**
 * The enquiry thread: every inbound customer message, every outbound staff
 * reply and every internal note, in one chronological log per enquiry, plus
 * the per-user read markers that drive the unread badge.
 *
 * Status side effects live here so every channel behaves identically:
 * an inbound message on a `replied` enquiry flips it to `customer_replied`,
 * a `new` one stays `new`, and `converted`/`closed` are never reopened.
 */

export interface InboxViewer {
  userId: string;
  role: "OWNER" | "ARTIST";
  artistId: string | null;
}

/**
 * Which enquiries this staff user may see. Owners see all; artists see their
 * own plus every unassigned enquiry (any channel) so nothing sits unclaimed.
 * Mirrors `artistInboxWhere` in the admin inbox helpers — change both together.
 */
export function visibleEnquiryWhere(viewer: InboxViewer): Prisma.EnquiryWhereInput {
  if (viewer.role === "OWNER") return {};
  if (!viewer.artistId) return { id: "__none__" };
  return {
    OR: [{ preferredArtistId: viewer.artistId }, { preferredArtistId: null }],
  };
}

export type ThreadAttachment = AttachmentMeta;

export interface ThreadMessageRow {
  id: string;
  enquiryId: string;
  direction: MessageDirection;
  channel: MessageChannelKind;
  authorUserId: string | null;
  authorName: string | null;
  fromName: string | null;
  fromAddress: string | null;
  subject: string | null;
  bodyText: string;
  deliveryStatus: MessageStatus;
  createdAt: Date;
  attachments: ThreadAttachment[];
}

const MESSAGE_SELECT = {
  id: true,
  enquiryId: true,
  direction: true,
  channel: true,
  authorUserId: true,
  fromName: true,
  fromAddress: true,
  subject: true,
  bodyText: true,
  deliveryStatus: true,
  createdAt: true,
  authorUser: { select: { displayName: true } },
} as const;

type RawMessage = Prisma.EnquiryMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

function toRow(raw: RawMessage, attachments: ThreadAttachment[]): ThreadMessageRow {
  return {
    id: raw.id,
    enquiryId: raw.enquiryId,
    direction: raw.direction,
    channel: raw.channel,
    authorUserId: raw.authorUserId,
    authorName: raw.authorUser?.displayName ?? null,
    fromName: raw.fromName,
    fromAddress: raw.fromAddress,
    subject: raw.subject,
    bodyText: raw.bodyText,
    deliveryStatus: raw.deliveryStatus,
    createdAt: raw.createdAt,
    attachments,
  };
}

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

async function createMessage(
  input: RecordMessageInput & {
    direction: MessageDirection;
    authorUserId?: string | null;
  },
): Promise<ThreadMessageRow> {
  const createdAt = input.at ?? new Date();

  // Webhook retries deliver the same provider id twice — return what we stored.
  if (input.externalId) {
    const existing = await prisma.enquiryMessage.findUnique({
      where: { externalId: input.externalId },
      select: MESSAGE_SELECT,
    });
    if (existing) {
      const map = await listAttachmentsFor([existing.id]);
      return toRow(existing, map.get(existing.id) ?? []);
    }
  }

  const raw = await prisma.enquiryMessage.create({
    data: {
      enquiryId: input.enquiryId,
      customerId: input.customerId ?? null,
      direction: input.direction,
      channel: input.channel,
      authorUserId: input.authorUserId ?? null,
      fromName: input.fromName ?? null,
      fromAddress: input.fromAddress ?? null,
      subject: input.subject ?? null,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      externalId: input.externalId ?? null,
      deliveryStatus: input.deliveryStatus ?? "logged",
      createdAt,
    },
    select: MESSAGE_SELECT,
  });

  const attachments: ThreadAttachment[] = [];
  for (const attachment of input.attachments ?? []) {
    attachments.push(await storeAttachment({ ...attachment, messageId: raw.id }));
  }
  return toRow(raw, attachments);
}

/**
 * A message from the customer. Bumps both activity timestamps and, when the
 * enquiry was awaiting us after a reply, flags it `customer_replied` so it
 * surfaces in its own tab. Closed/converted threads keep their status.
 */
export async function recordInbound(
  input: RecordMessageInput,
): Promise<ThreadMessageRow> {
  const message = await createMessage({ ...input, direction: "inbound" });
  const at = input.at ?? message.createdAt;
  await prisma.enquiry.updateMany({
    where: { id: input.enquiryId, status: "replied" },
    data: { status: "customer_replied" },
  });
  await prisma.enquiry.update({
    where: { id: input.enquiryId },
    data: { lastMessageAt: at, lastInboundAt: at },
  });
  return message;
}

/**
 * A message we sent. Bumps `lastMessageAt` only and never touches the status —
 * `replyToEnquiry` marks the enquiry `replied`, while the automatic
 * enquiry-ack must leave a brand-new enquiry looking new.
 */
export async function recordOutbound(
  input: RecordMessageInput & { authorUserId?: string | null },
): Promise<ThreadMessageRow> {
  const message = await createMessage({ ...input, direction: "outbound" });
  await prisma.enquiry.update({
    where: { id: input.enquiryId },
    data: { lastMessageAt: input.at ?? message.createdAt },
  });
  return message;
}

/** A staff-only note. Never sent, and not customer traffic — no timestamps. */
export async function recordNote(input: {
  enquiryId: string;
  authorUserId: string;
  bodyText: string;
  at?: Date;
}): Promise<ThreadMessageRow> {
  return createMessage({
    enquiryId: input.enquiryId,
    channel: "note",
    direction: "internal",
    authorUserId: input.authorUserId,
    bodyText: input.bodyText,
    at: input.at,
  });
}

export async function listThread(enquiryId: string): Promise<ThreadMessageRow[]> {
  return (await listThreadsFor([enquiryId])).get(enquiryId) ?? [];
}

/** Threads for a batch of enquiries — one query per table, for the inbox list. */
export async function listThreadsFor(
  enquiryIds: string[],
): Promise<Map<string, ThreadMessageRow[]>> {
  const map = new Map<string, ThreadMessageRow[]>();
  if (enquiryIds.length === 0) return map;
  const raws = await prisma.enquiryMessage.findMany({
    where: { enquiryId: { in: enquiryIds } },
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: MESSAGE_SELECT,
  });
  const attachments = await listAttachmentsFor(raws.map((r) => r.id));
  for (const raw of raws) {
    const list = map.get(raw.enquiryId) ?? [];
    list.push(toRow(raw, attachments.get(raw.id) ?? []));
    map.set(raw.enquiryId, list);
  }
  return map;
}

/** Mark the thread read for this user (idempotent; only ever moves forward). */
export async function markRead(
  enquiryId: string,
  userId: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.enquiryRead.upsert({
    where: { enquiryId_userId: { enquiryId, userId } },
    create: { enquiryId, userId, readAt: at },
    update: { readAt: at },
  });
}

export interface UnreadCounts {
  total: number;
  enquiryIds: string[];
}

/**
 * Enquiries with customer traffic this user has not caught up on: visible to
 * them, still open, with a `lastInboundAt` newer than their read marker (or no
 * marker at all). The comparison is done in JS because Prisma cannot compare a
 * relation's field against the parent row's field.
 */
export async function unreadCountsFor(viewer: InboxViewer): Promise<UnreadCounts> {
  const rows = await prisma.enquiry.findMany({
    where: {
      AND: [
        visibleEnquiryWhere(viewer),
        { lastInboundAt: { not: null } },
        { status: { in: ["new", "replied", "customer_replied"] } },
      ],
    },
    orderBy: { lastInboundAt: "desc" },
    take: 500,
    select: {
      id: true,
      lastInboundAt: true,
      reads: { where: { userId: viewer.userId }, select: { readAt: true } },
    },
  });

  const enquiryIds = rows
    .filter((row) => {
      const inbound = row.lastInboundAt?.getTime();
      if (inbound === undefined) return false;
      const readAt = row.reads[0]?.readAt.getTime();
      return readAt === undefined || readAt < inbound;
    })
    .map((row) => row.id);

  return { total: enquiryIds.length, enquiryIds };
}
```

Add `export * from "./enquiry-messages";` to `packages/core/src/services/index.ts`.

- [ ] **Step 4: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts` — PASS. Then `npm test -w @bnb/core` — PASS.

```bash
git add packages/core/src/services/enquiry-messages.ts packages/core/src/services/enquiry-messages.test.ts packages/core/src/services/index.ts
git commit -m "feat(core): enquiry message thread service — record/list, read markers, unread counts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 9: Every enquiry is born with a thread (`createEnquiry` + `sendEmail`)

**Files:**
- Modify: `packages/core/src/services/enquiries.ts`, `packages/core/src/services/enquiries.test.ts`, `packages/core/src/email/index.ts`, `packages/core/src/email/index.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // services/enquiries.ts
  export function channelForSource(source: EnquirySource): EnquiryChannel
  export function enquiryBriefText(input: Pick<CreateEnquiryInput, "description" | "style" | "placement" | "size" | "budgetPence">): string
  export function enquirySubject(input: Pick<CreateEnquiryInput, "description" | "style">): string | null
  // CreateEnquiryInput gains: channel?: EnquiryChannel
  // email/index.ts
  // SendEmailInput gains: enquiryId?: string | null
  ```
- Consumes: `findOrCreateCustomer` (Task 3), `recordInbound` / `recordOutbound` (Task 8).
- No `apps/web` source changes: both `POST /api/enquiries` and `POST /api/flash` already funnel through `createEnquiry`, which now does the identity + first-message work. `/api/flash` reaches it via `claimFlash` with `source: "flash"`, and Inkling boards post `source: "inkling"` — both map to the matching `channel`.

- [ ] **Step 1: Append the failing tests**

Append to `packages/core/src/services/enquiries.test.ts` (extend the top-level import list with `channelForSource`, `enquiryBriefText`, `enquirySubject` from `./enquiries` — note the module is already imported dynamically as `const { createEnquiry } = await import("./enquiries")`, so change that line to also pull the new helpers):

```ts
const { channelForSource, createEnquiry, enquiryBriefText, enquirySubject } =
  await import("./enquiries");
```

```ts
describe("enquiry channel + brief helpers", () => {
  it("maps the legacy source to a channel", () => {
    expect(channelForSource("web")).toBe("web");
    expect(channelForSource("flash")).toBe("flash");
    expect(channelForSource("inkling")).toBe("inkling");
  });

  it("summarises the brief when there is no description", () => {
    expect(
      enquiryBriefText({
        description: "  Peony on the forearm  ",
        style: "Fine-line",
        placement: "Forearm",
        size: null,
        budgetPence: null,
      }),
    ).toBe("Peony on the forearm");
    expect(
      enquiryBriefText({
        description: null,
        style: "Fine-line",
        placement: "Forearm",
        size: "Palm-sized",
        budgetPence: 15000,
      }),
    ).toBe("Style: Fine-line · Placement: Forearm · Size: Palm-sized · Budget: £150.00");
    expect(
      enquiryBriefText({
        description: "   ",
        style: null,
        placement: null,
        size: null,
        budgetPence: null,
      }),
    ).toBe("(no details given)");
  });

  it("derives a short subject", () => {
    expect(enquirySubject({ description: "Peony on the forearm", style: "Fine-line" })).toBe(
      "Peony on the forearm",
    );
    expect(enquirySubject({ description: null, style: "Fine-line" })).toBe("Fine-line");
    expect(enquirySubject({ description: null, style: null })).toBeNull();
    expect(enquirySubject({ description: "x".repeat(200), style: null })?.length).toBe(120);
  });
});

describe("createEnquiry threads (DB)", () => {
  // Own cleanup arrays — the ones above are scoped to the first describe block.
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("normalises the customer, sets the channel and opens the thread with an inbound message", async () => {
    if (!(await dbReachable())) return;
    sendEmail.mockClear();
    const local = uid("thread");
    const enq = await createEnquiry({
      contactName: "Amy Jones",
      contactEmail: `  ${local}@EXAMPLE.com `,
      contactPhone: "07700 900128",
      style: "Fine-line",
      description: "Peony on the forearm",
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);

    expect(enq.channel).toBe("web");
    expect(enq.subject).toBe("Peony on the forearm");
    expect(enq.threadToken).toBeTruthy();

    const customer = await db().customer.findUniqueOrThrow({
      where: { id: enq.customerId as string },
    });
    expect(customer.email).toBe(`${local}@example.com`);
    expect(customer.phone).toBe("+447700900128");

    const messages = await db().enquiryMessage.findMany({
      where: { enquiryId: enq.id },
      orderBy: { createdAt: "asc" },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "inbound",
      channel: "web",
      bodyText: "Peony on the forearm",
      fromName: "Amy Jones",
      fromAddress: `${local}@example.com`,
    });

    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enq.id } });
    expect(after.status).toBe("new");
    expect(after.lastInboundAt).not.toBeNull();
    // The ack is sent with the enquiry id so Phase-1 threads show it too.
    expect(sendEmail.mock.calls[0][0].enquiryId).toBe(enq.id);
  });

  it("sets channel=flash / channel=inkling from the source", async () => {
    if (!(await dbReachable())) return;
    const flash = await createEnquiry({
      contactName: `Flash ${uid()}`,
      source: "flash",
      description: "Flash claim: Bandit Rose",
    });
    enquiries.push(flash.id);
    if (flash.customerId) customers.push(flash.customerId);
    expect(flash.channel).toBe("flash");

    const inkling = await createEnquiry({
      contactName: `Inkling ${uid()}`,
      source: "inkling",
    });
    enquiries.push(inkling.id);
    if (inkling.customerId) customers.push(inkling.customerId);
    expect(inkling.channel).toBe("inkling");
    const body = await db().enquiryMessage.findFirstOrThrow({
      where: { enquiryId: inkling.id },
    });
    expect(body.bodyText).toBe("(no details given)");
  });
});
```

Append to `packages/core/src/email/index.test.ts` (extend the `@bnb/core/db` mock with nothing new — the enquiry write is mocked at the service boundary):

```ts
const recordOutbound = vi.hoisted(() => vi.fn(async () => ({ id: "em_1" })));
vi.mock("@bnb/core/services/enquiry-messages", () => ({ recordOutbound }));
```

```ts
describe("sendEmail enquiry threading", () => {
  it("records an outbound email message when an enquiryId is given", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");
    recordOutbound.mockClear();
    await sendEmail({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      enquiryId: "e1",
      data: { customerName: "Amy", body: "Tuesday works!" },
    });
    expect(recordOutbound).toHaveBeenCalledTimes(1);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      enquiryId: "e1",
      customerId: "c1",
      channel: "email",
      deliveryStatus: "logged",
      fromAddress: "amy@example.com",
    });
  });

  it("records nothing when no enquiryId is given", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");
    recordOutbound.mockClear();
    await sendEmail({
      to: "amy@example.com",
      type: "reminder",
      data: { customerName: "Amy" },
    });
    expect(recordOutbound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -w @bnb/core -- src/services/enquiries.test.ts src/email/index.test.ts`
Expected: FAIL — `channelForSource is not a function`, `enq.channel` is `undefined` on the returned row (before the service sets it) and `recordOutbound` is never called.

- [ ] **Step 3: Implement `createEnquiry`**

In `packages/core/src/services/enquiries.ts`, replace the imports and add the helpers + the new body:

```ts
import { Prisma } from "@prisma/client";
import type {
  Enquiry,
  EnquiryChannel,
  EnquirySource,
  EnquiryStatus,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { findOrCreateCustomer } from "./contact-identity";
import { recordInbound } from "./enquiry-messages";
import { attachMoodboardAssets } from "./moodboard-assets";
```

```ts
/** The three public forms map one-to-one onto the matching channel. */
export function channelForSource(source: EnquirySource): EnquiryChannel {
  return source as EnquiryChannel;
}

function poundsFromPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * The customer's own words become the first message on the thread. When the
 * form carried no description, summarise the structured brief instead so the
 * thread is never an empty bubble.
 */
export function enquiryBriefText(
  input: Pick<
    CreateEnquiryInput,
    "description" | "style" | "placement" | "size" | "budgetPence"
  >,
): string {
  const described = input.description?.trim();
  if (described) return described;
  const parts: string[] = [];
  if (input.style) parts.push(`Style: ${input.style}`);
  if (input.placement) parts.push(`Placement: ${input.placement}`);
  if (input.size) parts.push(`Size: ${input.size}`);
  if (input.budgetPence != null) {
    parts.push(`Budget: ${poundsFromPence(input.budgetPence)}`);
  }
  return parts.length ? parts.join(" · ") : "(no details given)";
}

/** Short thread title for the inbox list (email threads set their own). */
export function enquirySubject(
  input: Pick<CreateEnquiryInput, "description" | "style">,
): string | null {
  const described = input.description?.trim();
  if (described) return described.slice(0, 120);
  const style = input.style?.trim();
  return style ? style.slice(0, 120) : null;
}
```

Add `channel?: EnquiryChannel;` to `CreateEnquiryInput` (after `source?: EnquirySource;`), then rewrite the top of `createEnquiry`:

```ts
export async function createEnquiry(
  input: CreateEnquiryInput,
): Promise<Enquiry> {
  // Identity first: normalised email/phone are unique, so this is the single
  // place a public submission is bound to a CRM record.
  const customer = await findOrCreateCustomer({
    name: input.contactName,
    email: input.contactEmail ?? null,
    phone: input.contactPhone ?? null,
    marketingConsent: input.marketingConsent,
  });

  const source = input.source ?? "web";
  const enquiry = await prisma.enquiry.create({
    data: {
      customerId: customer.id,
      contactName: input.contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      preferredArtistId: input.preferredArtistId ?? null,
      style: input.style ?? null,
      placement: input.placement ?? null,
      size: input.size ?? null,
      budgetPence: input.budgetPence ?? null,
      description: input.description ?? null,
      moodboard: input.moodboard ?? [],
      matchData: input.matchData ?? Prisma.DbNull,
      moodboardData: input.moodboardData ?? Prisma.DbNull,
      source,
      channel: input.channel ?? channelForSource(source),
      subject: enquirySubject(input),
      status: input.status ?? "new",
    },
  });

  // Every enquiry has a thread from birth: the form submission IS the first
  // inbound message, so the admin thread view has something to show for web
  // leads exactly as it will for email and Meta ones.
  await recordInbound({
    enquiryId: enquiry.id,
    customerId: customer.id,
    channel: "web",
    bodyText: enquiryBriefText(input),
    fromName: input.contactName,
    fromAddress: customer.email ?? customer.phone ?? null,
    subject: enquiry.subject,
    at: enquiry.createdAt,
  });
```

Leave the mood-board attach block as it is, and add `enquiryId` to the ack send:

```ts
    await sendEmail({
      to: input.contactEmail,
      type: "enquiry_ack",
      customerId: customer.id,
      enquiryId: enquiry.id,
      data: {
        customerName: input.contactName,
        artistName,
        subjectIdea: input.description ?? input.style ?? undefined,
      },
    });
```

Finally, return the row **as re-read** so the caller sees the timestamps `recordInbound` set:

```ts
  return prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
}
```

- [ ] **Step 4: Implement `sendEmail`'s `enquiryId`**

In `packages/core/src/email/index.ts`, add to the `SendEmailInput` interface (after `relatedBookingId`):

```ts
  /**
   * When set, the sent email is also recorded as an outbound EnquiryMessage so
   * it appears on the enquiry's thread. MessageLog is still written for the
   * customer timeline — the two logs serve different screens.
   */
  enquiryId?: string | null;
```

Import at the top:
```ts
import { recordOutbound } from "@bnb/core/services/enquiry-messages";
```

and, immediately before `return { id, status };`, add:

```ts
  // 4. Mirror the send onto the enquiry thread when this email belongs to one.
  //    Never fatal: a thread write must not fail a delivered email.
  if (input.enquiryId) {
    try {
      await recordOutbound({
        enquiryId: input.enquiryId,
        customerId: input.customerId ?? null,
        channel: "email",
        subject: subject || null,
        bodyText: (input.data?.body as string | undefined) ?? subject || "",
        bodyHtml: html || null,
        fromAddress: input.to,
        deliveryStatus: toDbStatus(status),
      });
    } catch (err) {
      console.error(
        `[email] failed to record EnquiryMessage for "${input.type}":`,
        err,
      );
    }
  }
```

- [ ] **Step 5: Run tests, commit**

```bash
npm test -w @bnb/core
npm test -w @bnb/web
```
Expected: both PASS. `apps/web`'s enquiry/flash route suites mock `@bnb/core/services/enquiries`, so they are unaffected; if any web suite asserts on the returned enquiry shape, add `channel: "web"` to its fixture.

```bash
git add packages/core/src/services/enquiries.ts packages/core/src/services/enquiries.test.ts packages/core/src/email/index.ts packages/core/src/email/index.test.ts
git commit -m "feat(core): enquiries get an identity-resolved customer, a channel and a first inbound message; sendEmail can thread

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 10: Admin helpers + actions — visibility, close authorisation, notes, read

**Files:**
- Modify: `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+ `.test.ts`), `apps/admin/src/app/(staff)/enquiries/actions.ts` (+ `.test.ts`), `apps/admin/src/app/(staff)/_shared/labels.ts` (+ `.test.ts`)

**Interfaces:**
- Produces (enquiry-helpers.ts):
  ```ts
  export function countByStatus(items: { status: EnquiryStatus }[]): Record<EnquiryStatus, number>  // now 5 keys
  export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput   // { OR: [{ preferredArtistId }, { preferredArtistId: null }] }
  export function isUnassigned(e: { preferredArtistId: string | null }): boolean
  export function canAccessEnquiry(user: { role: "OWNER" | "ARTIST"; artistId?: string | null }, e: { preferredArtistId: string | null }): boolean
  export function canCloseEnquiry(user: { role: "OWNER" | "ARTIST"; artistId?: string | null }, e: { preferredArtistId: string | null }): boolean
  export function attachmentHref(a: { id: string; url: string | null; hasBytes: boolean }): string | null
  ```
  Removed: `buildThreadMap`, `ThreadMessage`, `ThreadEntry`, `isOpenBoard` (replaced by the real thread + `isUnassigned`).
- Produces (actions.ts):
  ```ts
  export async function addInternalNote(enquiryId: string, input: { body: string }): Promise<ActionState>
  export async function markEnquiryRead(enquiryId: string): Promise<ActionState>
  ```
- Produces (labels.ts): `enquiryStatusLabel("customer_replied") === "Customer replied"`, `enquiryStatusVariant("customer_replied") === "destructive"`.
- Consumes: `recordNote`, `recordOutbound`, `markRead` (Task 8).

- [ ] **Step 1: Update the helper tests**

In `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`:
1. Delete the whole `describe("buildThreadMap", ...)` block and drop `buildThreadMap` / `type ThreadMessage` from the import list.
2. Replace `isOpenBoard` in the import list with `isUnassigned`, and add `attachmentHref`, `canCloseEnquiry`, `countByStatus`.
3. Replace the `describe("artist scope + open boards", ...)` block's first two cases with:

```ts
describe("visibility, close authorisation and attachments", () => {
  it("artists see their own enquiries plus every unassigned one, any channel", () => {
    expect(artistInboxWhere("art1")).toEqual({
      OR: [{ preferredArtistId: "art1" }, { preferredArtistId: null }],
    });
  });

  it("isUnassigned / canAccessEnquiry", () => {
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(isUnassigned({ preferredArtistId: null })).toBe(true);
    expect(isUnassigned({ preferredArtistId: "art2" })).toBe(false);
    expect(canAccessEnquiry(artist, { preferredArtistId: null })).toBe(true);
    expect(canAccessEnquiry(artist, { preferredArtistId: "art1" })).toBe(true);
    expect(canAccessEnquiry(artist, { preferredArtistId: "art2" })).toBe(false);
    expect(canAccessEnquiry({ role: "OWNER" }, { preferredArtistId: "art2" })).toBe(true);
    expect(canAccessEnquiry({ role: "ARTIST", artistId: null }, { preferredArtistId: null })).toBe(false);
  });

  it("only the assigned artist (or an owner) may close an enquiry", () => {
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(canCloseEnquiry(artist, { preferredArtistId: "art1" })).toBe(true);
    expect(canCloseEnquiry(artist, { preferredArtistId: null })).toBe(false);
    expect(canCloseEnquiry(artist, { preferredArtistId: "art2" })).toBe(false);
    expect(canCloseEnquiry({ role: "OWNER" }, { preferredArtistId: null })).toBe(true);
  });

  it("counts the customer_replied status", () => {
    expect(countByStatus([{ status: "customer_replied" }, { status: "new" }])).toEqual({
      new: 1,
      replied: 0,
      customer_replied: 1,
      converted: 0,
      closed: 0,
    });
  });

  it("routes inline attachments through the admin origin and links out otherwise", () => {
    expect(attachmentHref({ id: "a1", url: null, hasBytes: true })).toBe(
      "/api/attachments/a1",
    );
    expect(
      attachmentHref({ id: "a2", url: "https://f.test/b.pdf", hasBytes: false }),
    ).toBe("https://f.test/b.pdf");
    expect(attachmentHref({ id: "a3", url: null, hasBytes: false })).toBeNull();
  });
});
```

Also update `apps/admin/src/app/(staff)/enquiries/page.test.tsx` — the empty-inbox tally now has five keys:
```ts
    expect(countByStatus([])).toEqual({
      new: 0,
      replied: 0,
      customer_replied: 0,
      converted: 0,
      closed: 0,
    });
```
And add to `apps/admin/src/app/(staff)/_shared/labels.test.ts`, inside `describe("status labels")`:
```ts
    expect(enquiryStatusLabel("customer_replied")).toBe("Customer replied");
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -w @bnb/admin -- src/app/\(staff\)/enquiries src/app/\(staff\)/_shared`
Expected: FAIL — `isUnassigned`/`canCloseEnquiry`/`attachmentHref` are not exported, `countByStatus` returns four keys, and `enquiryStatusLabel("customer_replied")` returns `"customer_replied"`.

- [ ] **Step 3: Implement the helpers**

In `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`:

Delete `ThreadMessage`, `ThreadEntry` and `buildThreadMap` entirely (the real thread comes from `@bnb/core/services/enquiry-messages` now). Then:

```ts
/** Tally enquiries per status (pure; used by the inbox tabs). */
export function countByStatus(
  items: { status: EnquiryStatus }[],
): Record<EnquiryStatus, number> {
  const counts: Record<EnquiryStatus, number> = {
    new: 0,
    replied: 0,
    customer_replied: 0,
    converted: 0,
    closed: 0,
  };
  for (const i of items) counts[i.status] += 1;
  return counts;
}
```

```ts
/**
 * Artists see enquiries that prefer them PLUS every unassigned enquiry on any
 * channel — an emailed lead must not sit invisible because nobody claimed it.
 * Mirrors `visibleEnquiryWhere` in @bnb/core/services/enquiry-messages, which
 * drives the unread badge; change both together.
 */
export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput {
  return {
    OR: [{ preferredArtistId: artistId }, { preferredArtistId: null }],
  };
}

/** No artist has taken this enquiry yet — any artist may claim it. */
export function isUnassigned(e: { preferredArtistId: string | null }): boolean {
  return e.preferredArtistId === null;
}

/**
 * Can this staff user see/act on this enquiry? Owners see everything; artists
 * see enquiries that prefer them plus any unassigned one.
 */
export function canAccessEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  if (!user.artistId) return false;
  return e.preferredArtistId === user.artistId || isUnassigned(e);
}

/**
 * Closing is narrower than access: an artist may only close an enquiry that is
 * assigned to them. Seeing an unassigned enquiry must not let one artist bin a
 * lead another was about to take.
 */
export function canCloseEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  return Boolean(user.artistId) && e.preferredArtistId === user.artistId;
}

/**
 * Where the inbox links an attachment: inline bytes are served by the
 * staff-gated admin route, link-only rows go straight to their source, and a
 * row with neither is unreachable.
 */
export function attachmentHref(a: {
  id: string;
  url: string | null;
  hasBytes: boolean;
}): string | null {
  if (a.hasBytes) return `/api/attachments/${a.id}`;
  return a.url;
}
```

In `apps/admin/src/app/(staff)/_shared/labels.ts`:
```ts
  const map: Record<EnquiryStatus, string> = {
    new: "New",
    replied: "Replied",
    customer_replied: "Customer replied",
    converted: "Converted",
    closed: "Closed",
  };
```
and in `enquiryStatusVariant`, add before `default`:
```ts
    case "customer_replied":
      return "destructive";
```
(Deliberately loud: a waiting customer is the one status that needs chasing.)

- [ ] **Step 4: Update the actions tests**

In `apps/admin/src/app/(staff)/enquiries/actions.test.ts`:
1. Extend the `@bnb/core/db` mock's `enquiry` object with `update`/`updateMany` (already present) — no change needed there.
2. Add a mock for the message service, next to the other `vi.mock` calls:
```ts
vi.mock("@bnb/core/services/enquiry-messages", () => ({
  markRead: vi.fn(),
  recordNote: vi.fn(),
  recordOutbound: vi.fn(),
}));
```
and after the other dynamic imports:
```ts
const { markRead, recordNote, recordOutbound } = await import(
  "@bnb/core/services/enquiry-messages"
);
```
3. `ENQUIRY` gains `status: "new" as const` (the close guard reads the row).
4. Rename every `source: "inkling"` / `preferredArtistId: null` pairing in the "artist access + claiming" block to just `preferredArtistId: null` (the source no longer matters), and rename the block to `describe("artist access + claiming (any unassigned enquiry)")`.
5. Add:

```ts
describe("reply threading, notes, read markers and close authorisation", () => {
  const ARTIST = {
    id: "u2",
    email: "a@x",
    role: "ARTIST" as const,
    displayName: "Art",
    artistId: "art1",
  };

  it("passes the enquiry id to sendEmail so the reply lands on the thread", async () => {
    await replyToEnquiry("e1", { message: "Tuesday works!" });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ enquiryId: "e1", type: "staff_reply" }),
    );
  });

  it("records an outbound thread message when there is no email to send to", async () => {
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      contactEmail: null,
    } as never);
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(recordOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        enquiryId: "e1",
        channel: "email",
        bodyText: "Hello",
        deliveryStatus: "logged",
      }),
    );
  });

  it("addInternalNote records an internal message and rejects an empty body", async () => {
    const { addInternalNote } = await import("./actions");
    const ok = await addInternalNote("e1", { body: "  Chased on IG.  " });
    expect(ok.ok).toBe(true);
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: "Chased on IG.",
    });
    vi.mocked(recordNote).mockClear();
    const bad = await addInternalNote("e1", { body: "   " });
    expect(bad.ok).toBe(false);
    expect(recordNote).not.toHaveBeenCalled();
  });

  it("markEnquiryRead marks the thread read for the signed-in user", async () => {
    const { markEnquiryRead } = await import("./actions");
    const res = await markEnquiryRead("e1");
    expect(res.ok).toBe(true);
    expect(markRead).toHaveBeenCalledWith("e1", "u1");
  });

  it("lets an owner close anything but limits artists to their own enquiries", async () => {
    const { closeEnquiry } = await import("./actions");
    expect((await closeEnquiry("e1")).ok).toBe(true);

    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: "art1",
    } as never);
    expect((await closeEnquiry("e1")).ok).toBe(true);

    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    const refused = await closeEnquiry("e1");
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/assigned artist/i);
  });
});
```

- [ ] **Step 5: Implement the actions**

In `apps/admin/src/app/(staff)/enquiries/actions.ts`:

Imports:
```ts
import {
  markRead,
  recordNote,
  recordOutbound,
} from "@bnb/core/services/enquiry-messages";
import {
  buildConvertInput,
  canAccessEnquiry,
  canCloseEnquiry,
  isUnassigned,
  validateReply,
} from "./enquiry-helpers";
```
(drop the `EnquirySource` type import — nothing needs it now.)

`loadEnquiryScoped` selects `status: true` in addition to the existing fields and keeps `source: true` (the inbox still shows a source badge); `canAccessEnquiry(user, enquiry)` now takes only `preferredArtistId`, which the selected row already satisfies.

`claimIfOpen` → rename to `claimIfUnassigned` and widen the guard:
```ts
/**
 * An artist responding to an unassigned enquiry takes it — on any channel, not
 * just Inkling boards. The claim is conditional at the database
 * (`preferredArtistId: null` in the `where`) so two concurrent claimants can't
 * both "win" a TOCTOU race — only one `updateMany` matches a row.
 */
async function claimIfUnassigned(
  user: SessionUser,
  enquiry: { id: string; preferredArtistId: string | null },
): Promise<{ attempted: boolean; claimed: boolean }> {
  if (user.role === "OWNER" || !user.artistId || !isUnassigned(enquiry)) {
    return { attempted: false, claimed: false };
  }
  const { count } = await prisma.enquiry.updateMany({
    where: { id: enquiry.id, preferredArtistId: null },
    data: { preferredArtistId: user.artistId, assignedAt: new Date() },
  });
  return { attempted: true, claimed: count > 0 };
}
```
Update the two call sites in `replyToEnquiry` and the note in `withClaimNote` (`"This enquiry was taken by another artist a moment ago."`).

In `replyToEnquiry`, no-email branch — after the `prisma.messageLog.create` call add:
```ts
    // Also put it on the enquiry thread; sendEmail does this for real sends.
    await recordOutbound({
      enquiryId,
      customerId: enquiry.customerId,
      channel: "email",
      subject: "Re: your enquiry",
      bodyText: valid.message,
      authorUserId: user.id,
      deliveryStatus: "logged",
    });
```
and in the sending branch pass the enquiry id:
```ts
  const result = await sendEmail({
    to: enquiry.contactEmail,
    type: "staff_reply",
    customerId: enquiry.customerId,
    enquiryId,
    data: {
      customerName: enquiry.contactName,
      body: valid.message,
    },
  });
```

`claimEnquiry`: replace `isOpenBoard(enquiry)` with `isUnassigned(enquiry)`, change the two messages from "board" to "enquiry" ("This enquiry has already been taken." / "This enquiry is yours — it now shows under your enquiries."), keep the conditional `updateMany` and add `assignedAt: new Date()` to its `data`.

`assignEnquiry`: add `assignedAt: artistId ? new Date() : null` alongside `preferredArtistId`.

`closeEnquiry` — the authorisation fix:
```ts
export async function closeEnquiry(enquiryId: string): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  // Access lets an artist SEE unassigned enquiries; closing is narrower, or one
  // artist could bin a lead another was about to take.
  if (!canCloseEnquiry(user, enquiry)) {
    return {
      ok: false,
      message: "Only the assigned artist (or an owner) can close this enquiry.",
    };
  }
  await updateEnquiryStatus(enquiryId, "closed");
  revalidatePath("/enquiries");
  return { ok: true, message: "Enquiry closed." };
}
```

New actions at the end of the file:
```ts
/** A staff-only note on the thread. Never sent to the customer. */
export async function addInternalNote(
  enquiryId: string,
  input: { body: string },
): Promise<ActionState> {
  const { user } = await loadEnquiryScoped(enquiryId);
  const body = input.body.trim();
  if (!body) return { ok: false, message: "A note needs some text." };
  await recordNote({ enquiryId, authorUserId: user.id, bodyText: body });
  revalidatePath("/enquiries");
  return { ok: true, message: "Note added." };
}

/** Clear this user's unread flag for the thread (called when it is opened). */
export async function markEnquiryRead(enquiryId: string): Promise<ActionState> {
  const { user } = await loadEnquiryScoped(enquiryId);
  await markRead(enquiryId, user.id);
  revalidatePath("/enquiries");
  return { ok: true };
}
```

- [ ] **Step 6: Run tests, commit**

```bash
npm test -w @bnb/admin -- src/app/\(staff\)/enquiries src/app/\(staff\)/_shared
```
Expected: PASS. `EnquiryInbox.tsx` still imports `isOpenBoard` and `ThreadSection` at this point, so `npm test -w @bnb/admin` as a whole will fail until Task 11 — that is expected and is the only permitted red between these two tasks. Commit them together if you prefer a green tree at every commit; otherwise commit now and finish Task 11 immediately.

```bash
git add "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts" "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts" "apps/admin/src/app/(staff)/enquiries/actions.ts" "apps/admin/src/app/(staff)/enquiries/actions.test.ts" "apps/admin/src/app/(staff)/enquiries/page.test.tsx" "apps/admin/src/app/(staff)/_shared/labels.ts" "apps/admin/src/app/(staff)/_shared/labels.test.ts"
git commit -m "feat(admin): generalised enquiry visibility, artist close authorisation, internal notes and read markers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 11: Admin UI — thread view, status tabs, assigned pill, unread badge

**Files:**
- Create: `apps/admin/src/app/(staff)/enquiries/EnquiryThread.tsx`, `apps/admin/src/app/(staff)/enquiries/EnquiryThread.test.tsx`
- Modify: `apps/admin/src/app/(staff)/enquiries/page.tsx`, `EnquiryInbox.tsx`, `EnquiryInbox.test.tsx`, `EnquiryDetailSections.tsx`, `EnquiryDetailSections.test.tsx`, `apps/admin/src/app/(staff)/layout.tsx`, `apps/admin/src/components/admin/AppShell.tsx`, `apps/admin/src/components/admin/AppShell.test.tsx`

**Interfaces:**
- Produces (EnquiryThread.tsx):
  ```ts
  export interface ThreadAttachmentItem { id: string; mime: string; size: number; filename: string | null; url: string | null; hasBytes: boolean }
  export interface ThreadItem {
    id: string;
    direction: "inbound" | "outbound" | "internal";
    channel: "web" | "email" | "messenger" | "instagram" | "note";
    authorName: string | null;
    fromName: string | null;
    subject: string | null;
    bodyText: string;
    deliveryStatus: string;
    createdAtISO: string;
    attachments: ThreadAttachmentItem[];
  }
  export function EnquiryThread({ items }: { items: ThreadItem[] }): React.ReactElement | null
  export const CHANNEL_LABEL: Record<ThreadItem["channel"], string>
  ```
- Produces (EnquiryInbox.tsx): `EnquiryItem` gains `subject: string | null`, `channel: EnquiryChannel`, `lastMessageAtISO: string | null`, `unread: boolean`, `preferredArtistName: string | null`, and `thread: ThreadItem[]` replaces the old `ThreadEntry[]`.
- Produces (AppShell.tsx): `AppShell({ role, enquiriesUnread, children })` with `enquiriesUnread?: number`.
- Consumes: `listThreadsFor`, `unreadCountsFor` (Task 8); `attachmentHref`, `isUnassigned`, `countByStatus` (Task 10); `addInternalNote`, `markEnquiryRead` (Task 10).
- `EnquiryDetailSections.tsx` loses `ThreadSection` (and its two test cases) — the real thread replaces the MessageLog list.

- [ ] **Step 1: Write the failing thread test**

`apps/admin/src/app/(staff)/enquiries/EnquiryThread.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnquiryThread, type ThreadItem } from "./EnquiryThread";

const base: ThreadItem = {
  id: "m1",
  direction: "inbound",
  channel: "web",
  authorName: null,
  fromName: "Amy",
  subject: "Peony on the forearm",
  bodyText: "Peony on the forearm please",
  deliveryStatus: "logged",
  createdAtISO: "2026-09-01T10:00:00Z",
  attachments: [],
};

describe("EnquiryThread", () => {
  it("renders nothing for an empty thread", () => {
    expect(EnquiryThread({ items: [] })).toBeNull();
  });

  it("labels each bubble by direction, channel and author", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          base,
          {
            ...base,
            id: "m2",
            direction: "outbound",
            channel: "email",
            authorName: "Sarah North",
            fromName: null,
            bodyText: "Tuesday works!",
            deliveryStatus: "sent",
            createdAtISO: "2026-09-02T10:00:00Z",
          },
          {
            ...base,
            id: "m3",
            direction: "internal",
            channel: "note",
            authorName: "Sarah North",
            fromName: null,
            bodyText: "Chased on Instagram too.",
            createdAtISO: "2026-09-03T10:00:00Z",
          },
        ]}
      />,
    );
    expect(html).toContain("Peony on the forearm please");
    expect(html).toContain("Tuesday works!");
    expect(html).toContain("Chased on Instagram too.");
    expect(html).toContain("Amy");
    expect(html).toContain("Sarah North");
    expect(html).toContain("Web form");
    expect(html).toContain("Email");
    expect(html).toContain("Internal note");
  });

  it("shows inline attachments through the admin route and links out for the rest", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          {
            ...base,
            attachments: [
              {
                id: "a1",
                mime: "image/png",
                size: 1024,
                filename: "ref.png",
                url: null,
                hasBytes: true,
              },
              {
                id: "a2",
                mime: "application/pdf",
                size: 0,
                filename: "brief.pdf",
                url: "https://f.test/brief.pdf",
                hasBytes: false,
              },
              {
                id: "a3",
                mime: "application/zip",
                size: 0,
                filename: null,
                url: null,
                hasBytes: false,
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("/api/attachments/a1");
    expect(html).toContain("https://f.test/brief.pdf");
    expect(html).toContain("brief.pdf");
    // Unreachable attachment is named but not linked.
    expect(html).not.toContain("/api/attachments/a3");
  });
});
```

Run: `npm test -w @bnb/admin -- src/app/\(staff\)/enquiries/EnquiryThread` — FAIL (cannot find `./EnquiryThread`).

- [ ] **Step 2: Implement `EnquiryThread.tsx`**

```tsx
"use client";

/**
 * The enquiry thread: every message in chronological order. Inbound sits left,
 * outbound right, internal notes are muted and full width, and each bubble
 * carries its channel + timestamp so a mixed email/Messenger/web history reads
 * unambiguously. Replaces the old flat MessageLog "Message history" list.
 */
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@bnb/core/utils";
import { formatDateTime } from "../_shared/labels";
import { attachmentHref } from "./enquiry-helpers";

export interface ThreadAttachmentItem {
  id: string;
  mime: string;
  size: number;
  filename: string | null;
  url: string | null;
  hasBytes: boolean;
}

export interface ThreadItem {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  channel: "web" | "email" | "messenger" | "instagram" | "note";
  authorName: string | null;
  fromName: string | null;
  subject: string | null;
  bodyText: string;
  deliveryStatus: string;
  createdAtISO: string;
  attachments: ThreadAttachmentItem[];
}

export const CHANNEL_LABEL: Record<ThreadItem["channel"], string> = {
  web: "Web form",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
  note: "Internal note",
};

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function Attachments({ items }: { items: ThreadAttachmentItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-2">
      {items.map((a) => {
        const href = attachmentHref(a);
        const name = a.filename ?? `Attachment ${a.id.slice(0, 6)}`;
        if (!href) {
          return (
            <li key={a.id} className="text-xs text-text-muted">
              {name} (unavailable)
            </li>
          );
        }
        return (
          <li key={a.id}>
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {a.hasBytes && isImage(a.mime) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt={name}
                  className="size-20 rounded-md border border-border-default object-cover"
                />
              ) : (
                <span className="inline-flex rounded-md border border-border-default bg-bg-base px-3 py-2 text-xs text-text-secondary underline">
                  {name}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function EnquiryThread({ items }: { items: ThreadItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <Label>Thread ({items.length})</Label>
      <ol className="space-y-2">
        {items.map((m) => {
          const internal = m.direction === "internal";
          const outbound = m.direction === "outbound";
          const who = outbound || internal ? m.authorName : m.fromName;
          return (
            <li
              key={m.id}
              className={cn(
                "flex",
                internal ? "justify-center" : outbound ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                  internal
                    ? "w-full border-dashed border-border-default bg-bg-base text-text-muted"
                    : outbound
                      ? "border-bb-teal/40 bg-bb-teal/10 text-text-secondary"
                      : "border-border-default bg-bg-card text-text-secondary",
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <Badge variant="outline">{CHANNEL_LABEL[m.channel]}</Badge>
                  {who && <span className="text-text-primary">{who}</span>}
                  {outbound && m.deliveryStatus !== "sent" && (
                    <Badge variant="outline" className="capitalize">
                      {m.deliveryStatus}
                    </Badge>
                  )}
                  <span className="ml-auto">{formatDateTime(m.createdAtISO)}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.bodyText}</p>
                <Attachments items={m.attachments} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

Run its test — PASS.

- [ ] **Step 3: Page — load threads + unread, drop the MessageLog query**

Rewrite `apps/admin/src/app/(staff)/enquiries/page.tsx`:

```tsx
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  listThreadsFor,
  unreadCountsFor,
} from "@bnb/core/services/enquiry-messages";
import { parseMoodboardData } from "@bnb/core/services/moodboard-data";
import { artistInboxWhere } from "./enquiry-helpers";
import type { ThreadItem } from "./EnquiryThread";
import {
  EnquiryInbox,
  type ArtistOption,
  type EnquiryItem,
} from "./EnquiryInbox";

/**
 * Enquiries inbox (BACKOFHOUSE-IA E1/E2). Owners see the whole inbox with an
 * assigned-artist pill on every row; artists see enquiries that prefer them
 * PLUS every unassigned enquiry on any channel, which they can take or claim
 * by responding. Each row carries its full message thread and this user's
 * unread flag. Reply / note / assign / convert / claim / close run through
 * colocated server actions.
 */
export const dynamic = "force-dynamic";

export default async function EnquiriesPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const viewer = {
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  };

  const [enquiries, artists, unread] = await Promise.all([
    prisma.enquiry.findMany({
      where: owner ? {} : artistInboxWhere(user.artistId ?? "__none__"),
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    unreadCountsFor(viewer),
  ]);

  // One query for every thread on screen — no per-enquiry reads.
  const threads = await listThreadsFor(enquiries.map((e) => e.id));
  const unreadIds = new Set(unread.enquiryIds);
  const artistName = new Map(artists.map((a) => [a.id, a.name]));

  const toThreadItems = (enquiryId: string): ThreadItem[] =>
    (threads.get(enquiryId) ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      channel: m.channel,
      authorName: m.authorName,
      fromName: m.fromName,
      subject: m.subject,
      bodyText: m.bodyText,
      deliveryStatus: m.deliveryStatus,
      createdAtISO: m.createdAt.toISOString(),
      attachments: m.attachments.map((a) => ({
        id: a.id,
        mime: a.mime,
        size: a.size,
        filename: a.filename,
        url: a.url,
        hasBytes: a.hasBytes,
      })),
    }));

  const items: EnquiryItem[] = enquiries.map((e) => ({
    id: e.id,
    contactName: e.contactName,
    contactEmail: e.contactEmail,
    subject: e.subject,
    style: e.style,
    placement: e.placement,
    size: e.size,
    budgetPence: e.budgetPence,
    description: e.description,
    moodboard: e.moodboard,
    moodboardData: parseMoodboardData(e.moodboardData),
    status: e.status,
    source: e.source,
    channel: e.channel,
    preferredArtistId: e.preferredArtistId,
    preferredArtistName: e.preferredArtistId
      ? (artistName.get(e.preferredArtistId) ?? null)
      : null,
    createdAtISO: e.createdAt.toISOString(),
    lastMessageAtISO: e.lastMessageAt?.toISOString() ?? null,
    unread: unreadIds.has(e.id),
    thread: toThreadItems(e.id),
  }));

  const artistOptions: ArtistOption[] = owner
    ? artists
    : artists.filter((a) => a.id === user.artistId);

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Enquiries
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Inbound leads — read the thread, reply, leave a note, assign an artist,
        or convert to a booking.
      </p>
      <div className="mt-8">
        <EnquiryInbox
          items={items}
          artists={artistOptions}
          canConvert={owner || Boolean(user.artistId)}
          viewerArtistId={owner ? null : (user.artistId ?? null)}
          showAssignedPill={owner}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Inbox — tabs, pill, unread dot, thread, note composer**

In `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx`:

1. Imports: replace `isOpenBoard` with `isUnassigned`, drop `type ThreadEntry`, drop `ThreadSection` from the `EnquiryDetailSections` import, and add:
```tsx
import type { EnquiryChannel } from "@prisma/client";
import { EnquiryThread, type ThreadItem } from "./EnquiryThread";
import { addInternalNote, markEnquiryRead } from "./actions";
```
2. `EnquiryItem`: add `subject: string | null;`, `channel: EnquiryChannel;`, `preferredArtistName: string | null;`, `lastMessageAtISO: string | null;`, `unread: boolean;` and change `thread: ThreadEntry[]` to `thread: ThreadItem[]`.
3. Tabs: `const STATUS_ORDER: EnquiryStatus[] = ["new", "customer_replied", "replied", "converted", "closed"];`
4. Add a channel label map next to `SOURCE_LABEL`:
```tsx
const CHANNEL_BADGE: Record<EnquiryChannel, string> = {
  web: "Web",
  flash: "Flash",
  inkling: "Mood board",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};
```
and use `CHANNEL_BADGE[item.channel]` in place of `SOURCE_LABEL[item.source]` on the row (keep `SOURCE_LABEL` for the source filter items).
5. `EnquiryInbox` props gain `showAssignedPill: boolean` and pass it plus `viewerArtistId` down to `EnquiryRow`.
6. Row trigger — unread dot, assigned pill, activity time:
```tsx
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium text-text-primary">
            {item.unread && (
              <span
                className="size-2 shrink-0 rounded-full bg-bb-crimson"
                aria-label="Unread"
              />
            )}
            {item.contactName}
          </span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{CHANNEL_BADGE[item.channel]}</Badge>
            {showAssignedPill && (
              <Badge variant={item.preferredArtistName ? "secondary" : "default"}>
                {item.preferredArtistName ?? "Unassigned"}
              </Badge>
            )}
            {!showAssignedPill && isUnassigned(item) && <Badge>Unassigned</Badge>}
            <span className="text-xs text-text-muted">
              {formatDateTime(item.lastMessageAtISO ?? item.createdAtISO)}
            </span>
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-text-muted">
          {item.subject ??
            ([item.style, item.placement, item.size].filter(Boolean).join(" · ") ||
              "No brief")}
          {item.budgetPence != null
            ? ` · budget ${formatPence(item.budgetPence)}`
            : ""}
        </p>
```
7. Mark read on open — replace the `Dialog` wrapper's handler:
```tsx
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && item.unread) void markEnquiryRead(item.id);
      }}
    >
```
8. Replace `<ThreadSection thread={item.thread} />` with `<EnquiryThread items={item.thread} />`.
9. Replace the three remaining `isOpenBoard(item)` uses with `isUnassigned(item)`, and change the copy: the button reads **"Take this enquiry"**, the reply label reads `"Reply (emails customer — responding to an unassigned enquiry assigns it to you)"`.
10. Add a note composer directly under the Reply section (new state `const [note, setNote] = useState("");`):
```tsx
        {/* Internal note */}
        <section className="space-y-2">
          <Label htmlFor={`note-${item.id}`}>
            Internal note (staff only — never sent)
          </Label>
          <Textarea
            id={`note-${item.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context for whoever picks this up…"
          />
          <Button
            variant="outline"
            disabled={pending || !note.trim()}
            onClick={() =>
              run(async () => {
                const res = await addInternalNote(item.id, { body: note });
                if (res.ok) setNote("");
                return res;
              })
            }
          >
            Add note
          </Button>
        </section>
```
11. `run()` currently closes the dialog on success — keep it, but let the note stay open by returning early:
```tsx
  function run(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    opts: { close?: boolean } = { close: true },
  ) {
    start(async () => {
      const res = await fn();
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok && opts.close !== false) setOpen(false);
    });
  }
```
and call the note action with `run(..., { close: false })`.

In `apps/admin/src/app/(staff)/enquiries/EnquiryDetailSections.tsx`, delete `ThreadSection` and the now-unused `formatDateTime` / `ThreadEntry` imports.

- [ ] **Step 5: Update the component tests**

In `EnquiryInbox.test.tsx`:
- extend the `./actions` mock with `addInternalNote: vi.fn(), markEnquiryRead: vi.fn()`;
- give both fixture items the new fields (`subject: "ladybird"` / `null`, `channel: "web"` / `"flash"`, `preferredArtistName: null`, `lastMessageAtISO: null`, `unread: false`) and change `thread` to the `ThreadItem` shape (`[]` is fine for the second item; for the first use one inbound item matching `ThreadItem`);
- pass `showAssignedPill={false}` in the render;
- add a case:
```tsx
it("shows an unread dot and the assigned-artist pill for owners", () => {
  const html = renderToStaticMarkup(
    <EnquiryInbox
      items={[{ ...items[0], unread: true, preferredArtistName: "Sarah North" }]}
      artists={[{ id: "a1", name: "Sarah North" }]}
      canConvert
      viewerArtistId={null}
      showAssignedPill
    />,
  );
  expect(html).toContain('aria-label="Unread"');
  expect(html).toContain("Sarah North");
});

it("labels an unassigned enquiry for owners", () => {
  const html = renderToStaticMarkup(
    <EnquiryInbox
      items={[{ ...items[1], preferredArtistId: null, preferredArtistName: null }]}
      artists={[]}
      canConvert
      viewerArtistId={null}
      showAssignedPill
    />,
  );
  expect(html).toContain("Unassigned");
});
```

In `EnquiryDetailSections.test.tsx`: remove `ThreadSection` from the import and delete its three assertions (`typeof ThreadSection`, the empty-thread null, the non-empty markup) plus the now-unused `ThreadEntry` import and `thread` fixture.

- [ ] **Step 6: Nav unread badge**

`apps/admin/src/app/(staff)/layout.tsx`:

```tsx
import { AppShell } from "@/components/admin/AppShell";
import { requireRole } from "@bnb/core/auth";
import { unreadCountsFor } from "@bnb/core/services/enquiry-messages";
import type { AdminRole } from "@/lib/admin-nav";

/**
 * Staff PWA shell — (admin) route group. Every back-of-house screen requires a
 * signed-in staff user (requireRole redirects to /sign-in otherwise). The
 * session role (OWNER/ARTIST) is mapped to the AppShell's AdminRole so nav is
 * correctly scoped per user, and the unread enquiry count (scoped the same
 * way) drives the Enquiries badge.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole();
  const role: AdminRole = user.role === "OWNER" ? "owner" : "artist";
  const unread = await unreadCountsFor({
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  });
  return (
    <AppShell role={role} enquiriesUnread={unread.total}>
      {children}
    </AppShell>
  );
}
```

`apps/admin/src/components/admin/AppShell.tsx`:
- imports: `import { useEffect, useState } from "react";` and `import { usePathname, useRouter } from "next/navigation";`
- signature:
```tsx
export function AppShell({
  role = "owner",
  enquiriesUnread = 0,
  children,
}: {
  role?: AdminRole;
  /** Unread enquiry threads for this user — badged on the Enquiries item. */
  enquiriesUnread?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Keep the unread badge honest without a socket: the same 60 s refresh the
  // kiosk board uses. force-dynamic pages re-render server-side on refresh.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);
```
- add a small badge component below the file's imports:
```tsx
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="grid min-w-5 place-items-center rounded-full bg-bb-crimson px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
      aria-label={`${count} unread enquiries`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
```
- render it in all three nav surfaces, keyed off `item.id === "enquiries"`:
  - sidebar link, between `<span className="flex-1">{item.label}</span>` and the `ownerOnly` crown: `{item.id === "enquiries" && <UnreadBadge count={enquiriesUnread} />}`
  - bottom-nav link: wrap the label in `<span className="flex items-center gap-1">{item.label}{item.id === "enquiries" && <UnreadBadge count={enquiriesUnread} />}</span>`
  - "More" sheet tile: add the same inside the existing `<span className="flex items-center gap-1">`.

`apps/admin/src/components/admin/AppShell.test.tsx`:
- extend the navigation mock: `vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: vi.fn() }) }));`
- add:
```tsx
describe("AppShell unread badge", () => {
  it("badges the Enquiries nav item only when there is something unread", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const none = renderToStaticMarkup(<AppShell role="owner">{null}</AppShell>);
    expect(none).not.toContain("unread enquiries");
    const some = renderToStaticMarkup(
      <AppShell role="owner" enquiriesUnread={4}>
        {null}
      </AppShell>,
    );
    expect(some).toContain("4 unread enquiries");
  });
});
```

- [ ] **Step 7: Full verification**

```bash
npm test -w @bnb/admin
npm test
npm run lint
npx tsc --noEmit -p apps/admin && npx tsc --noEmit -p apps/web && npx tsc --noEmit -p apps/reception
npm run build -w @bnb/admin && npm run build -w @bnb/web
npx prettier --check "packages/core/src/**" "apps/admin/src/app/(staff)/enquiries/**" "apps/admin/src/components/admin/AppShell.tsx" scripts docs/superpowers
```
All green; fix formatting with `npx prettier --write <paths>` if needed.

Manual pass (`npm run dev:admin`, sign in with `npm run admin:link` if needed):
1. As **owner**: every row shows a channel badge and an assigned-artist pill (or "Unassigned"); the tabs read New / Customer replied / Replied / Converted / Closed; open an enquiry and the thread shows the original web enquiry as an inbound bubble plus the ack as outbound.
2. Submit a fresh enquiry on the web app; the nav badge increments within 60 s, the row shows the unread dot, and opening the dialog clears both.
3. Reply — the reply appears as an outbound bubble and the status becomes Replied.
4. Add an internal note — it renders muted, full width, and the dialog stays open.
5. As an **artist**: an unassigned enquiry on any channel is visible with "Unassigned" and "Take this enquiry"; "Close enquiry" on an unassigned enquiry is refused with the assigned-artist message; after taking it, closing works.

- [ ] **Step 8: Commit**

```bash
git add "apps/admin/src/app/(staff)/enquiries" "apps/admin/src/app/(staff)/layout.tsx" apps/admin/src/components/admin/AppShell.tsx apps/admin/src/components/admin/AppShell.test.tsx
git commit -m "feat(admin): enquiry thread view, customer-replied tab, assigned pill, internal notes and unread badge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

## Build log entry (append to `docs/PROJECT-BRIEF.md` after the last entry)

```
## Enquiries omnichannel — Phase 1: identity + threads (2026-09-07) — DONE
Every enquiry now has a real message thread and every customer a unique identity. Schema: EnquiryChannel/MessageDirection/MessageChannelKind enums, `customer_replied` status, per-enquiry `threadToken` + activity timestamps, and EnquiryMessage / Attachment / EnquiryRead / CustomerIdentity tables. `scripts/merge-duplicate-customers.ts` (idempotent, `--dry-run`) collapsed duplicate customers before `Customer.email`/`phone` became unique; `@bnb/core/services/contact-identity` normalises email + GB phone (libphonenumber-js) behind `findOrCreateCustomer`/`linkIdentity`. `enquiry-threading` implements token → 30-day open thread → new enquiry (closed threads are never reopened); `enquiry-messages` records inbound/outbound/notes, read markers and unread counts; `assets` stores attachment bytes served by the staff-gated admin `/api/attachments/[id]`. Web forms create the first inbound message via `createEnquiry`; `sendEmail` takes an optional `enquiryId`. Admin: chronological thread view replaces the flat MessageLog history, artists see their own + ALL unassigned enquiries (owners get an assigned-artist pill), artists may close only their own, internal notes, a Customer replied tab and an unread badge in the nav. Email + Meta channels are Phases 2–3. Spec: `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md`.
```

Commit with the standard trailer, staging only `docs/PROJECT-BRIEF.md`.

---

## Self-review notes

**Spec coverage (Phasing → phase 1)**

| Spec item | Task |
| --- | --- |
| `EnquiryChannel`, `customer_replied`, `MessageDirection`, `MessageChannelKind` | 2 |
| `Enquiry` additions (channel, subject, threadToken, lastMessageAt, lastInboundAt, assignedAt) | 2 |
| `EnquiryMessage`, `Attachment`, `EnquiryRead`, `CustomerIdentity` | 2 |
| Unique `Customer.email` / `Customer.phone` | 5 |
| Customer merge data migration (idempotent, `--dry-run`, before the unique indexes) | 4 |
| `contact-identity.ts` — normaliseEmail / normalisePhone (libphonenumber-js, GB) / findOrCreateCustomer / linkIdentity | 1, 3 |
| `enquiry-threading.ts` — `resolveThread` | 6 |
| `enquiry-messages.ts` — recordInbound / recordOutbound / recordNote / listThread / markRead / unreadCountsFor | 8 |
| `assets.ts` — storeAttachment / getAttachment + admin `/api/attachments/[id]` | 7 |
| Web forms create the first inbound web message via `findOrCreateCustomer` | 9 |
| `replyToEnquiry` still uses `sendEmail`, which gains `enquiryId` and records an outbound `EnquiryMessage` | 9, 10 |
| Admin thread view replaces the flat message history | 11 |
| Visibility generalised (artists: own + ALL unassigned, flagged Unassigned; owners: all + assigned pill) | 10, 11 |
| Close authorisation fix (artists close only their own) | 10 |
| Unread badge in the staff nav | 8, 11 |
| `addInternalNote` + `markEnquiryRead` actions | 10 |
| Status tabs including "Customer replied" | 10, 11 |
| Explicitly deferred: Resend inbound webhook, Meta channels, `ChannelConnection`, `secrets.ts`, Channels settings panel, CustomerTimeline message entries + identity chips, `?open=` deep links, full `EnquiryInbox` split | Phases 2–4 |

**Placeholder scan:** grepped the plan for `TBD`, `similar to`, `as above`, `etc.`, `add validation`, `…the rest`, `<your` — no hits. Every function a later task consumes appears with its exact signature in an earlier task's Interfaces block (`normaliseEmail`/`normalisePhone` → T1; `findOrCreateCustomer`/`linkIdentity`/`isUniqueViolation` → T3; `DuplicateContactError` → T5; `chooseThread`/`resolveThread`/`sourceForChannel` → T6; `storeAttachment`/`getAttachment`/`listAttachmentsFor`/`StoreAttachmentInput`/`AttachmentMeta` → T7; `visibleEnquiryWhere`/`recordInbound`/`recordOutbound`/`recordNote`/`listThread`/`listThreadsFor`/`markRead`/`unreadCountsFor`/`InboxViewer`/`ThreadMessageRow` → T8; `channelForSource`/`enquiryBriefText`/`enquirySubject` → T9; `isUnassigned`/`canCloseEnquiry`/`attachmentHref`/`countByStatus`/`addInternalNote`/`markEnquiryRead` → T10; `ThreadItem`/`EnquiryThread`/`CHANNEL_LABEL` → T11).

**Type-name consistency:** `InboxViewer`, `ThreadMessageRow`, `ThreadAttachment` and `UnreadCounts` come from `enquiry-messages.ts`; `AttachmentMeta`/`StoreAttachmentInput` from `assets.ts` (`ThreadAttachment` is an alias of `AttachmentMeta`, declared once); `ThreadCandidate`/`ThreadChoice`/`ResolveThreadInput`/`ResolvedThread` from `enquiry-threading.ts`; `MergeCandidate`/`MergeGroup`/`MergedFields`/`MergeReport` from `customer-merge.ts`; `FindOrCreateCustomerInput`/`ContactIdentityInput`/`IdentityChannel`/`DuplicateContactError` from `contact-identity.ts`; the client-side serialised `ThreadItem`/`ThreadAttachmentItem` live only in `EnquiryThread.tsx` and are distinct from the server `ThreadMessageRow`/`ThreadAttachment` on purpose (Dates vs ISO strings). The old `ThreadEntry`/`ThreadMessage`/`buildThreadMap` names are deleted in T10 and every consumer (`page.tsx`, `EnquiryInbox.tsx`, `EnquiryDetailSections.tsx` and their tests) is updated in T10/T11 — no dangling references.

**Issues found and fixed while reviewing:**
- The first draft added `threadToken` with `prisma migrate dev`; that fails on a table with existing rows (required unique column, client-side cuid default). T2 now ships `--create-only` plus the exact backfill SQL.
- The first draft had `recordOutbound` set `status = "replied"`. That would have made `createEnquiry`'s automatic ack mark a brand-new enquiry as replied, so status changes stay with the caller and the contract is spelled out in T8.
- `unreadCountsFor` originally tried to compare `EnquiryRead.readAt` against the parent `Enquiry.lastInboundAt` inside a Prisma relation filter, which Prisma cannot express; it now filters in JS over a bounded (500-row) fetch.
- `upsertCustomerByContact` is also called by `services/reception.ts`, and `createCustomer` / `updateCustomer` / `createCustomerWithWelcome` write contact fields directly — all four would have started throwing raw P2002s once the unique indexes landed. T3 and T5 route them through the normalising path and translate P2002 into `DuplicateContactError`.
- `EnquiryInbox.tsx` is 447 lines today; the thread, tabs, pill, unread dot and note composer would push it past ~550, so `EnquiryThread.tsx` is extracted in this phase as the brief allows. The remaining component split stays in Phase 4.
- T7's "oversize" attachment case originally passed a tiny buffer and asserted the opposite of what it claimed; it now allocates `MAX_INLINE_ATTACHMENT_BYTES + 1` and asserts `hasBytes === false`.
- T9's new `describe` block referenced the `customers` / `enquiries` cleanup arrays that are scoped to the existing `describe("createEnquiry (DB + mocked email)")` block; it now declares its own arrays and `afterAll`.

**Ambiguities resolved (also listed in the hand-off):**
1. The spec's merge list includes `Session`; this schema's `Session` hangs off `Booking`, not `Customer`, so it is not re-pointed (T4).
2. A token match onto a `closed`/`converted` enquiry does **not** reopen it — "closed/converted are never reopened" wins over "token match first" (T6).
3. New enquiries from non-form channels have no `EnquirySource` value; `source` records the neutral `web` and `channel` carries the truth (`sourceForChannel`, T6).
4. Unread counts exclude `converted`/`closed` threads so the badge only ever counts actionable work (T8).
5. `packages/core/package.json` needs no new export entries — the existing `"./services/*"` wildcard already resolves every new module.
