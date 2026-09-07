# Inkling Mood Board Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Inkling "Mood Board" tab with a four-step builder (Brief → Inspiration → Details → Send) that searches images for the visitor's brief, lets them pick / upload / paste images onto a board, and sends the board as an Inkling enquiry that owners and artists review and respond to in the admin inbox.

**Architecture:** Image search and studio-gallery matching live in `@bnb/core` behind a provider interface (Google Programmable Search), called by a new public `POST /api/inkling/search`. Uploaded/pasted images are stored as bytes in a new `MoodboardAsset` Postgres table and served by `GET /api/inkling/assets/[id]` on the web origin. The rich board is stored in `Enquiry.moodboardData` (JSON) while `Enquiry.moodboard[]` keeps display URLs so the existing admin thumbnails keep working. Artists gain visibility of unassigned Inkling boards and can claim them by replying.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 7 (Postgres), zod 4, vitest 4 (`renderToStaticMarkup` for components, `testdb` harness for DB suites), plain CSS modules (web), shadcn/ui + Tailwind (admin).

**Spec:** `docs/superpowers/specs/2026-09-07-inkling-moodboard-builder-design.md`

## Global Constraints

- Node 22, npm workspaces. Run web tests with `npm test -w @bnb/web`, admin with `npm test -w @bnb/admin`, core with `npm test -w @bnb/core`. Dev Postgres is `docker compose up -d` (port 5435); DB suites skip when unreachable.
- Load env for CLI work with `set -a && . ./.env && set +a` from the repo root.
- Web app uses plain CSS classes from `site.css` (`btn`, `chip`, `field`, `input`, `textarea`, `select`, `meta`, `eyebrow`) plus CSS modules; `<img>` with an eslint-disable comment, never `next/image`.
- No `@bnb/core/auth` imports in `apps/web` (a guard test enforces it).
- All public POST routes are rate-limited via `createRateLimiter` + `clientIp` from `apps/web/src/lib/rate-limit.ts` and use `json` / `jsonError` / `parseBody` / `handleApiError` from `@bnb/core/http`.
- Max board items: 12. Max styles: 3. Upload cap: 5 MB. Accepted image types: png, jpeg, webp, gif, avif (magic-number sniffed).
- Env vars: `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` (optional; feature degrades without them).
- Commit after every task with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
  ```
- Do not stage `docs/plans/2026-07-29-artist-showcase-screen.md` or `.superpowers/` (pre-existing unrelated changes).

---

## File map

| Path | Responsibility |
| --- | --- |
| `packages/core/src/uploads.ts` (+test) | `sniffImageMime`, `IMAGE_EXT_BY_MIME` shared by admin + web upload routes |
| `packages/core/prisma/schema.prisma` + migration | `Enquiry.moodboardData`, `MoodboardAsset` |
| `packages/core/src/services/moodboard-data.ts` (+test) | client-safe zod schema + `parseMoodboardData` + `finaliseMoodboardData` |
| `packages/core/src/services/moodboard-assets.ts` (+test) | asset create/get/attach/purge |
| `packages/core/src/cron/moodboard-assets.ts` (+test) | `runMoodboardAssetPurge` job |
| `packages/core/src/services/enquiries.ts` | accepts `moodboardData` + `assetIds` |
| `packages/core/src/services/image-search.ts` (+test) | query builder, Google CSE provider, studio matches, `searchInspiration` + cache |
| `apps/web/src/app/api/inkling/{search,uploads,assets/[id]}/route.ts` (+tests) | public API |
| `apps/web/src/app/api/enquiries/route.ts` (+test) | accepts + finalises `moodboardData` |
| `apps/web/src/app/inkling/moodboard/logic.ts` (+test) | builder state, gating, payload |
| `apps/web/src/app/inkling/moodboard/image-prep.ts` (+test) | client downscale helper |
| `apps/web/src/app/inkling/moodboard/*.tsx` + `moodboard.module.css` | builder UI |
| `apps/web/src/app/inkling/{page,InklingTabs}.tsx`, `apps/web/src/app/page.tsx` | wiring + teaser copy |
| `apps/admin/src/app/(staff)/enquiries/*` | scope, claim, filters, board detail |
| env examples, `docker-compose.prod.yml`, `docs/DEPLOY.md`, `docs/PROJECT-BRIEF.md` | config + docs |

---

### Task 1: Shared image sniffing in `@bnb/core/uploads`

**Files:**
- Create: `packages/core/src/uploads.ts`, `packages/core/src/uploads.test.ts`
- Modify: `packages/core/package.json` (exports), `apps/admin/src/app/api/uploads/route.ts`

**Interfaces:**
- Produces: `sniffImageMime(buf: Uint8Array): string | null`, `IMAGE_EXT_BY_MIME: Record<string, string>`, `isAllowedImageMime(mime: string): boolean`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/uploads.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { IMAGE_EXT_BY_MIME, isAllowedImageMime, sniffImageMime } from "./uploads";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = new TextEncoder().encode("GIF89a......");
const WEBP = new Uint8Array([
  ...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP"),
]);
const AVIF = new Uint8Array([
  0, 0, 0, 0x1c, ...new TextEncoder().encode("ftypavif"), 0, 0, 0, 0,
]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

describe("sniffImageMime", () => {
  it.each([
    ["png", PNG, "image/png"],
    ["jpeg", JPEG, "image/jpeg"],
    ["gif", GIF, "image/gif"],
    ["webp", WEBP, "image/webp"],
    ["avif", AVIF, "image/avif"],
  ])("detects %s", (_n, bytes, mime) => {
    expect(sniffImageMime(bytes)).toBe(mime);
  });
  it("rejects svg / text / empty", () => {
    expect(sniffImageMime(SVG)).toBeNull();
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });
  it("maps allowed mimes to extensions", () => {
    expect(IMAGE_EXT_BY_MIME["image/jpeg"]).toBe("jpg");
    expect(isAllowedImageMime("image/svg+xml")).toBe(false);
    expect(isAllowedImageMime("image/webp")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/uploads.test.ts`
Expected: FAIL — cannot find module `./uploads`.

- [ ] **Step 3: Implement**

`packages/core/src/uploads.ts`:

```ts
/**
 * Shared image-upload validation for the admin CMS uploader and the public
 * Inkling mood-board uploader. Raster formats only — SVG is XML and can carry
 * scripts, so it is never accepted. The authoritative check is the
 * magic-number sniff; client-supplied `file.type` is only a cheap pre-filter.
 */

export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function isAllowedImageMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(IMAGE_EXT_BY_MIME, mime);
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

/** Sniff the real image format from leading bytes; null when not an allowed raster. */
export function sniffImageMime(buf: Uint8Array): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 6 && ascii(buf, 0, 3) === "GIF") return "image/gif";
  if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp" && /avif|avis/.test(ascii(buf, 8, 12))) {
    return "image/avif";
  }
  return null;
}
```

Add to `packages/core/package.json` `exports`: `"./uploads": "./src/uploads.ts",` (after `"./utils"`).

In `apps/admin/src/app/api/uploads/route.ts`: delete the local `EXT_BY_MIME` and `sniffImageMime`, add `import { IMAGE_EXT_BY_MIME, sniffImageMime } from "@bnb/core/uploads";`, replace `EXT_BY_MIME[...]` with `IMAGE_EXT_BY_MIME[...]` (two uses). Keep the 8 MB cap and `sniffed !== file.type` check.

- [ ] **Step 4: Run tests**

Run: `npm test -w @bnb/core -- src/uploads.test.ts && npm test -w @bnb/admin -- src/app/api/uploads`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/uploads.ts packages/core/src/uploads.test.ts packages/core/package.json apps/admin/src/app/api/uploads/route.ts
git commit -m "refactor(core): share image magic-number sniffing via @bnb/core/uploads"
```

---

### Task 2: Schema — `Enquiry.moodboardData` + `MoodboardAsset`; board-data helpers

**Files:**
- Modify: `packages/core/prisma/schema.prisma` (Enquiry model ~line 269)
- Create: `packages/core/prisma/migrations/20260907120000_moodboard_builder/migration.sql`
- Create: `packages/core/src/services/moodboard-data.ts`, `packages/core/src/services/moodboard-data.test.ts`

**Interfaces:**
- Produces (client-safe, zod only, no prisma import):
  ```ts
  export type BoardItemKind = "web" | "studio" | "upload" | "link";
  export type BoardColour = "bw" | "colour" | "either";
  export interface MoodboardItem { kind: BoardItemKind; url: string; thumbUrl: string|null; sourceUrl: string|null; title: string|null; assetId: string|null; galleryItemId: string|null }
  export interface MoodboardData { version: 1; styles: string[]; colour: BoardColour|null; description: string; query: string|null; notes: string|null; items: MoodboardItem[] }
  export const moodboardDataSchema: z.ZodType<MoodboardData>  // input shape has defaults
  export const MAX_BOARD_ITEMS = 12;
  export function parseMoodboardData(json: unknown): MoodboardData | null
  export function assetUrl(origin: string, assetId: string): string  // `${origin}/api/inkling/assets/${assetId}`
  export function finaliseMoodboardData(data: MoodboardData, origin: string): { data: MoodboardData; urls: string[]; assetIds: string[] }
  ```

- [ ] **Step 1: Schema + migration**

In `schema.prisma`, inside `model Enquiry` add after `matchData Json?`:
```prisma
  moodboardData     Json?
```
and after `bookings        Booking[]`:
```prisma
  moodboardAssets MoodboardAsset[]
```
Add a new model after `Enquiry`:
```prisma
model MoodboardAsset {
  id        String   @id @default(cuid())
  enquiryId String?
  mime      String
  size      Int
  bytes     Bytes
  createdAt DateTime @default(now())

  enquiry Enquiry? @relation(fields: [enquiryId], references: [id], onDelete: Cascade)

  @@index([enquiryId])
  @@index([createdAt])
}
```

Generate the migration against the dev DB:
```bash
set -a && . ./.env && set +a && npm -w @bnb/core run db:migrate -- --name moodboard_builder
```
If `migrate dev` is unavailable, create `packages/core/prisma/migrations/20260907120000_moodboard_builder/migration.sql` by hand:
```sql
-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN "moodboardData" JSONB;

-- CreateTable
CREATE TABLE "MoodboardAsset" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MoodboardAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoodboardAsset_enquiryId_idx" ON "MoodboardAsset"("enquiryId");
CREATE INDEX "MoodboardAsset_createdAt_idx" ON "MoodboardAsset"("createdAt");

-- AddForeignKey
ALTER TABLE "MoodboardAsset" ADD CONSTRAINT "MoodboardAsset_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
then apply with `npm -w @bnb/core run db:migrate` and regenerate with `npm run db:generate`.

Verify: `npx prisma validate --schema=packages/core/prisma/schema.prisma` prints OK and `npm run db:generate` succeeds.

- [ ] **Step 2: Write the failing helper test**

`packages/core/src/services/moodboard-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assetUrl,
  finaliseMoodboardData,
  parseMoodboardData,
  type MoodboardData,
} from "./moodboard-data";

const base: MoodboardData = {
  version: 1,
  styles: ["Fine-line"],
  colour: "bw",
  description: "peony on the forearm",
  query: "peony on the forearm fine-line black and grey tattoo",
  notes: null,
  items: [
    { kind: "web", url: "https://img.example/a.jpg", thumbUrl: "https://img.example/t.jpg", sourceUrl: "https://page.example/a", title: "Peony", assetId: null, galleryItemId: null },
    { kind: "studio", url: "/uploads/gallery/snake.jpg", thumbUrl: null, sourceUrl: "/gallery", title: "Snake", assetId: null, galleryItemId: "g1" },
    { kind: "upload", url: "blob:whatever", thumbUrl: null, sourceUrl: null, title: null, assetId: "asset1", galleryItemId: null },
    { kind: "upload", url: "", thumbUrl: null, sourceUrl: null, title: null, assetId: null, galleryItemId: null },
  ],
};

describe("parseMoodboardData", () => {
  it("returns null for null / garbage / wrong version", () => {
    expect(parseMoodboardData(null)).toBeNull();
    expect(parseMoodboardData("x")).toBeNull();
    expect(parseMoodboardData({ version: 2, items: [] })).toBeNull();
  });
  it("fills defaults for a minimal valid object", () => {
    const d = parseMoodboardData({ version: 1, items: [{ kind: "link", url: "https://x.test/a.png" }] });
    expect(d).not.toBeNull();
    expect(d!.styles).toEqual([]);
    expect(d!.items[0].thumbUrl).toBeNull();
  });
  it("rejects more than 12 items", () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ kind: "link", url: `https://x.test/${i}.png` }));
    expect(parseMoodboardData({ version: 1, items })).toBeNull();
  });
});

describe("finaliseMoodboardData", () => {
  const origin = "https://bootsnbandit.example";
  it("rewrites upload urls, absolutises relative urls, drops uploads without an asset", () => {
    const out = finaliseMoodboardData(base, origin);
    expect(out.data.items).toHaveLength(3);
    expect(out.data.items[1].url).toBe(`${origin}/uploads/gallery/snake.jpg`);
    expect(out.data.items[1].sourceUrl).toBe(`${origin}/gallery`);
    expect(out.data.items[2].url).toBe(assetUrl(origin, "asset1"));
    expect(out.urls).toEqual(out.data.items.map((i) => i.url));
    expect(out.assetIds).toEqual(["asset1"]);
  });
  it("strips a trailing slash from the origin", () => {
    expect(assetUrl("https://x.test/", "a")).toBe("https://x.test/api/inkling/assets/a");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -w @bnb/core -- src/services/moodboard-data.test.ts` — FAIL (module missing).

- [ ] **Step 4: Implement**

`packages/core/src/services/moodboard-data.ts`:

```ts
import { z } from "zod";

/**
 * The rich Inkling mood board stored in `Enquiry.moodboardData`. Client-safe
 * (zod only — imported by admin client components and the web builder), so
 * NO prisma imports here.
 */

export const BOARD_ITEM_KINDS = ["web", "studio", "upload", "link"] as const;
export type BoardItemKind = (typeof BOARD_ITEM_KINDS)[number];

export const BOARD_COLOURS = ["bw", "colour", "either"] as const;
export type BoardColour = (typeof BOARD_COLOURS)[number];

export const MAX_BOARD_ITEMS = 12;

const url = z.string().max(2048);

export const moodboardItemSchema = z.object({
  kind: z.enum(BOARD_ITEM_KINDS),
  url,
  thumbUrl: url.nullable().default(null),
  sourceUrl: url.nullable().default(null),
  title: z.string().max(200).nullable().default(null),
  assetId: z.string().max(64).nullable().default(null),
  galleryItemId: z.string().max(64).nullable().default(null),
});

export const moodboardDataSchema = z.object({
  version: z.literal(1),
  styles: z.array(z.string().max(60)).max(5).default([]),
  colour: z.enum(BOARD_COLOURS).nullable().default(null),
  description: z.string().max(1000).default(""),
  query: z.string().max(300).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  items: z.array(moodboardItemSchema).max(MAX_BOARD_ITEMS),
});

export type MoodboardItem = z.output<typeof moodboardItemSchema>;
export type MoodboardData = z.output<typeof moodboardDataSchema>;
export type MoodboardDataInput = z.input<typeof moodboardDataSchema>;

/** Tolerant parse for DB rows: null / old rows / garbage → null, never throws. */
export function parseMoodboardData(json: unknown): MoodboardData | null {
  const r = moodboardDataSchema.safeParse(json);
  return r.success ? r.data : null;
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function assetUrl(origin: string, assetId: string): string {
  return `${trimOrigin(origin)}/api/inkling/assets/${assetId}`;
}

function absolutise(u: string | null, origin: string): string | null {
  if (!u) return u;
  return u.startsWith("/") ? `${trimOrigin(origin)}${u}` : u;
}

/**
 * Server-side normalisation before persisting: upload items get their public
 * asset URL, relative (studio) URLs become absolute so the admin origin can
 * render them, uploads without an asset are dropped. Returns the display URL
 * list for `Enquiry.moodboard[]` and the asset ids to attach.
 */
export function finaliseMoodboardData(
  data: MoodboardData,
  origin: string,
): { data: MoodboardData; urls: string[]; assetIds: string[] } {
  const items: MoodboardItem[] = [];
  const assetIds: string[] = [];
  for (const item of data.items) {
    if (item.kind === "upload") {
      if (!item.assetId) continue;
      if (!assetIds.includes(item.assetId)) assetIds.push(item.assetId);
      items.push({ ...item, url: assetUrl(origin, item.assetId), thumbUrl: null });
      continue;
    }
    items.push({
      ...item,
      url: absolutise(item.url, origin) as string,
      thumbUrl: absolutise(item.thumbUrl, origin),
      sourceUrl: absolutise(item.sourceUrl, origin),
    });
  }
  return { data: { ...data, items }, urls: items.map((i) => i.url), assetIds };
}
```

- [ ] **Step 5: Run tests, commit**

Run: `npm test -w @bnb/core -- src/services/moodboard-data.test.ts` — PASS.

```bash
git add packages/core/prisma packages/core/src/services/moodboard-data.ts packages/core/src/services/moodboard-data.test.ts
git commit -m "feat(core): moodboardData on Enquiry + MoodboardAsset table; board-data schema helpers"
```

---

### Task 3: Asset service, cron purge, enquiry attach

**Files:**
- Create: `packages/core/src/services/moodboard-assets.ts` (+ `.test.ts`), `packages/core/src/cron/moodboard-assets.ts` (+ `.test.ts`)
- Modify: `packages/core/src/services/enquiries.ts`, `packages/core/src/services/enquiries.test.ts`, `packages/core/src/cron/index.ts`, `packages/core/src/services/index.ts`

**Interfaces:**
- Produces:
  ```ts
  createMoodboardAsset(input: { bytes: Uint8Array; mime: string }): Promise<{ id: string; mime: string; size: number }>
  getMoodboardAsset(id: string): Promise<{ id: string; mime: string; size: number; bytes: Uint8Array } | null>
  attachMoodboardAssets(enquiryId: string, assetIds: string[]): Promise<number>
  purgeOrphanMoodboardAssets(olderThan: Date): Promise<number>
  runMoodboardAssetPurge(now?: Date): Promise<CronJobResult>   // job: "moodboard_asset_purge", sent = deleted count
  CreateEnquiryInput gains: moodboardData?: Prisma.InputJsonValue | null; assetIds?: string[]
  ```

- [ ] **Step 1: Failing service test**

`packages/core/src/services/moodboard-assets.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  attachMoodboardAssets,
  createMoodboardAsset,
  getMoodboardAsset,
  purgeOrphanMoodboardAssets,
} from "./moodboard-assets";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("moodboard assets (DB)", () => {
  const assetIds: string[] = [];
  const enquiryIds: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (assetIds.length) await db().moodboardAsset.deleteMany({ where: { id: { in: assetIds } } });
      if (enquiryIds.length) await db().enquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    }
    await closeTestDb();
  });

  it("stores and reads back bytes + mime", async () => {
    if (!(await dbReachable())) return;
    const created = await createMoodboardAsset({ bytes: PNG, mime: "image/png" });
    assetIds.push(created.id);
    expect(created.size).toBe(PNG.length);
    const got = await getMoodboardAsset(created.id);
    expect(got?.mime).toBe("image/png");
    expect(Array.from(got!.bytes)).toEqual(Array.from(PNG));
    expect(await getMoodboardAsset("nope")).toBeNull();
  });

  it("attaches only unattached assets to an enquiry; purge skips attached", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({ data: { contactName: `Board ${uid()}`, source: "inkling" } });
    enquiryIds.push(enquiry.id);
    const a = await createMoodboardAsset({ bytes: PNG, mime: "image/png" });
    const b = await createMoodboardAsset({ bytes: PNG, mime: "image/png" });
    assetIds.push(a.id, b.id);
    expect(await attachMoodboardAssets(enquiry.id, [a.id])).toBe(1);
    // Backdate both so the purge window covers them.
    await db().moodboardAsset.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { createdAt: new Date(Date.now() - 48 * 3600_000) },
    });
    const purged = await purgeOrphanMoodboardAssets(new Date(Date.now() - 24 * 3600_000));
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await getMoodboardAsset(a.id)).not.toBeNull();
    expect(await getMoodboardAsset(b.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL (module missing)**

`npm test -w @bnb/core -- src/services/moodboard-assets.test.ts`

- [ ] **Step 3: Implement service**

`packages/core/src/services/moodboard-assets.ts`:

```ts
import { prisma } from "@bnb/core/db";

/**
 * Inkling mood-board uploads live in Postgres (bytea) rather than on disk:
 * web + admin are separate containers and container disks are ephemeral.
 * Boards are small (≤12 images, client-downscaled) so this stays cheap.
 */

export interface MoodboardAssetMeta {
  id: string;
  mime: string;
  size: number;
}

export async function createMoodboardAsset(input: {
  bytes: Uint8Array;
  mime: string;
}): Promise<MoodboardAssetMeta> {
  const row = await prisma.moodboardAsset.create({
    data: { bytes: input.bytes, mime: input.mime, size: input.bytes.byteLength },
    select: { id: true, mime: true, size: true },
  });
  return row;
}

export async function getMoodboardAsset(
  id: string,
): Promise<(MoodboardAssetMeta & { bytes: Uint8Array }) | null> {
  const row = await prisma.moodboardAsset.findUnique({
    where: { id },
    select: { id: true, mime: true, size: true, bytes: true },
  });
  return row ? { ...row, bytes: new Uint8Array(row.bytes) } : null;
}

/** Link uploaded assets to the enquiry they were sent with (only unattached ones). */
export async function attachMoodboardAssets(
  enquiryId: string,
  assetIds: string[],
): Promise<number> {
  if (assetIds.length === 0) return 0;
  const res = await prisma.moodboardAsset.updateMany({
    where: { id: { in: assetIds }, enquiryId: null },
    data: { enquiryId },
  });
  return res.count;
}

/** Delete uploads that were never sent with an enquiry and are older than `olderThan`. */
export async function purgeOrphanMoodboardAssets(olderThan: Date): Promise<number> {
  const res = await prisma.moodboardAsset.deleteMany({
    where: { enquiryId: null, createdAt: { lt: olderThan } },
  });
  return res.count;
}
```

Add `export * from "./moodboard-assets";` and `export * from "./moodboard-data";` to `packages/core/src/services/index.ts`.

- [ ] **Step 4: Cron job + test**

`packages/core/src/cron/moodboard-assets.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const purge = vi.fn(async () => 3);
vi.mock("@bnb/core/services/moodboard-assets", () => ({
  purgeOrphanMoodboardAssets: (...a: unknown[]) => purge(...(a as [Date])),
}));
const { runMoodboardAssetPurge } = await import("./moodboard-assets");

describe("runMoodboardAssetPurge", () => {
  it("purges orphans older than 24h and reports the count", async () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const res = await runMoodboardAssetPurge(now);
    expect(res).toEqual({ job: "moodboard_asset_purge", sent: 3, skipped: 0 });
    expect(purge.mock.calls[0][0].toISOString()).toBe("2026-09-06T12:00:00.000Z");
  });
});
```

`packages/core/src/cron/moodboard-assets.ts`:

```ts
import { purgeOrphanMoodboardAssets } from "@bnb/core/services/moodboard-assets";
import type { CronJobResult } from "./reminders";

/** Housekeeping: drop mood-board uploads never sent with an enquiry (24h grace). */
const GRACE_HOURS = 24;

export async function runMoodboardAssetPurge(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const deleted = await purgeOrphanMoodboardAssets(
    new Date(now.getTime() - GRACE_HOURS * 3600_000),
  );
  return { job: "moodboard_asset_purge", sent: deleted, skipped: 0 };
}
```

In `packages/core/src/cron/index.ts`: import + `export { runMoodboardAssetPurge } from "./moodboard-assets";` and add `jobs.push(await runMoodboardAssetPurge());` after the loyalty job. Check `packages/core/src/cron/index.test.ts` — if it asserts an exact job count/list, add the new job name there and mock it the same way the others are mocked.

- [ ] **Step 5: Enquiry service attach**

In `packages/core/src/services/enquiries.ts`:
- `CreateEnquiryInput` add `moodboardData?: Prisma.InputJsonValue | null;` and `assetIds?: string[];`
- in `createEnquiry` data add `moodboardData: input.moodboardData ?? Prisma.DbNull,`
- after the create, before the email: `if (input.assetIds?.length) await attachMoodboardAssets(enquiry.id, input.assetIds);` (import from `./moodboard-assets`).

Add to `enquiries.test.ts` (existing DB suite pattern, clean up ids in `afterAll`):

```ts
it("stores moodboardData and attaches uploaded assets", async () => {
  if (!(await dbReachable())) return;
  const asset = await db().moodboardAsset.create({
    data: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png", size: 3 },
  });
  const e = await createEnquiry({
    contactName: `Board ${uid()}`,
    source: "inkling",
    moodboard: ["https://x.test/a.jpg"],
    moodboardData: { version: 1, styles: ["Fine-line"], colour: null, description: "peony", query: null, notes: null, items: [] },
    assetIds: [asset.id],
  });
  ids.push(e.id); // whatever cleanup array the suite uses; also add customer cleanup as the suite does
  const attached = await db().moodboardAsset.findUniqueOrThrow({ where: { id: asset.id } });
  expect(attached.enquiryId).toBe(e.id);
  expect((e.moodboardData as { styles: string[] }).styles).toEqual(["Fine-line"]);
});
```

- [ ] **Step 6: Run core suite, commit**

`npm test -w @bnb/core` — all PASS (DB up).

```bash
git add packages/core/src
git commit -m "feat(core): mood-board asset storage, orphan purge cron job, enquiry board attach"
```

---

### Task 4: Image search service (`@bnb/core/services/image-search`)

**Files:**
- Create: `packages/core/src/services/image-search.ts`, `packages/core/src/services/image-search.test.ts`

**Interfaces:**
```ts
export interface InspirationBrief { styles: string[]; colour: BoardColour | null; description: string }
export function buildInspirationQuery(brief: InspirationBrief): string
export interface WebImageResult { url: string; thumbUrl: string|null; sourceUrl: string|null; title: string|null; width: number|null; height: number|null }
export interface ImageSearchPage { results: WebImageResult[]; nextStart: number | null }
export interface ImageSearchProvider { name: string; search(query: string, start: number): Promise<ImageSearchPage> }
export function googleCseProvider(opts: { key: string; cx: string; fetchImpl?: typeof fetch }): ImageSearchProvider
export function providerFromEnv(env?: NodeJS.ProcessEnv): ImageSearchProvider | null
export interface StudioImageResult { galleryItemId: string; url: string; title: string; style: string|null; artistName: string|null; sourceUrl: string }
export function findStudioMatches(brief: InspirationBrief, take?: number): Promise<StudioImageResult[]>
export interface InspirationResponse { query: string; studio: StudioImageResult[]; web: WebImageResult[]; nextStart: number|null; providerConfigured: boolean; webError: boolean }
export function searchInspiration(input: InspirationBrief & { start?: number }, deps?: { provider?: ImageSearchProvider | null; findStudio?: typeof findStudioMatches; now?: () => number }): Promise<InspirationResponse>
export function clearInspirationCache(): void
```

- [ ] **Step 1: Failing tests**

`packages/core/src/services/image-search.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInspirationQuery,
  clearInspirationCache,
  findStudioMatches,
  googleCseProvider,
  providerFromEnv,
  searchInspiration,
  type ImageSearchProvider,
} from "./image-search";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

describe("buildInspirationQuery", () => {
  it("joins description, styles, colour and appends tattoo", () => {
    expect(
      buildInspirationQuery({ description: "  Peony   wrapping the forearm ", styles: ["Fine-line", "Dotwork & Geometric"], colour: "bw" }),
    ).toBe("peony wrapping the forearm fine-line dotwork and geometric black and grey tattoo");
  });
  it("does not double up tattoo, handles empty brief, caps length", () => {
    expect(buildInspirationQuery({ description: "snake tattoo", styles: [], colour: null })).toBe("snake tattoo");
    expect(buildInspirationQuery({ description: "", styles: [], colour: "colour" })).toBe("colour tattoo");
    const long = buildInspirationQuery({ description: "x".repeat(500), styles: [], colour: null });
    expect(long.length).toBeLessThanOrEqual(200);
  });
});

describe("googleCseProvider", () => {
  const payload = {
    items: [
      { title: "Peony", link: "https://img.test/a.jpg", image: { thumbnailLink: "https://t.test/a.jpg", contextLink: "https://page.test/a", width: 800, height: 1200 } },
      { title: "No image block", link: "https://img.test/b.jpg" },
    ],
    queries: { nextPage: [{ startIndex: 11 }] },
  };
  it("calls the CSE endpoint with image search params and maps results", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const p = googleCseProvider({ key: "K", cx: "CX", fetchImpl: fetchImpl as unknown as typeof fetch });
    const page = await p.search("peony tattoo", 1);
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("searchType")).toBe("image");
    expect(url.searchParams.get("safe")).toBe("active");
    expect(url.searchParams.get("q")).toBe("peony tattoo");
    expect(url.searchParams.get("start")).toBe("1");
    expect(page.results).toEqual([
      { url: "https://img.test/a.jpg", thumbUrl: "https://t.test/a.jpg", sourceUrl: "https://page.test/a", title: "Peony", width: 800, height: 1200 },
      { url: "https://img.test/b.jpg", thumbUrl: null, sourceUrl: null, title: "No image block", width: null, height: null },
    ]);
    expect(page.nextStart).toBe(11);
  });
  it("throws a clean error on non-200 without leaking the key", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    const p = googleCseProvider({ key: "SECRET", cx: "CX", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(p.search("x", 1)).rejects.toThrow(/429/);
    await expect(p.search("x", 1)).rejects.not.toThrow(/SECRET/);
  });
  it("providerFromEnv is null unless both vars are set", () => {
    expect(providerFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(providerFromEnv({ GOOGLE_CSE_KEY: "k" } as NodeJS.ProcessEnv)).toBeNull();
    expect(providerFromEnv({ GOOGLE_CSE_KEY: "k", GOOGLE_CSE_CX: "c" } as NodeJS.ProcessEnv)?.name).toBe("google-cse");
  });
});

describe("searchInspiration", () => {
  const studio = vi.fn(async () => []);
  beforeEach(() => { clearInspirationCache(); studio.mockClear(); });

  it("returns studio + web, caches the web page by query+start", async () => {
    const search = vi.fn(async () => ({ results: [{ url: "https://i/1.jpg", thumbUrl: null, sourceUrl: null, title: null, width: null, height: null }], nextStart: 11 }));
    const provider: ImageSearchProvider = { name: "stub", search };
    const brief = { description: "peony", styles: ["Fine-line"], colour: null as null };
    const a = await searchInspiration(brief, { provider, findStudio: studio });
    const b = await searchInspiration(brief, { provider, findStudio: studio });
    expect(a.web).toHaveLength(1);
    expect(a.providerConfigured).toBe(true);
    expect(a.nextStart).toBe(11);
    expect(search).toHaveBeenCalledTimes(1);
    expect(b.web).toEqual(a.web);
    expect(studio).toHaveBeenCalledTimes(2); // studio is never cached
  });
  it("only queries the studio gallery on the first page", async () => {
    const provider: ImageSearchProvider = { name: "stub", search: async () => ({ results: [], nextStart: null }) };
    await searchInspiration({ description: "peony", styles: [], colour: null, start: 11 }, { provider, findStudio: studio });
    expect(studio).not.toHaveBeenCalled();
  });
  it("degrades when the provider is missing or throws", async () => {
    const none = await searchInspiration({ description: "peony", styles: [], colour: null }, { provider: null, findStudio: studio });
    expect(none).toMatchObject({ web: [], providerConfigured: false, webError: false, nextStart: null });
    const bad: ImageSearchProvider = { name: "bad", search: async () => { throw new Error("boom"); } };
    const err = await searchInspiration({ description: "peony", styles: [], colour: null }, { provider: bad, findStudio: studio });
    expect(err).toMatchObject({ web: [], providerConfigured: true, webError: true });
  });
  it("expires cache entries after the TTL", async () => {
    let t = 0;
    const search = vi.fn(async () => ({ results: [], nextStart: null }));
    const provider: ImageSearchProvider = { name: "stub", search };
    const brief = { description: "ttl", styles: [], colour: null as null };
    await searchInspiration(brief, { provider, findStudio: studio, now: () => t });
    t = 11 * 60_000;
    await searchInspiration(brief, { provider, findStudio: studio, now: () => t });
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe("findStudioMatches (DB)", () => {
  const ids: string[] = [];
  afterAll(async () => {
    if ((await dbReachable()) && ids.length) await testDb().galleryItem.deleteMany({ where: { id: { in: ids } } });
    await closeTestDb();
  });
  it("returns imaged items for the chosen styles, description keyword hits first", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("mb");
    const mk = async (title: string, style: string, image: string | null) => {
      const r = await testDb().galleryItem.create({ data: { title: `${title} ${tag}`, style, image, sortOrder: 9000 } });
      ids.push(r.id);
      return r;
    };
    const peony = await mk("Peony sleeve", "Fine-line", "https://img.test/peony.jpg");
    const snake = await mk("Snake", "Fine-line", "https://img.test/snake.jpg");
    await mk("No image", "Fine-line", null);
    await mk("Other style", "Realism", "https://img.test/real.jpg");
    const res = await findStudioMatches({ description: `peony ${tag}`, styles: ["Fine-line"], colour: null }, 50);
    const got = res.filter((r) => r.title.includes(tag));
    expect(got.map((r) => r.galleryItemId)).toEqual([peony.id, snake.id]);
    expect(got[0].sourceUrl).toBe("/gallery");
  });
});
```

- [ ] **Step 2: Run — FAIL (module missing)**

- [ ] **Step 3: Implement**

`packages/core/src/services/image-search.ts`:

```ts
import { prisma } from "@bnb/core/db";
import type { BoardColour } from "./moodboard-data";

/**
 * Inkling inspiration search: a deterministic query built from the visitor's
 * brief, run against (a) the studio's own gallery and (b) a web image-search
 * provider (Google Programmable Search). The provider sits behind a tiny
 * interface so it can be swapped; results are cached in-process to protect
 * the daily quota. No AI.
 */

export interface InspirationBrief {
  styles: string[];
  colour: BoardColour | null;
  description: string;
}

const COLOUR_TERMS: Record<BoardColour, string> = {
  bw: "black and grey",
  colour: "colour",
  either: "",
};

const MAX_QUERY_CHARS = 200;

export function buildInspirationQuery(brief: InspirationBrief): string {
  const parts: string[] = [];
  const desc = brief.description.trim().replace(/\s+/g, " ").toLowerCase();
  if (desc) parts.push(desc.slice(0, 120));
  for (const s of brief.styles) {
    const term = s.trim().toLowerCase().replace(/\s*&\s*/g, " and ");
    if (term) parts.push(term);
  }
  if (brief.colour && COLOUR_TERMS[brief.colour]) parts.push(COLOUR_TERMS[brief.colour]);
  let q = parts.join(" ");
  if (!/\btattoos?\b/.test(q)) q = `${q} tattoo`.trim();
  return q.slice(0, MAX_QUERY_CHARS).trim();
}

export interface WebImageResult {
  url: string;
  thumbUrl: string | null;
  sourceUrl: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
}

export interface ImageSearchPage {
  results: WebImageResult[];
  nextStart: number | null;
}

export interface ImageSearchProvider {
  name: string;
  search(query: string, start: number): Promise<ImageSearchPage>;
}

interface CseItem {
  title?: string;
  link?: string;
  image?: { thumbnailLink?: string; contextLink?: string; width?: number; height?: number };
}
interface CseResponse {
  items?: CseItem[];
  queries?: { nextPage?: { startIndex?: number }[] };
}

/** Google Programmable Search (Custom Search JSON API) image search. */
export function googleCseProvider(opts: {
  key: string;
  cx: string;
  fetchImpl?: typeof fetch;
}): ImageSearchProvider {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: "google-cse",
    async search(query, start) {
      const u = new URL("https://www.googleapis.com/customsearch/v1");
      u.searchParams.set("key", opts.key);
      u.searchParams.set("cx", opts.cx);
      u.searchParams.set("q", query);
      u.searchParams.set("searchType", "image");
      u.searchParams.set("safe", "active");
      u.searchParams.set("num", "10");
      u.searchParams.set("start", String(start));
      const res = await fetchImpl(u.toString(), { headers: { accept: "application/json" } });
      if (!res.ok) {
        throw new Error(`Image search provider responded ${res.status}`);
      }
      const body = (await res.json()) as CseResponse;
      const results: WebImageResult[] = (body.items ?? [])
        .filter((i): i is CseItem & { link: string } => typeof i.link === "string")
        .map((i) => ({
          url: i.link,
          thumbUrl: i.image?.thumbnailLink ?? null,
          sourceUrl: i.image?.contextLink ?? null,
          title: i.title ?? null,
          width: i.image?.width ?? null,
          height: i.image?.height ?? null,
        }));
      const next = body.queries?.nextPage?.[0]?.startIndex;
      // The API serves at most 100 results (start ≤ 91).
      const nextStart = typeof next === "number" && next <= 91 ? next : null;
      return { results, nextStart };
    },
  };
}

export function providerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ImageSearchProvider | null {
  const key = env.GOOGLE_CSE_KEY?.trim();
  const cx = env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx) return null;
  return googleCseProvider({ key, cx });
}

export interface StudioImageResult {
  galleryItemId: string;
  url: string;
  title: string;
  style: string | null;
  artistName: string | null;
  sourceUrl: string;
}

/** Words from the description worth matching against gallery titles. */
function keywords(description: string): string[] {
  return description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

export async function findStudioMatches(
  brief: InspirationBrief,
  take = 12,
): Promise<StudioImageResult[]> {
  const rows = await prisma.galleryItem.findMany({
    where: {
      image: { not: null },
      ...(brief.styles.length ? { style: { in: brief.styles } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: 60,
    select: {
      id: true,
      title: true,
      style: true,
      image: true,
      artist: { select: { name: true } },
    },
  });
  const words = keywords(brief.description);
  const scored = rows.map((r, i) => ({
    r,
    i,
    hit: words.some((w) => r.title.toLowerCase().includes(w)) ? 1 : 0,
  }));
  scored.sort((a, b) => b.hit - a.hit || a.i - b.i);
  return scored.slice(0, take).map(({ r }) => ({
    galleryItemId: r.id,
    url: r.image as string,
    title: r.title,
    style: r.style,
    artistName: r.artist?.name ?? null,
    sourceUrl: "/gallery",
  }));
}

export interface InspirationResponse {
  query: string;
  studio: StudioImageResult[];
  web: WebImageResult[];
  nextStart: number | null;
  providerConfigured: boolean;
  webError: boolean;
}

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; page: ImageSearchPage }>();

export function clearInspirationCache(): void {
  cache.clear();
}

function cacheGet(key: string, now: number): ImageSearchPage | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.page;
}

function cacheSet(key: string, page: ImageSearchPage, now: number): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: now, page });
}

export async function searchInspiration(
  input: InspirationBrief & { start?: number },
  deps: {
    provider?: ImageSearchProvider | null;
    findStudio?: typeof findStudioMatches;
    now?: () => number;
  } = {},
): Promise<InspirationResponse> {
  const provider = deps.provider === undefined ? providerFromEnv() : deps.provider;
  const findStudio = deps.findStudio ?? findStudioMatches;
  const now = deps.now ?? Date.now;
  const start = input.start ?? 1;
  const query = buildInspirationQuery(input);

  const studioPromise = start === 1 ? findStudio(input) : Promise.resolve([]);

  let web: WebImageResult[] = [];
  let nextStart: number | null = null;
  let webError = false;
  if (provider) {
    const key = `${provider.name}|${query}|${start}`;
    const cached = cacheGet(key, now());
    if (cached) {
      web = cached.results;
      nextStart = cached.nextStart;
    } else {
      try {
        const page = await provider.search(query, start);
        cacheSet(key, page, now());
        web = page.results;
        nextStart = page.nextStart;
      } catch (err) {
        webError = true;
        console.error("[inkling] image search failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  const studio = await studioPromise;
  return { query, studio, web, nextStart, providerConfigured: Boolean(provider), webError };
}
```

Add `export * from "./image-search";` to `packages/core/src/services/index.ts`.

- [ ] **Step 4: Run tests, commit**

`npm test -w @bnb/core -- src/services/image-search.test.ts` — PASS. Then `npm test -w @bnb/core` — PASS.

```bash
git add packages/core/src/services
git commit -m "feat(core): inspiration image search — query builder, Google CSE provider, studio gallery matches, TTL cache"
```

---

### Task 5: Public web API — search, uploads, assets, enquiries extension

**Files:**
- Create: `apps/web/src/app/api/inkling/search/route.ts` (+ `route.test.ts`), `apps/web/src/app/api/inkling/uploads/route.ts` (+ `route.test.ts`), `apps/web/src/app/api/inkling/assets/[id]/route.ts` (+ `route.test.ts`)
- Modify: `apps/web/src/app/api/enquiries/route.ts`; Create `apps/web/src/app/api/enquiries/route.moodboard.test.ts`

**Interfaces:**
- `POST /api/inkling/search` body `{ styles?: string[]; colour?: "bw"|"colour"|"either"|null; description?: string; start?: number }` → `InspirationResponse` JSON (200), 400 when brief empty, 429 rate limit.
- `POST /api/inkling/uploads` multipart `file` → `{ assetId, url }` (201). 400 no/empty file, 413 >5 MB, 415 bad type.
- `GET /api/inkling/assets/[id]` → bytes with `content-type`, immutable cache; 404.
- `POST /api/enquiries` additionally accepts `moodboardData` (validated with `moodboardDataSchema`); server finalises it.

- [ ] **Step 1: Search route test**

`apps/web/src/app/api/inkling/search/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchInspiration = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>) => ({
    query: "q", studio: [], web: [], nextStart: null, providerConfigured: false, webError: false, input,
  })),
);
vi.mock("@bnb/core/services/image-search", () => ({ searchInspiration }));

const { POST } = await import("./route");

let ip = 0;
function post(body: unknown, pinnedIp?: string) {
  return POST(
    new Request("http://x/api/inkling/search", {
      method: "POST",
      headers: { "x-forwarded-for": pinnedIp ?? `10.1.${++ip}.1`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => searchInspiration.mockClear());

describe("POST /api/inkling/search", () => {
  it("runs the search with a normalised brief", async () => {
    const res = await post({ styles: ["Fine-line"], colour: "bw", description: "peony", start: 11 });
    expect(res.status).toBe(200);
    expect(searchInspiration).toHaveBeenCalledWith({ styles: ["Fine-line"], colour: "bw", description: "peony", start: 11 });
  });
  it("400s when there is neither a style nor a description", async () => {
    expect((await post({ description: "  " })).status).toBe(400);
    expect((await post({ styles: [], description: "ab" })).status).toBe(400);
  });
  it("400s on bad shapes", async () => {
    expect((await post({ styles: ["a", "b", "c", "d"], description: "peony" })).status).toBe(400);
    expect((await post({ description: "peony", start: 200 })).status).toBe(400);
  });
  it("429s after 20 hits from one IP", async () => {
    for (let i = 0; i < 20; i++) await post({ description: "peony" }, "9.9.9.9");
    expect((await post({ description: "peony" }, "9.9.9.9")).status).toBe(429);
  });
});
```

- [ ] **Step 2: Search route**

```ts
import { z } from "zod";
import { searchInspiration } from "@bnb/core/services/image-search";
import { handleApiError, json, jsonError, parseBody } from "@bnb/core/http";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/inkling/search — public inspiration search for the mood-board
 * builder. Unauthenticated, rate-limited per IP; the provider key never
 * leaves the server. Degrades to studio-only results when no provider is set.
 */

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const schema = z.object({
  styles: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  colour: z.enum(["bw", "colour", "either"]).nullish(),
  description: z.string().trim().max(300).default(""),
  start: z.coerce.number().int().min(1).max(91).default(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(429, "Too many searches — please try again in a minute.");
    }
    const input = await parseBody(req, schema);
    if (input.styles.length === 0 && input.description.length < 3) {
      return jsonError(400, "Pick a style or describe your idea first.");
    }
    const result = await searchInspiration({
      styles: input.styles,
      colour: input.colour ?? null,
      description: input.description,
      start: input.start,
    });
    return json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
```

Run: `npm test -w @bnb/web -- src/app/api/inkling/search` — PASS.

- [ ] **Step 3: Uploads route test**

`apps/web/src/app/api/inkling/uploads/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMoodboardAsset = vi.hoisted(() =>
  vi.fn(async (i: { bytes: Uint8Array; mime: string }) => ({ id: "asset_1", mime: i.mime, size: i.bytes.length })),
);
vi.mock("@bnb/core/services/moodboard-assets", () => ({ createMoodboardAsset }));

const { POST } = await import("./route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
let ip = 0;
function upload(file: File | null, pinnedIp?: string) {
  const fd = new FormData();
  if (file) fd.set("file", file);
  return POST(new Request("http://x/api/inkling/uploads", {
    method: "POST", body: fd, headers: { "x-forwarded-for": pinnedIp ?? `10.2.${++ip}.1` },
  }));
}

beforeEach(() => createMoodboardAsset.mockClear());

describe("POST /api/inkling/uploads", () => {
  it("stores a sniffed png and returns the asset url", async () => {
    const res = await upload(new File([PNG], "a.png", { type: "image/png" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ assetId: "asset_1", url: "/api/inkling/assets/asset_1" });
    expect(createMoodboardAsset.mock.calls[0][0].mime).toBe("image/png");
  });
  it("400s without a file or with an empty one", async () => {
    expect((await upload(null)).status).toBe(400);
    expect((await upload(new File([], "e.png", { type: "image/png" }))).status).toBe(400);
  });
  it("415s for svg / mismatched bytes", async () => {
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    expect((await upload(svg)).status).toBe(415);
    const fake = new File(["<svg/>"], "x.png", { type: "image/png" });
    expect((await upload(fake)).status).toBe(415);
  });
  it("413s over 5MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect((await upload(big)).status).toBe(413);
  });
  it("429s after 10 uploads from one IP", async () => {
    for (let i = 0; i < 10; i++) await upload(new File([PNG], "a.png", { type: "image/png" }), "8.8.8.8");
    expect((await upload(new File([PNG], "a.png", { type: "image/png" }), "8.8.8.8")).status).toBe(429);
  });
});
```

- [ ] **Step 4: Uploads route**

```ts
import { createMoodboardAsset } from "@bnb/core/services/moodboard-assets";
import { handleApiError, json, jsonError } from "@bnb/core/http";
import { isAllowedImageMime, sniffImageMime } from "@bnb/core/uploads";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/inkling/uploads — public mood-board image upload. Bytes are
 * sniffed (raster only, never SVG) and stored in Postgres; the response URL
 * is served by GET /api/inkling/assets/[id]. Orphans are purged by cron.
 */

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(429, "Too many uploads — please try again in a minute.");
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError(400, "No file provided");
    if (file.size === 0) return jsonError(400, "Empty file");
    if (file.size > MAX_BYTES) return jsonError(413, "Image too large (max 5MB)");
    if (!isAllowedImageMime(file.type)) {
      return jsonError(415, `Unsupported image type: ${file.type || "unknown"}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageMime(bytes);
    if (!sniffed || sniffed !== file.type) {
      return jsonError(415, "File content does not match a supported image format");
    }
    const asset = await createMoodboardAsset({ bytes, mime: sniffed });
    return json({ assetId: asset.id, url: `/api/inkling/assets/${asset.id}` }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

Run its test — PASS.

- [ ] **Step 5: Assets route + test**

`apps/web/src/app/api/inkling/assets/[id]/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const getMoodboardAsset = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/moodboard-assets", () => ({ getMoodboardAsset }));
const { GET } = await import("./route");

const call = (id: string) =>
  GET(new Request(`http://x/api/inkling/assets/${id}`), { params: Promise.resolve({ id }) });

describe("GET /api/inkling/assets/[id]", () => {
  it("streams the bytes with mime + immutable caching", async () => {
    getMoodboardAsset.mockResolvedValueOnce({ id: "a1", mime: "image/png", size: 3, bytes: new Uint8Array([1, 2, 3]) });
    const res = await call("a1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("404s for an unknown id", async () => {
    getMoodboardAsset.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
  });
});
```

`apps/web/src/app/api/inkling/assets/[id]/route.ts`:

```ts
import { getMoodboardAsset } from "@bnb/core/services/moodboard-assets";
import { handleApiError, jsonError } from "@bnb/core/http";

/**
 * GET /api/inkling/assets/[id] — serves a stored mood-board upload. Public by
 * unguessable cuid (the admin origin renders these in the inbox). Immutable:
 * an asset's bytes never change.
 */

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const asset = await getMoodboardAsset(id);
    if (!asset) return jsonError(404, "Not found");
    const body = Uint8Array.from(asset.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": asset.mime,
        "content-length": String(asset.size),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
```
(If TypeScript rejects the body type, use `new Response(body.buffer as ArrayBuffer, …)`.)

Run its test — PASS.

- [ ] **Step 6: Enquiries route — accept + finalise `moodboardData`**

Test `apps/web/src/app/api/enquiries/route.moodboard.test.ts` (same mocking style as `route.gate.test.ts`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ siteSettings: { findFirst: vi.fn() } }));
const createEnquiry = vi.hoisted(() => vi.fn(async (input: Record<string, unknown>) => ({ id: "e1", ...input })));
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("@bnb/core/services/enquiries", () => ({ createEnquiry }));
const { POST } = await import("./route");

let ip = 0;
const post = (body: unknown) =>
  POST(new Request("http://web.test/api/enquiries", {
    method: "POST", headers: { "x-forwarded-for": `10.3.${++ip}.1` }, body: JSON.stringify(body),
  }));

beforeEach(() => {
  prisma.siteSettings.findFirst.mockResolvedValue({ enquiriesOpen: true });
  createEnquiry.mockClear();
  delete process.env.APP_ORIGIN;
});

describe("POST /api/enquiries — mood board", () => {
  it("finalises moodboardData: asset urls, absolute urls, moodboard[] + assetIds", async () => {
    process.env.APP_ORIGIN = "https://site.test";
    const res = await post({
      contactName: "Board", contactPhone: "07123456789", source: "inkling",
      moodboardData: {
        version: 1, styles: ["Fine-line"], description: "peony",
        items: [
          { kind: "upload", url: "blob:x", assetId: "as1" },
          { kind: "studio", url: "/uploads/g.jpg", galleryItemId: "g1" },
          { kind: "web", url: "https://i.test/a.jpg", sourceUrl: "https://p.test/a" },
        ],
      },
    });
    expect(res.status).toBe(201);
    const input = createEnquiry.mock.calls[0][0] as Record<string, unknown>;
    expect(input.moodboard).toEqual([
      "https://site.test/api/inkling/assets/as1",
      "https://site.test/uploads/g.jpg",
      "https://i.test/a.jpg",
    ]);
    expect(input.assetIds).toEqual(["as1"]);
    expect((input.moodboardData as { items: unknown[] }).items).toHaveLength(3);
  });
  it("falls back to the request origin when APP_ORIGIN is unset", async () => {
    await post({ contactName: "B", contactPhone: "07123456789", moodboardData: { version: 1, items: [{ kind: "upload", url: "", assetId: "as2" }] } });
    const input = createEnquiry.mock.calls[0][0] as { moodboard: string[] };
    expect(input.moodboard).toEqual(["http://web.test/api/inkling/assets/as2"]);
  });
  it("400s on an invalid board", async () => {
    expect((await post({ contactName: "B", contactPhone: "07123456789", moodboardData: { version: 3, items: [] } })).status).toBe(400);
  });
});
```

Modify `apps/web/src/app/api/enquiries/route.ts`:
- import `{ finaliseMoodboardData, moodboardDataSchema } from "@bnb/core/services/moodboard-data";`
- in `createSchema` add `moodboardData: moodboardDataSchema.optional(),`
- after `const input = await parseBody(req, createSchema);`:
```ts
    let payload: CreateEnquiryInput = input as unknown as CreateEnquiryInput;
    if (input.moodboardData) {
      const origin = process.env.APP_ORIGIN ?? new URL(req.url).origin;
      const board = finaliseMoodboardData(input.moodboardData, origin);
      payload = {
        ...payload,
        moodboard: board.urls,
        moodboardData: board.data as unknown as CreateEnquiryInput["moodboardData"],
        assetIds: board.assetIds,
      };
    }
    const enquiry = await createEnquiry(payload);
```

Run `npm test -w @bnb/web -- src/app/api` — PASS (the existing route tests still pass).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api
git commit -m "feat(web): public Inkling API — inspiration search, board uploads, asset serving; enquiries accept moodboardData"
```

---

### Task 6: Builder logic + image prep (pure, tested)

**Files:**
- Create: `apps/web/src/app/inkling/moodboard/logic.ts` (+ `logic.test.ts`), `apps/web/src/app/inkling/moodboard/image-prep.ts` (+ `image-prep.test.ts`)
- Modify: `apps/web/src/app/inkling/logic.ts` — delete `InklingEnquiryInput` / `InklingEnquiryPayload` / `buildInklingEnquiryPayload` (and their tests in `inkling/logic.test.ts`) once Task 7 removes their only consumer; do it in this task and fix the test file.

**Interfaces (produces):**
```ts
export const BOARD_STEPS = ["Brief", "Inspiration", "Details", "Send"] as const;
export type BoardStep = (typeof BOARD_STEPS)[number];
export const COLOUR_OPTIONS: { value: BoardColour; label: string }[];
export interface BoardItem extends MoodboardItem { key: string }
export interface BuilderState { styles: string[]; colour: BoardColour|null; description: string; query: string|null; items: BoardItem[]; placement: string; size: SizeChoice|""; budget: string; artistId: string|null; notes: string; name: string; email: string; phone: string }
export function emptyBuilder(): BuilderState
export function canAdvance(step: BoardStep, s: BuilderState): boolean
export function briefReady(s: BuilderState): boolean
export type ToggleResult = { ok: true; items: BoardItem[]; added: boolean } | { ok: false; error: string }
export function toggleItem(items: BoardItem[], item: BoardItem): ToggleResult
export function removeItem(items: BoardItem[], key: string): BoardItem[]
export function hasItem(items: BoardItem[], key: string): boolean
export function webResultToItem(r: WebImageResult): BoardItem
export function studioResultToItem(r: StudioImageResult): BoardItem
export function uploadToItem(u: { assetId: string; url: string }, title?: string|null): BoardItem
export function parsePastedUrl(text: string): string | null
export function linkToItem(url: string): BoardItem
export function buildSearchRequest(s: BuilderState, start?: number): { styles: string[]; colour: BoardColour|null; description: string; start: number }
export function budgetToPence(raw: string): number | null
export interface BoardEnquiryPayload { contactName: string; contactEmail: string|null; contactPhone: string|null; preferredArtistId: string|null; style: string|null; placement: string|null; size: string|null; budgetPence: number|null; description: string|null; moodboard: string[]; moodboardData: MoodboardDataInput; source: "inkling" }
export function buildBoardEnquiryPayload(s: BuilderState): BoardEnquiryPayload
// image-prep
export const MAX_EDGE = 1600; export const SKIP_BELOW_BYTES = 600_000;
export function targetDimensions(w: number, h: number, maxEdge?: number): { width: number; height: number }
export function shouldDownscale(sizeBytes: number, w: number, h: number, maxEdge?: number): boolean
export function prepareImage(file: File): Promise<File>   // browser-only; returns original when no downscale
```

- [ ] **Step 1: Failing logic tests**

`apps/web/src/app/inkling/moodboard/logic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BOARD_STEPS, budgetToPence, buildBoardEnquiryPayload, buildSearchRequest, canAdvance,
  emptyBuilder, linkToItem, parsePastedUrl, removeItem, studioResultToItem, toggleItem,
  uploadToItem, webResultToItem, type BoardItem, type BuilderState,
} from "./logic";

const web = webResultToItem({ url: "https://i.test/a.jpg", thumbUrl: "https://t.test/a.jpg", sourceUrl: "https://p.test/a", title: "Peony", width: 1, height: 1 });
const studio = studioResultToItem({ galleryItemId: "g1", url: "/uploads/g.jpg", title: "Snake", style: "Fine-line", artistName: "Sarah", sourceUrl: "/gallery" });

function filled(over: Partial<BuilderState> = {}): BuilderState {
  return { ...emptyBuilder(), styles: ["Fine-line"], description: "peony forearm", items: [web], name: "Amy", email: "amy@example.com", ...over };
}

describe("board items", () => {
  it("maps results to items with stable keys", () => {
    expect(web).toMatchObject({ kind: "web", key: "https://i.test/a.jpg", assetId: null });
    expect(studio).toMatchObject({ kind: "studio", key: "studio:g1", galleryItemId: "g1", title: "Snake · Sarah" });
    expect(uploadToItem({ assetId: "a1", url: "/api/inkling/assets/a1" })).toMatchObject({ kind: "upload", key: "asset:a1", assetId: "a1" });
    expect(linkToItem("https://x.test/p.png")).toMatchObject({ kind: "link", key: "https://x.test/p.png", url: "https://x.test/p.png" });
  });
  it("toggles on/off, dedupes, and caps at 12", () => {
    const on = toggleItem([], web);
    expect(on).toMatchObject({ ok: true, added: true });
    const off = toggleItem(on.ok ? on.items : [], web);
    expect(off).toMatchObject({ ok: true, added: false, items: [] });
    const many: BoardItem[] = Array.from({ length: 12 }, (_, i) => linkToItem(`https://x.test/${i}.png`));
    const full = toggleItem(many, studio);
    expect(full.ok).toBe(false);
    expect(removeItem(many, "https://x.test/3.png")).toHaveLength(11);
  });
  it("parses pasted urls", () => {
    expect(parsePastedUrl(" https://x.test/a.png ")).toBe("https://x.test/a.png");
    expect(parsePastedUrl("ftp://x")).toBeNull();
    expect(parsePastedUrl("just words")).toBeNull();
  });
});

describe("step gating", () => {
  it("has the four steps", () => expect(BOARD_STEPS).toEqual(["Brief", "Inspiration", "Details", "Send"]));
  it("Brief needs a style or a 3+ char description", () => {
    expect(canAdvance("Brief", emptyBuilder())).toBe(false);
    expect(canAdvance("Brief", { ...emptyBuilder(), styles: ["Realism"] })).toBe(true);
    expect(canAdvance("Brief", { ...emptyBuilder(), description: "ab" })).toBe(false);
    expect(canAdvance("Brief", { ...emptyBuilder(), description: "owl" })).toBe(true);
  });
  it("Inspiration needs at least one item; Details always; Send needs name + contact", () => {
    expect(canAdvance("Inspiration", filled({ items: [] }))).toBe(false);
    expect(canAdvance("Inspiration", filled())).toBe(true);
    expect(canAdvance("Details", filled())).toBe(true);
    expect(canAdvance("Send", filled({ email: "", phone: "" }))).toBe(false);
    expect(canAdvance("Send", filled({ email: "", phone: "07123 456789" }))).toBe(true);
    expect(canAdvance("Send", filled({ email: "not-an-email" }))).toBe(false);
  });
});

describe("requests + payload", () => {
  it("builds the search request", () => {
    expect(buildSearchRequest(filled({ colour: "bw" }), 11)).toEqual({ styles: ["Fine-line"], colour: "bw", description: "peony forearm", start: 11 });
  });
  it("parses budgets", () => {
    expect(budgetToPence("150")).toBe(15000);
    expect(budgetToPence("£1,200.50")).toBe(120050);
    expect(budgetToPence("")).toBeNull();
    expect(budgetToPence("abc")).toBeNull();
  });
  it("builds the enquiry payload", () => {
    const p = buildBoardEnquiryPayload(filled({
      colour: "bw", query: "peony forearm fine-line black and grey tattoo", items: [web, studio],
      placement: "Forearm", size: "Medium", budget: "150", artistId: "art1", notes: "Would love it wrapping.", phone: " ",
    }));
    expect(p).toMatchObject({
      contactName: "Amy", contactEmail: "amy@example.com", contactPhone: null, preferredArtistId: "art1",
      style: "Fine-line", placement: "Forearm", size: "Medium", budgetPence: 15000, source: "inkling",
      moodboard: ["https://i.test/a.jpg", "/uploads/g.jpg"],
    });
    expect(p.description).toBe("peony forearm\n\nWould love it wrapping.");
    expect(p.moodboardData.items[1]).not.toHaveProperty("key");
    expect(p.moodboardData).toMatchObject({ version: 1, styles: ["Fine-line"], colour: "bw", notes: "Would love it wrapping." });
  });
});
```

`apps/web/src/app/inkling/moodboard/image-prep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldDownscale, targetDimensions } from "./image-prep";

describe("image prep", () => {
  it("scales the long edge to the max, preserving aspect", () => {
    expect(targetDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(targetDimensions(1000, 2400)).toEqual({ width: 667, height: 1600 });
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("skips small files and already-small images", () => {
    expect(shouldDownscale(100_000, 4000, 3000)).toBe(false);
    expect(shouldDownscale(2_000_000, 1200, 900)).toBe(false);
    expect(shouldDownscale(2_000_000, 4000, 3000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL (modules missing)**

- [ ] **Step 3: Implement `moodboard/logic.ts`**

```ts
/**
 * Pure logic for the Inkling mood-board builder (Brief → Inspiration →
 * Details → Send). Framework-free so it unit-tests in node; the React steps
 * are thin shells over these helpers.
 */
import {
  MAX_BOARD_ITEMS,
  type BoardColour,
  type MoodboardDataInput,
  type MoodboardItem,
} from "@bnb/core/services/moodboard-data";
import type { StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";
import { type SizeChoice } from "../../enquire/logic";

export { MAX_BOARD_ITEMS };
export { MAX_STYLES as MAX_BOARD_STYLES, PLACEMENTS, SIZES, toggleStyle } from "../../enquire/logic";

export const BOARD_STEPS = ["Brief", "Inspiration", "Details", "Send"] as const;
export type BoardStep = (typeof BOARD_STEPS)[number];

export const COLOUR_OPTIONS: { value: BoardColour; label: string }[] = [
  { value: "bw", label: "Black & grey" },
  { value: "colour", label: "Colour" },
  { value: "either", label: "Open to either" },
];

export interface BoardItem extends MoodboardItem {
  /** Stable client key: url for web/link, `studio:<id>`, `asset:<id>`. */
  key: string;
}

export interface BuilderState {
  styles: string[];
  colour: BoardColour | null;
  description: string;
  /** Last query the server ran (echoed back for the record). */
  query: string | null;
  items: BoardItem[];
  placement: string;
  size: SizeChoice | "";
  budget: string;
  artistId: string | null;
  notes: string;
  name: string;
  email: string;
  phone: string;
}

export function emptyBuilder(): BuilderState {
  return {
    styles: [], colour: null, description: "", query: null, items: [],
    placement: "", size: "", budget: "", artistId: null, notes: "",
    name: "", email: "", phone: "",
  };
}

export function briefReady(s: BuilderState): boolean {
  return s.styles.length > 0 || s.description.trim().length >= 3;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canAdvance(step: BoardStep, s: BuilderState): boolean {
  switch (step) {
    case "Brief":
      return briefReady(s);
    case "Inspiration":
      return s.items.length > 0;
    case "Details":
      return true;
    case "Send": {
      const email = s.email.trim();
      const phone = s.phone.replace(/\s+/g, "");
      if (!s.name.trim()) return false;
      if (email) return EMAIL_RE.test(email);
      return phone.length >= 6;
    }
    default:
      return false;
  }
}

const blank = (): Omit<MoodboardItem, "kind" | "url"> => ({
  thumbUrl: null, sourceUrl: null, title: null, assetId: null, galleryItemId: null,
});

export function webResultToItem(r: WebImageResult): BoardItem {
  return { ...blank(), kind: "web", key: r.url, url: r.url, thumbUrl: r.thumbUrl, sourceUrl: r.sourceUrl, title: r.title };
}

export function studioResultToItem(r: StudioImageResult): BoardItem {
  return {
    ...blank(), kind: "studio", key: `studio:${r.galleryItemId}`, url: r.url, sourceUrl: r.sourceUrl,
    title: r.artistName ? `${r.title} · ${r.artistName}` : r.title, galleryItemId: r.galleryItemId,
  };
}

export function uploadToItem(u: { assetId: string; url: string }, title: string | null = null): BoardItem {
  return { ...blank(), kind: "upload", key: `asset:${u.assetId}`, url: u.url, assetId: u.assetId, title };
}

export function parsePastedUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function linkToItem(url: string): BoardItem {
  return { ...blank(), kind: "link", key: url, url };
}

export function hasItem(items: BoardItem[], key: string): boolean {
  return items.some((i) => i.key === key);
}

export type ToggleResult =
  | { ok: true; items: BoardItem[]; added: boolean }
  | { ok: false; error: string };

export function toggleItem(items: BoardItem[], item: BoardItem): ToggleResult {
  if (hasItem(items, item.key)) {
    return { ok: true, items: items.filter((i) => i.key !== item.key), added: false };
  }
  if (items.length >= MAX_BOARD_ITEMS) {
    return { ok: false, error: `Your board is full — up to ${MAX_BOARD_ITEMS} images. Remove one to add another.` };
  }
  return { ok: true, items: [...items, item], added: true };
}

export function removeItem(items: BoardItem[], key: string): BoardItem[] {
  return items.filter((i) => i.key !== key);
}

export function buildSearchRequest(s: BuilderState, start = 1) {
  return { styles: s.styles, colour: s.colour, description: s.description.trim(), start };
}

export function budgetToPence(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export interface BoardEnquiryPayload {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredArtistId: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  moodboardData: MoodboardDataInput;
  source: "inkling";
}

export function buildBoardEnquiryPayload(s: BuilderState): BoardEnquiryPayload {
  const description = s.description.trim();
  const notes = s.notes.trim();
  const items = s.items.map(({ key: _key, ...item }) => item);
  return {
    contactName: s.name.trim(),
    contactEmail: s.email.trim() || null,
    contactPhone: s.phone.trim() || null,
    preferredArtistId: s.artistId,
    style: s.styles.length ? s.styles.join(", ") : null,
    placement: s.placement || null,
    size: s.size || null,
    budgetPence: budgetToPence(s.budget),
    description: [description, notes].filter(Boolean).join("\n\n") || null,
    moodboard: items.map((i) => i.url),
    moodboardData: {
      version: 1, styles: s.styles, colour: s.colour, description, query: s.query, notes: notes || null, items,
    },
    source: "inkling",
  };
}
```

`apps/web/src/app/inkling/moodboard/image-prep.ts`:

```ts
/**
 * Client-side downscale before upload so boards stay small in Postgres:
 * long edge ≤ 1600px, JPEG q0.85. Pure sizing maths is exported for tests;
 * `prepareImage` needs a browser (createImageBitmap + canvas).
 */
export const MAX_EDGE = 1600;
export const SKIP_BELOW_BYTES = 600_000;

export function targetDimensions(w: number, h: number, maxEdge = MAX_EDGE) {
  const long = Math.max(w, h);
  if (long <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / long;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function shouldDownscale(sizeBytes: number, w: number, h: number, maxEdge = MAX_EDGE): boolean {
  return sizeBytes > SKIP_BELOW_BYTES && Math.max(w, h) > maxEdge;
}

export async function prepareImage(file: File): Promise<File> {
  if (file.size <= SKIP_BELOW_BYTES || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  if (!shouldDownscale(file.size, bitmap.width, bitmap.height)) {
    bitmap.close();
    return file;
  }
  const { width, height } = targetDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
```

Then in `apps/web/src/app/inkling/logic.ts` remove `InklingEnquiryInput`, `InklingEnquiryPayload`, `buildInklingEnquiryPayload` and the `PLACEMENTS` import if unused (it is used by `MATCH_QUESTIONS` — keep). Update the module doc comment (board payload now lives in `moodboard/logic.ts`). In `inkling/logic.test.ts` delete the `buildInklingEnquiryPayload` describe block and its imports. NOTE: `MoodBoard.tsx` still imports it until Task 7 deletes that file — run `npx tsc --noEmit -p apps/web` only after Task 7; the vitest suite for logic passes now.

- [ ] **Step 4: Run tests, commit**

`npm test -w @bnb/web -- src/app/inkling/moodboard src/app/inkling/logic.test.ts` — PASS.

```bash
git add apps/web/src/app/inkling
git commit -m "feat(web): mood-board builder logic — items, gating, search request, enquiry payload, image prep maths"
```

---

### Task 7: Builder UI + wiring (replaces `MoodBoard.tsx`)

**Files:**
- Create: `apps/web/src/app/inkling/moodboard/MoodBoardBuilder.tsx`, `BriefStep.tsx`, `InspirationStep.tsx`, `DetailsStep.tsx`, `SendStep.tsx`, `BoardSummary.tsx`, `useImageSearch.ts`, `moodboard.module.css`, `MoodBoardBuilder.test.tsx`, `steps.test.tsx`
- Modify: `apps/web/src/app/inkling/page.tsx`, `apps/web/src/app/inkling/InklingTabs.tsx`, `apps/web/src/app/page.tsx` (teaser copy lines ~197-207)
- Delete: `apps/web/src/app/inkling/MoodBoard.tsx`, `apps/web/src/app/inkling/MoodBoard.test.tsx`

**Interfaces:**
- `InklingTabs` props: `{ initialTab?: Tab; artists: InklingArtist[]; styleOptions: string[] }`.
- `MoodBoardBuilder` props: `{ artists: InklingArtist[]; styleOptions: string[] }`.
- Step components take `{ state: BuilderState; set: (patch: Partial<BuilderState>) => void }` plus what they need (`styleOptions`, `artists`, `search`).
- `useImageSearch()` returns `{ status: "idle"|"loading"|"done"|"error"; error: string|null; query: string|null; studio: StudioImageResult[]; web: WebImageResult[]; nextStart: number|null; providerConfigured: boolean; webError: boolean; run(req): Promise<void>; more(req): Promise<void> }`.

- [ ] **Step 1: Failing render tests**

`apps/web/src/app/inkling/moodboard/steps.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../enquire/enquire.module.css", () => ({ default: {} }));
vi.mock("./moodboard.module.css", () => ({ default: {} }));

const { BriefStep } = await import("./BriefStep");
const { InspirationStep } = await import("./InspirationStep");
const { DetailsStep } = await import("./DetailsStep");
const { SendStep } = await import("./SendStep");
const { BoardSummary } = await import("./BoardSummary");
const { emptyBuilder, linkToItem } = await import("./logic");

const set = () => {};
const ARTISTS = [{ id: "a1", name: "Sarah Boots", role: "Co-owner", slug: "sarah", booksStatus: "open" as const }];
const idleSearch = {
  status: "idle" as const, error: null, query: null, studio: [], web: [], nextStart: null,
  providerConfigured: true, webError: false, run: async () => {}, more: async () => {},
};

describe("mood-board steps", () => {
  it("Brief renders style chips, colour options and the description", () => {
    const html = renderToStaticMarkup(<BriefStep state={emptyBuilder()} set={set} styleOptions={["Fine-line", "Realism"]} />);
    expect(html).toContain("Fine-line");
    expect(html).toContain("Black &amp; grey");
    expect(html).toContain("Describe");
  });
  it("Inspiration shows results, the board tray and the upload/paste zone", () => {
    const state = { ...emptyBuilder(), items: [linkToItem("https://x.test/a.png")] };
    const search = {
      ...idleSearch, status: "done" as const,
      studio: [{ galleryItemId: "g1", url: "/uploads/g.jpg", title: "Snake", style: "Fine-line", artistName: "Sarah", sourceUrl: "/gallery" }],
      web: [{ url: "https://i.test/a.jpg", thumbUrl: "https://t.test/a.jpg", sourceUrl: "https://p.test", title: "Peony", width: null, height: null }],
      nextStart: 11,
    };
    const html = renderToStaticMarkup(<InspirationStep state={state} set={set} search={search} />);
    expect(html).toContain("From our studio");
    expect(html).toContain("From the web");
    expect(html).toContain("https://t.test/a.jpg");
    expect(html).toContain("Load more");
    expect(html).toContain("1 of 12");
    expect(html).toContain("Upload");
  });
  it("Inspiration explains when web search is not configured", () => {
    const html = renderToStaticMarkup(
      <InspirationStep state={emptyBuilder()} set={set} search={{ ...idleSearch, status: "done", providerConfigured: false }} />,
    );
    expect(html).toContain("Web search isn");
  });
  it("Details renders placement, size, budget and artists", () => {
    const html = renderToStaticMarkup(<DetailsStep state={emptyBuilder()} set={set} artists={ARTISTS} />);
    expect(html).toContain("Forearm");
    expect(html).toContain("Medium");
    expect(html).toContain("Sarah Boots");
    expect(html).toContain("No preference");
  });
  it("Send renders contact fields; summary reflects the board", () => {
    expect(renderToStaticMarkup(<SendStep state={emptyBuilder()} set={set} />)).toContain("Email");
    const html = renderToStaticMarkup(
      <BoardSummary state={{ ...emptyBuilder(), styles: ["Realism"], items: [linkToItem("https://x.test/a.png")], artistId: "a1" }} artists={ARTISTS} />,
    );
    expect(html).toContain("Realism");
    expect(html).toContain("1 image");
    expect(html).toContain("Sarah Boots");
  });
});
```

`apps/web/src/app/inkling/moodboard/MoodBoardBuilder.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../enquire/enquire.module.css", () => ({ default: {} }));
vi.mock("./moodboard.module.css", () => ({ default: {} }));
const { MoodBoardBuilder } = await import("./MoodBoardBuilder");

describe("MoodBoardBuilder", () => {
  it("renders the stepper on the Brief step with the summary aside", () => {
    const html = renderToStaticMarkup(<MoodBoardBuilder artists={[]} styleOptions={["Fine-line"]} />);
    expect(html).toContain("Brief");
    expect(html).toContain("Inspiration");
    expect(html).toContain("Details");
    expect(html).toContain("Send");
    expect(html).toContain("Your board");
    expect(html).not.toContain("Reference links");
  });
});
```

- [ ] **Step 2: Run — FAIL (modules missing)**

- [ ] **Step 3: CSS module**

`apps/web/src/app/inkling/moodboard/moodboard.module.css`:

```css
/* Inkling mood-board builder — results grid, board tray, upload zone. Reuses
   the heritage custom properties; layout primitives (panel/stepper/nav/aside)
   come from enquire.module.css. */

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.brief {
  color: var(--text-muted);
  font-size: 14px;
}
.group {
  margin-top: 22px;
}
.groupTitle {
  font-family: var(--font-termina);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin: 0 0 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-sm, 10px);
  overflow: hidden;
  border: 1px solid var(--border-default, #2a2420);
  background: var(--bg-base, #120f0d);
  padding: 0;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.tile:hover {
  border-color: var(--bb-gold, #cfa05a);
}
.tile.on {
  border-color: var(--bb-crimson, #c92f4d);
  box-shadow: inset 0 0 0 2px var(--bb-crimson, #c92f4d);
}
.tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tileCheck {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--bb-crimson, #c92f4d);
  color: #fff;
}
.tileCap {
  position: absolute;
  inset: auto 0 0 0;
  padding: 6px 8px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tray {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--border-default, #2a2420);
}
.trayHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.count {
  font-family: var(--font-termina);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bb-gold, #cfa05a);
}
.trayGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}
.trayTile {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-default, #2a2420);
  background: var(--bg-base, #120f0d);
}
.trayTile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.trayRemove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  cursor: pointer;
  line-height: 1;
}
.dropZone {
  margin-top: 18px;
  border: 1px dashed var(--border-default, #2a2420);
  border-radius: var(--radius-sm, 10px);
  padding: 18px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.dropZone.over {
  border-color: var(--bb-gold, #cfa05a);
  background: rgba(207, 160, 90, 0.06);
}
.dropActions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
.hint {
  color: var(--text-muted);
  font-size: 13px;
  margin: 10px 0 0;
}
.loadMore {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.skeleton {
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-sm, 10px);
  background: linear-gradient(90deg, var(--bg-card, #1a1614), var(--bg-raised, #221c19), var(--bg-card, #1a1614));
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
.linkRow {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
```

- [ ] **Step 4: `useImageSearch.ts`**

```ts
"use client";

import { useCallback, useState } from "react";
import type { InspirationResponse, StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";

export interface SearchRequest {
  styles: string[];
  colour: "bw" | "colour" | "either" | null;
  description: string;
  start: number;
}

export interface ImageSearchState {
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  query: string | null;
  studio: StudioImageResult[];
  web: WebImageResult[];
  nextStart: number | null;
  providerConfigured: boolean;
  webError: boolean;
}

export interface ImageSearch extends ImageSearchState {
  run(req: SearchRequest): Promise<void>;
  more(req: SearchRequest): Promise<void>;
}

const initial: ImageSearchState = {
  status: "idle", error: null, query: null, studio: [], web: [], nextStart: null,
  providerConfigured: true, webError: false,
};

async function post(req: SearchRequest): Promise<InspirationResponse> {
  const res = await fetch("/api/inkling/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Couldn't search right now. Please try again.");
  }
  return (await res.json()) as InspirationResponse;
}

export function useImageSearch(): ImageSearch {
  const [state, setState] = useState<ImageSearchState>(initial);

  const run = useCallback(async (req: SearchRequest) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await post({ ...req, start: 1 });
      setState({ status: "done", error: null, query: r.query, studio: r.studio, web: r.web,
        nextStart: r.nextStart, providerConfigured: r.providerConfigured, webError: r.webError });
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Please try again." }));
    }
  }, []);

  const more = useCallback(async (req: SearchRequest) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await post(req);
      setState((s) => ({ ...s, status: "done", web: [...s.web, ...r.web], nextStart: r.nextStart, webError: r.webError }));
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Please try again." }));
    }
  }, []);

  return { ...state, run, more };
}
```

- [ ] **Step 5: Step components**

`BriefStep.tsx`:

```tsx
"use client";

import { Chip, Field } from "@/components/site";
import { COLOUR_OPTIONS, MAX_BOARD_STYLES, toggleStyle, type BuilderState } from "./logic";
import styles from "../../enquire/enquire.module.css";

type Set = (patch: Partial<BuilderState>) => void;

export function BriefStep({ state, set, styleOptions }: { state: BuilderState; set: Set; styleOptions: string[] }) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Your brief</h2>
      <p className={styles.panelSub}>
        Pick the styles you&rsquo;re drawn to and describe the piece. We&rsquo;ll use it to find inspiration.
      </p>
      <Field label={`Styles (up to ${MAX_BOARD_STYLES})`}>
        <div className={styles.chipRow}>
          {styleOptions.map((s) => (
            <Chip key={s} on={state.styles.includes(s)} onClick={() => set({ styles: toggleStyle(state.styles, s) })}>
              {s}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <div className={styles.chipRow}>
          {COLOUR_OPTIONS.map((c) => (
            <Chip key={c.value} gold on={state.colour === c.value} onClick={() => set({ colour: state.colour === c.value ? null : c.value })}>
              {c.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Describe the idea" htmlFor="mb-description" hint="Subject, mood, anything you already know — a sentence is plenty.">
        <textarea
          id="mb-description"
          className="textarea"
          rows={3}
          maxLength={300}
          placeholder="A peony wrapping around the forearm, soft shading…"
          value={state.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}
```

`InspirationStep.tsx` (results + tray + upload/paste/link):

```tsx
"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Check, ImagePlus, Link as LinkIcon, RefreshCw } from "lucide-react";
import type { StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";
import {
  buildSearchRequest, hasItem, linkToItem, MAX_BOARD_ITEMS, parsePastedUrl, removeItem,
  studioResultToItem, toggleItem, uploadToItem, webResultToItem, type BoardItem, type BuilderState,
} from "./logic";
import { prepareImage } from "./image-prep";
import type { ImageSearch } from "./useImageSearch";
import enq from "../../enquire/enquire.module.css";
import css from "./moodboard.module.css";

type Set = (patch: Partial<BuilderState>) => void;

async function uploadFile(file: File): Promise<{ assetId: string; url: string }> {
  const prepared = await prepareImage(file);
  const fd = new FormData();
  fd.set("file", prepared);
  const res = await fetch("/api/inkling/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as { assetId: string; url: string };
}

export function InspirationStep({ state, set, search }: { state: BuilderState; set: Set; search: ImageSearch }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ranFor = useRef<string | null>(null);

  // Run the search once per brief when the step mounts / the brief changes.
  const briefKey = JSON.stringify(buildSearchRequest(state));
  useEffect(() => {
    if (ranFor.current === briefKey) return;
    ranFor.current = briefKey;
    void search.run(buildSearchRequest(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefKey]);

  useEffect(() => {
    if (search.query && search.query !== state.query) set({ query: search.query });
  }, [search.query, state.query, set]);

  function toggle(item: BoardItem) {
    const r = toggleItem(state.items, item);
    if (!r.ok) return setError(r.error);
    setError(null);
    set({ items: r.items });
  }

  async function addFiles(files: Iterable<File>) {
    setBusy(true);
    setError(null);
    try {
      let items = state.items;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const up = await uploadFile(file);
        const r = toggleItem(items, uploadToItem(up, file.name));
        if (!r.ok) {
          setError(r.error);
          break;
        }
        items = r.items;
      }
      set({ items });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function addLink(raw: string): boolean {
    const url = parsePastedUrl(raw);
    if (!url) return false;
    toggle(linkToItem(url));
    setLink("");
    return true;
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    const text = e.clipboardData.getData("text");
    if (text && addLink(text)) e.preventDefault();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void addFiles(files);
  }

  const loading = search.status === "loading";

  return (
    <div onPaste={onPaste}>
      <h2 className={enq.panelTitle}>Inspiration</h2>
      <p className={enq.panelSub}>
        Tap anything that feels right to add it to your board. Upload or paste your own too. References guide the look — we never copy another person&rsquo;s tattoo.
      </p>

      <div className={css.toolbar}>
        <span className={css.brief}>{search.query ? <>Searching for <b>{search.query}</b></> : "Building your search…"}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void search.run(buildSearchRequest(state))} disabled={loading}>
          <RefreshCw className="ic" /> Search again
        </button>
      </div>

      {search.error && <p className={enq.error}>{search.error}</p>}

      {search.studio.length > 0 && (
        <ResultGroup title="From our studio">
          {search.studio.map((r) => <ResultTile key={r.galleryItemId} item={studioResultToItem(r)} items={state.items} onToggle={toggle} />)}
        </ResultGroup>
      )}

      <ResultGroup title="From the web">
        {loading && search.web.length === 0 ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className={css.skeleton} aria-hidden />)
        ) : search.web.length > 0 ? (
          search.web.map((r) => <ResultTile key={r.url} item={webResultToItem(r)} items={state.items} onToggle={toggle} />)
        ) : null}
      </ResultGroup>
      {!search.providerConfigured && search.status !== "idle" && (
        <p className={css.hint}>Web search isn&rsquo;t available right now — upload or paste your own images below.</p>
      )}
      {search.providerConfigured && search.webError && (
        <p className={css.hint}>Web search is unavailable at the moment — you can still upload or paste images.</p>
      )}
      {search.providerConfigured && !loading && search.status === "done" && search.web.length === 0 && !search.webError && (
        <p className={css.hint}>No web results for that brief — try fewer words, or add your own images.</p>
      )}
      {search.nextStart && (
        <div className={css.loadMore}>
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void search.more(buildSearchRequest(state, search.nextStart ?? 1))}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <div
        className={`${css.dropZone} ${over ? css.over : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <ImagePlus className="ic" />
        <div>Drop images here, paste from your clipboard, or</div>
        <div className={css.dropActions}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "Upload images"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          multiple
          className={css.srOnly}
          aria-label="Upload images"
          onChange={(e) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <div className={css.linkRow}>
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="…or paste an image link https://"
            aria-label="Image link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!addLink(link)) setError("That doesn't look like a full http(s) link."); } }}
          />
          <button type="button" className="btn btn-ghost" onClick={() => { if (!addLink(link)) setError("That doesn't look like a full http(s) link."); }}>
            <LinkIcon className="ic" /> Add
          </button>
        </div>
      </div>
      {error && <p className={enq.error}>{error}</p>}

      <div className={css.tray}>
        <div className={css.trayHead}>
          <strong>Your board</strong>
          <span className={css.count}>{state.items.length} of {MAX_BOARD_ITEMS}</span>
        </div>
        {state.items.length === 0 ? (
          <p className={enq.moodEmpty}>Nothing on the board yet — tap an image above to add it.</p>
        ) : (
          <div className={css.trayGrid}>
            {state.items.map((i) => (
              <div key={i.key} className={css.trayTile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.thumbUrl ?? i.url} alt={i.title ?? "Board image"} loading="lazy" />
                <button type="button" className={css.trayRemove} aria-label={`Remove ${i.title ?? "image"}`} onClick={() => set({ items: removeItem(state.items, i.key) })}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={css.group}>
      <h3 className={css.groupTitle}>{title}</h3>
      <div className={css.grid}>{children}</div>
    </section>
  );
}

function ResultTile({ item, items, onToggle }: { item: BoardItem; items: BoardItem[]; onToggle: (i: BoardItem) => void }) {
  const on = hasItem(items, item.key);
  return (
    <button type="button" className={`${css.tile} ${on ? css.on : ""}`} aria-pressed={on} onClick={() => onToggle(item)} title={item.title ?? undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbUrl ?? item.url} alt={item.title ?? "Inspiration image"} loading="lazy" referrerPolicy="no-referrer" />
      {on && <span className={css.tileCheck}><Check size={14} /></span>}
      {item.title && <span className={css.tileCap}>{item.title}</span>}
    </button>
  );
}

export type { StudioImageResult, WebImageResult };
```

`DetailsStep.tsx`:

```tsx
"use client";

import { Chip, Field } from "@/components/site";
import type { InklingArtist } from "../InklingTabs";
import { PLACEMENTS, SIZES, type BuilderState } from "./logic";
import type { SizeChoice } from "../../enquire/logic";
import styles from "../../enquire/enquire.module.css";

type Set = (patch: Partial<BuilderState>) => void;
const BUDGETS = [80, 150, 300, 500];

export function DetailsStep({ state, set, artists }: { state: BuilderState; set: Set; artists: InklingArtist[] }) {
  return (
    <div>
      <h2 className={styles.panelTitle}>The details</h2>
      <p className={styles.panelSub}>Roughly where and how big — all optional, all helpful.</p>
      <Field label="Placement" htmlFor="mb-placement">
        <select id="mb-placement" className="select" value={state.placement} onChange={(e) => set({ placement: e.target.value })}>
          <option value="">Not sure yet</option>
          {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="Rough size">
        <div className={styles.chipRow}>
          {SIZES.map((sz) => (
            <Chip key={sz} gold on={state.size === sz} onClick={() => set({ size: state.size === sz ? "" : (sz as SizeChoice) })}>{sz}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Rough budget (£, optional)" htmlFor="mb-budget" hint="A ballpark helps your artist size the piece — never a commitment.">
        <input id="mb-budget" className="input" inputMode="decimal" placeholder="e.g. 150" value={state.budget} onChange={(e) => set({ budget: e.target.value })} />
        <div className={styles.chipRow} style={{ marginTop: 8 }}>
          {BUDGETS.map((b) => <Chip key={b} gold on={state.budget === String(b)} onClick={() => set({ budget: String(b) })}>£{b}</Chip>)}
        </div>
      </Field>
      <Field label="Artist">
        <div className={styles.choiceGrid}>
          <button type="button" className={`${styles.choice} ${state.artistId === null ? styles.on : ""}`} onClick={() => set({ artistId: null })}>
            <span className={styles.choiceName}>No preference</span>
            <span className={styles.choiceMeta}>Let the studio decide</span>
          </button>
          {artists.map((a) => (
            <button key={a.id} type="button" className={`${styles.choice} ${state.artistId === a.id ? styles.on : ""}`} onClick={() => set({ artistId: a.id })}>
              <span className={styles.choiceName}>{a.name}</span>
              <span className={styles.choiceMeta}>{a.role} · books {a.booksStatus}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Anything else?" htmlFor="mb-notes">
        <textarea id="mb-notes" className="textarea" rows={3} maxLength={1000} value={state.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}
```

`SendStep.tsx`:

```tsx
"use client";

import { Field } from "@/components/site";
import type { BuilderState } from "./logic";
import styles from "../../enquire/enquire.module.css";

type Set = (patch: Partial<BuilderState>) => void;

export function SendStep({ state, set }: { state: BuilderState; set: Set }) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Send it to the studio</h2>
      <p className={styles.panelSub}>We&rsquo;ll review your board and the right artist will get back to you. No deposit, no payment.</p>
      <Field label="Name" htmlFor="mb-name">
        <input id="mb-name" className="input" autoComplete="name" value={state.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Email" htmlFor="mb-email" hint="We'll send a confirmation here.">
        <input id="mb-email" className="input" type="email" autoComplete="email" value={state.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <Field label="Phone" htmlFor="mb-phone" hint="Email or phone — at least one, please.">
        <input id="mb-phone" className="input" inputMode="tel" autoComplete="tel" value={state.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
    </div>
  );
}
```

`BoardSummary.tsx`:

```tsx
import type { InklingArtist } from "../InklingTabs";
import { COLOUR_OPTIONS, type BuilderState } from "./logic";
import styles from "../../enquire/enquire.module.css";

export function BoardSummary({ state, artists }: { state: BuilderState; artists: InklingArtist[] }) {
  const artist = artists.find((a) => a.id === state.artistId);
  const colour = COLOUR_OPTIONS.find((c) => c.value === state.colour)?.label;
  const n = state.items.length;
  return (
    <aside className={styles.aside}>
      <strong>Your board</strong>
      <dl>
        <dt>Images</dt>
        <dd>{n === 0 ? "None yet" : `${n} image${n === 1 ? "" : "s"}`}</dd>
        {state.styles.length > 0 && (<><dt>Styles</dt><dd>{state.styles.join(", ")}</dd></>)}
        {colour && (<><dt>Colour</dt><dd>{colour}</dd></>)}
        {state.description.trim() && (<><dt>Idea</dt><dd>{state.description.trim()}</dd></>)}
        {state.placement && (<><dt>Placement</dt><dd>{state.placement}</dd></>)}
        {state.size && (<><dt>Size</dt><dd>{state.size}</dd></>)}
        {state.budget.trim() && (<><dt>Budget</dt><dd>£{state.budget.trim()}</dd></>)}
        <dt>Artist</dt>
        <dd>{artist ? artist.name : "No preference"}</dd>
      </dl>
    </aside>
  );
}
```

`MoodBoardBuilder.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { InklingArtist } from "../InklingTabs";
import { BOARD_STEPS, buildBoardEnquiryPayload, canAdvance, emptyBuilder, type BuilderState } from "./logic";
import { BriefStep } from "./BriefStep";
import { InspirationStep } from "./InspirationStep";
import { DetailsStep } from "./DetailsStep";
import { SendStep } from "./SendStep";
import { BoardSummary } from "./BoardSummary";
import { useImageSearch } from "./useImageSearch";
import styles from "../../enquire/enquire.module.css";

/**
 * Inkling mood-board builder: Brief → Inspiration → Details → Send. Mirrors
 * the Enquire wizard's stepper/panel/aside layout; all state lives here and
 * the steps are controlled. Submits to POST /api/enquiries (source=inkling).
 */
export function MoodBoardBuilder({ artists, styleOptions }: { artists: InklingArtist[]; styleOptions: string[] }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<BuilderState>(emptyBuilder);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const search = useImageSearch();

  const step = BOARD_STEPS[stepIdx];
  const set = (patch: Partial<BuilderState>) => setState((s) => ({ ...s, ...patch }));

  function next() {
    if (!canAdvance(step, state)) return;
    if (stepIdx < BOARD_STEPS.length - 1) setStepIdx(stepIdx + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBoardEnquiryPayload(state)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't send your board. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const n = state.items.length;
    return (
      <div className={styles.successWrap}>
        <div className={styles.orb}><Check /></div>
        <h2 className="display">Board sent</h2>
        <p className="lead">
          Thanks {state.name.split(" ")[0] || "—"}. {n} image{n === 1 ? "" : "s"} on their way to the studio — we&rsquo;ll review it and be in touch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ol className={styles.stepper}>
        {BOARD_STEPS.map((s, i) => (
          <li key={s} className={`${styles.step} ${i === stepIdx ? styles.active : i < stepIdx ? styles.done : ""}`}>
            <span className={styles.stepNum}>{i < stepIdx ? <Check size={12} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className={styles.cols}>
        <div className={styles.panel}>
          {step === "Brief" && <BriefStep state={state} set={set} styleOptions={styleOptions} />}
          {step === "Inspiration" && <InspirationStep state={state} set={set} search={search} />}
          {step === "Details" && <DetailsStep state={state} set={set} artists={artists} />}
          {step === "Send" && <SendStep state={state} set={set} />}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.nav}>
            <button type="button" className="btn btn-ghost" onClick={back} disabled={stepIdx === 0}>
              <ArrowLeft className="ic" /> Back
            </button>
            {step === "Send" ? (
              <button type="button" className="btn" onClick={submit} disabled={submitting || !canAdvance(step, state)}>
                {submitting ? "Sending…" : "Send board"}
              </button>
            ) : (
              <button type="button" className="btn" onClick={next} disabled={!canAdvance(step, state)}>
                {step === "Brief" ? "Find inspiration" : "Continue"} <ArrowRight className="ic" />
              </button>
            )}
          </div>
        </div>
        <BoardSummary state={state} artists={artists} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire page + tabs, delete old component, teaser copy**

`InklingTabs.tsx`: add `styleOptions: string[]` prop; replace `import { MoodBoard } from "./MoodBoard"` with `import { MoodBoardBuilder } from "./moodboard/MoodBoardBuilder"`; render `<MoodBoardBuilder artists={artists} styleOptions={styleOptions} />`.

`page.tsx`: add
```ts
async function loadStyles(): Promise<string[]> {
  try {
    const rows = await prisma.tattooStyle.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } });
    return rows.map((s) => s.name);
  } catch {
    return [];
  }
}
```
load with `Promise.all([loadArtists(), loadStyles()])`, pass `styleOptions={styles}`. Update the header lead copy to: "Not sure where to start? Answer a few questions to get matched, or build a mood board of inspiration and send it to the studio." Update the file doc comment (Mood Board = search-driven builder → `/api/enquiries` source=inkling).

`git rm apps/web/src/app/inkling/MoodBoard.tsx apps/web/src/app/inkling/MoodBoard.test.tsx`.

`apps/web/src/app/page.tsx` Mood Board row `<small>`: "Pick styles, describe the piece, and build a board from web inspiration and our work."

- [ ] **Step 7: Verify**

```bash
npm test -w @bnb/web
npx tsc --noEmit -p apps/web
npm run lint -w @bnb/web
```
All green. Then `npm run dev:web`, open `http://localhost:3000/inkling?tab=mood`, walk the four steps (search will be studio-only unless `GOOGLE_CSE_KEY`/`GOOGLE_CSE_CX` are in `.env`), upload a photo, paste an image URL, send; confirm a new row appears in the admin inbox with thumbnails.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/inkling apps/web/src/app/page.tsx
git commit -m "feat(web): Inkling mood-board builder — brief, inspiration search + upload/paste board, details, send"
```

---

### Task 8: Admin — artist visibility, claim, board detail, source filter

**Files:**
- Modify: `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+ `.test.ts`), `page.tsx`, `actions.ts` (+ `.test.ts`), `EnquiryDetailSections.tsx` (+ `.test.tsx`), `EnquiryInbox.tsx`

**Interfaces (produces):**
```ts
// enquiry-helpers.ts
export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput
export function isOpenBoard(e: { source: EnquirySource; preferredArtistId: string | null }): boolean
export function canAccessEnquiry(user: { role: "OWNER"|"ARTIST"; artistId?: string|null }, e: { source: EnquirySource; preferredArtistId: string|null }): boolean
export interface InboxFilter { artistId: string|null; style: string|null; source: EnquirySource|null }   // filterEnquiries honours source
// actions.ts
export async function claimEnquiry(enquiryId: string): Promise<ActionState>
// EnquiryDetailSections.tsx
export function MoodBoardBriefSection({ data }: { data: MoodboardData | null })
export function MoodboardSection({ urls, data }: { urls: string[]; data?: MoodboardData | null })
// EnquiryInbox.tsx
EnquiryItem gains moodboardData: MoodboardData | null; props gain viewerArtistId: string | null
```

- [ ] **Step 1: Helper tests (append to `enquiry-helpers.test.ts`)**

```ts
import { artistInboxWhere, canAccessEnquiry, filterEnquiries, isOpenBoard } from "./enquiry-helpers";

describe("artist scope + open boards", () => {
  it("artists see their own enquiries plus unassigned Inkling boards", () => {
    expect(artistInboxWhere("art1")).toEqual({
      OR: [{ preferredArtistId: "art1" }, { source: "inkling", preferredArtistId: null }],
    });
  });
  it("isOpenBoard / canAccessEnquiry", () => {
    const open = { source: "inkling" as const, preferredArtistId: null };
    const mine = { source: "web" as const, preferredArtistId: "art1" };
    const other = { source: "web" as const, preferredArtistId: "art2" };
    expect(isOpenBoard(open)).toBe(true);
    expect(isOpenBoard({ source: "web", preferredArtistId: null })).toBe(false);
    const artist = { role: "ARTIST" as const, artistId: "art1" };
    expect(canAccessEnquiry(artist, open)).toBe(true);
    expect(canAccessEnquiry(artist, mine)).toBe(true);
    expect(canAccessEnquiry(artist, other)).toBe(false);
    expect(canAccessEnquiry({ role: "OWNER" }, other)).toBe(true);
    expect(canAccessEnquiry({ role: "ARTIST", artistId: null }, open)).toBe(false);
  });
  it("filterEnquiries honours the source filter", () => {
    const items = [
      { preferredArtistId: null, style: null, source: "inkling" as const },
      { preferredArtistId: null, style: null, source: "web" as const },
    ];
    expect(filterEnquiries(items, { artistId: null, style: null, source: "inkling" })).toHaveLength(1);
    expect(filterEnquiries(items, { artistId: null, style: null, source: null })).toHaveLength(2);
  });
});
```

Existing `filterEnquiries` callers/tests pass `{ artistId, style }` — add `source: null` to those test objects.

- [ ] **Step 2: Implement helpers**

In `enquiry-helpers.ts`: `import type { BookingType, EnquirySource, EnquiryStatus, Prisma } from "@prisma/client";`

```ts
/** Artists see enquiries that prefer them PLUS unassigned Inkling mood boards. */
export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput {
  return { OR: [{ preferredArtistId: artistId }, { source: "inkling", preferredArtistId: null }] };
}

export function isOpenBoard(e: { source: EnquirySource; preferredArtistId: string | null }): boolean {
  return e.source === "inkling" && e.preferredArtistId === null;
}

export function canAccessEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { source: EnquirySource; preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  if (!user.artistId) return false;
  return e.preferredArtistId === user.artistId || isOpenBoard(e);
}
```
Extend `InboxFilter` with `source: EnquirySource | null` and `filterEnquiries`'s generic to include `source: EnquirySource`, adding `if (filter.source && i.source !== filter.source) return false;`.

- [ ] **Step 3: Actions — scoped load, claim, reply-claims**

`actions.test.ts` additions (extend the mocked prisma with `enquiry.update` already present; `ENQUIRY` gets `source: "web"`):

```ts
describe("artist access + claiming", () => {
  const ARTIST = { id: "u2", email: "a@x", role: "ARTIST" as const, displayName: "Art", artistId: "art9" };
  it("forbids an artist replying to another artist's enquiry", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    await expect(replyToEnquiry("e1", { message: "hi" })).rejects.toThrow(/Forbidden/);
  });
  it("lets an artist reply to an open Inkling board and claims it", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({ ...ENQUIRY, source: "inkling", preferredArtistId: null } as never);
    const res = await replyToEnquiry("e1", { message: "Love this — let's talk." });
    expect(res.ok).toBe(true);
    expect(prisma.enquiry.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { preferredArtistId: "art9" } });
  });
  it("claimEnquiry assigns an open board to the artist, refuses taken ones", async () => {
    const { claimEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({ ...ENQUIRY, source: "inkling", preferredArtistId: null } as never);
    expect((await claimEnquiry("e1")).ok).toBe(true);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({ ...ENQUIRY, source: "inkling", preferredArtistId: "art1" } as never);
    await expect(claimEnquiry("e1")).rejects.toThrow(/Forbidden/);
  });
});
```

In `actions.ts`:
- `loadEnquiryScoped` selects `source: true` too and returns `{ user, enquiry }`, using `canAccessEnquiry(user, enquiry)` → `throw new Error("Forbidden")`. Update the four callers (`replyToEnquiry`, `assignEnquiry`, `closeEnquiry`, `convertEnquiry`) to destructure `{ enquiry }` (convert already has `user`; use the returned one).
- In `replyToEnquiry`, after a successful send/log and before `revalidatePath`: 
  ```ts
  if (user.role !== "OWNER" && user.artistId && isOpenBoard(enquiry)) {
    await prisma.enquiry.update({ where: { id: enquiryId }, data: { preferredArtistId: user.artistId } });
  }
  ```
  (place it in both the no-email and email branches, via a small `claimIfOpen(user, enquiry)` local function).
- New:
  ```ts
  export async function claimEnquiry(enquiryId: string): Promise<ActionState> {
    const { user, enquiry } = await loadEnquiryScoped(enquiryId);
    if (!user.artistId) return { ok: false, message: "Only artists can take a board." };
    if (!isOpenBoard(enquiry)) return { ok: false, message: "This board has already been taken." };
    await prisma.enquiry.update({ where: { id: enquiryId }, data: { preferredArtistId: user.artistId } });
    revalidatePath("/enquiries");
    return { ok: true, message: "Board is yours — it now shows under your enquiries." };
  }
  ```
  (Note the test expects a taken board to throw Forbidden — that happens in `loadEnquiryScoped` for `art1 ≠ art9`, before the friendly message. Keep both.)

- [ ] **Step 4: Page scope + item shape**

`page.tsx`: `where: owner ? {} : artistInboxWhere(user.artistId ?? "__none__")`; add `moodboardData: parseMoodboardData(e.moodboardData)` to each item (import from `@bnb/core/services/moodboard-data`); pass `viewerArtistId={owner ? null : (user.artistId ?? null)}` to `EnquiryInbox`. Update the doc comment.

- [ ] **Step 5: Detail sections + tests**

`EnquiryDetailSections.test.tsx` additions:
```ts
import { MoodBoardBriefSection } from "./EnquiryDetailSections";
const DATA = { version: 1 as const, styles: ["Fine-line"], colour: "bw" as const, description: "peony", query: "peony fine-line black and grey tattoo", notes: "wrap it", items: [
  { kind: "web" as const, url: "https://i.test/a.jpg", thumbUrl: "https://t.test/a.jpg", sourceUrl: "https://p.test/a", title: "Peony", assetId: null, galleryItemId: null },
  { kind: "upload" as const, url: "https://site.test/api/inkling/assets/a1", thumbUrl: null, sourceUrl: null, title: "mine.jpg", assetId: "a1", galleryItemId: null },
] };
it("brief section renders styles/colour/query; board renders kind badges + source links", () => {
  const brief = renderToStaticMarkup(<MoodBoardBriefSection data={DATA} />);
  expect(brief).toContain("Fine-line");
  expect(brief).toContain("Black &amp; grey");
  expect(brief).toContain("peony fine-line");
  expect(MoodBoardBriefSection({ data: null })).toBeNull();
  const board = renderToStaticMarkup(<MoodboardSection urls={DATA.items.map((i) => i.url)} data={DATA} />);
  expect(board).toContain("https://t.test/a.jpg");
  expect(board).toContain("https://p.test/a");
  expect(board).toContain("Web");
  expect(board).toContain("Upload");
});
```
(Add `import { renderToStaticMarkup } from "react-dom/server";` at the top.)

Implementation in `EnquiryDetailSections.tsx`:

```tsx
import type { MoodboardData, MoodboardItem } from "@bnb/core/services/moodboard-data";

const KIND_LABEL: Record<MoodboardItem["kind"], string> = { web: "Web", studio: "Studio", upload: "Upload", link: "Link" };
const COLOUR_LABEL = { bw: "Black & grey", colour: "Colour", either: "Open to either" } as const;

export function MoodBoardBriefSection({ data }: { data: MoodboardData | null }) {
  if (!data) return null;
  return (
    <section className="space-y-2">
      <Label>Mood board brief</Label>
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border-default bg-bg-base p-3 text-sm">
        <div><dt className="text-xs uppercase tracking-wide text-text-muted">Styles</dt><dd className="text-text-secondary">{data.styles.join(", ") || "—"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-text-muted">Colour</dt><dd className="text-text-secondary">{data.colour ? COLOUR_LABEL[data.colour] : "—"}</dd></div>
        <div className="col-span-2"><dt className="text-xs uppercase tracking-wide text-text-muted">Idea</dt><dd className="text-text-secondary">{data.description || "—"}</dd></div>
        {data.query && (<div className="col-span-2"><dt className="text-xs uppercase tracking-wide text-text-muted">Search we ran</dt><dd className="text-text-muted">{data.query}</dd></div>)}
        {data.notes && (<div className="col-span-2"><dt className="text-xs uppercase tracking-wide text-text-muted">Notes</dt><dd className="text-text-secondary">{data.notes}</dd></div>)}
      </dl>
    </section>
  );
}

export function MoodboardSection({ urls, data }: { urls: string[]; data?: MoodboardData | null }) {
  if (data && data.items.length > 0) {
    return (
      <section className="space-y-2">
        <Label>Mood board ({data.items.length})</Label>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data.items.map((item, i) => (
            <li key={`${item.url}-${i}`} className="space-y-1">
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbUrl ?? item.url} alt={item.title ?? `Board image ${i + 1}`} referrerPolicy="no-referrer" className="aspect-square w-full rounded-md border border-border-default object-cover" />
              </a>
              <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted">
                <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                {item.sourceUrl && (<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="truncate underline">source</a>)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (urls.length === 0) return null;
  // …existing URL-thumbnail rendering unchanged…
}
```

- [ ] **Step 6: Inbox UI**

In `EnquiryInbox.tsx`:
- `EnquiryItem` add `moodboardData: MoodboardData | null;` (type import from `@bnb/core/services/moodboard-data`).
- Props add `viewerArtistId: string | null`.
- Add a source filter next to the style filter: `const [sourceFilter, setSourceFilter] = useState(ALL);` with items `[{ALL,"All sources"},{"inkling","Mood boards"},{"web","Web"},{"flash","Flash"}]`, `aria-label="Filter by source"`, and pass `source: sourceFilter === ALL ? null : (sourceFilter as EnquirySource)` to `filterEnquiries`.
- Row trigger: after the source badge, `{isOpenBoard(item) && <Badge>Open board</Badge>}`; the source badge label reads "Mood board" for `inkling` (map: `{ web: "Web", flash: "Flash", inkling: "Mood board" }`).
- Dialog: render `<MoodBoardBriefSection data={item.moodboardData} />` above `<MoodboardSection urls={item.moodboard} data={item.moodboardData} />`. Before the Assign section, when `viewerArtistId && isOpenBoard(item)`:
  ```tsx
  <Button onClick={() => run(() => claimEnquiry(item.id))} disabled={pending}>Take this board</Button>
  ```
  and label the reply button "Respond" when `item.source === "inkling"`; the reply label hint: "Reply (emails customer — responding to an open board assigns it to you)" for artists on open boards.
- Pass `viewerArtistId` from `EnquiryInbox` → `EnquiryRow`.

- [ ] **Step 7: Verify + commit**

```bash
npm test -w @bnb/admin
npx tsc --noEmit -p apps/admin
npm run lint -w @bnb/admin
```
Manual: sign in as an artist (`npm run admin:link` if needed), confirm an unassigned Inkling board shows with "Open board", take it, reply; as owner confirm the Source filter and the brief/board sections.

```bash
git add "apps/admin/src/app/(staff)/enquiries"
git commit -m "feat(admin): mood boards in the inbox — artist visibility of open boards, claim/respond, brief + board detail, source filter"
```

---

### Task 9: Config, docs, full verification

**Files:**
- Modify: `.env.example`, `apps/web/.env.example`, `.env.production.example`, `docker-compose.prod.yml` (web service env), `docs/DEPLOY.md`, `docs/PROJECT-BRIEF.md`

- [ ] **Step 1: Env + compose**

Append to root `.env.example` and `apps/web/.env.example`:
```
# Inkling mood-board inspiration search — Google Programmable Search (Custom
# Search JSON API) with image search enabled on the engine. Optional: without
# both values the builder shows studio-gallery matches + uploads only.
GOOGLE_CSE_KEY=""
GOOGLE_CSE_CX=""
```
Same block in `.env.production.example`. In `docker-compose.prod.yml` `web.environment` add:
```yaml
      GOOGLE_CSE_KEY: ${GOOGLE_CSE_KEY:-}
      GOOGLE_CSE_CX: ${GOOGLE_CSE_CX:-}
```
`docs/DEPLOY.md`: one bullet in the environment section: "`GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` (optional) — Google Programmable Search credentials for the Inkling mood-board image search; create an engine at programmablesearchengine.google.com with *Image search* on and *Search the entire web* on, and an API key in Google Cloud for the Custom Search JSON API (100 free queries/day)."

- [ ] **Step 2: Brief build log**

Append to `docs/PROJECT-BRIEF.md` after the artist showcase / latest entry:
```
## Inkling mood-board builder (2026-09-07) — DONE
Replaced the paste-a-URL Mood Board tab with a 4-step builder (Brief → Inspiration → Details → Send): styles + colour + description drive a deterministic image search (Google Programmable Search via `@bnb/core/services/image-search`, studio gallery matches shown first), visitors tap results or upload/paste their own (stored in Postgres `MoodboardAsset`, served from web `/api/inkling/assets/[id]`, orphans purged by cron), then add placement/size/budget/artist + contact and send (`Enquiry.moodboardData` JSON + `moodboard[]` URLs). Admin: artists now see unassigned Inkling boards, can take or respond (reply claims), inbox has a Source filter and a brief + board detail. Env: `GOOGLE_CSE_KEY`/`GOOGLE_CSE_CX` (optional). Spec: `docs/superpowers/specs/2026-09-07-inkling-moodboard-builder-design.md`.
```

- [ ] **Step 3: Full verification**

```bash
npm run lint
npm test
npx tsc --noEmit -p apps/web && npx tsc --noEmit -p apps/admin && npx tsc --noEmit -p apps/reception
npm run build -w @bnb/web && npm run build -w @bnb/admin
npx prettier --check "apps/web/src/app/inkling/**" "apps/admin/src/app/(staff)/enquiries/**" "packages/core/src/**" docs/superpowers
```
All green; fix formatting with `npx prettier --write <paths>` if needed.

- [ ] **Step 4: Commit**

```bash
git add .env.example apps/web/.env.example .env.production.example docker-compose.prod.yml docs/DEPLOY.md docs/PROJECT-BRIEF.md
git commit -m "chore(config): Google Programmable Search env for Inkling; deploy + brief docs"
```

---

## Self-review notes

- Spec coverage: flow (T7), provider + query (T4), studio matches (T4), uploads in Postgres + asset route + purge (T3, T5), `moodboardData` + `moodboard[]` (T2, T5, T6), artist review/claim (T8), enquire wizard untouched, config/docs (T9). Home teaser copy (T7 step 6).
- Type names are consistent: `MoodboardData`/`MoodboardItem`/`BoardColour` from `moodboard-data.ts`; `WebImageResult`/`StudioImageResult`/`InspirationResponse` from `image-search.ts`; `BoardItem`/`BuilderState` from `moodboard/logic.ts`; `ImageSearch` from `useImageSearch.ts`.
- `toggleStyle`, `MAX_STYLES`, `PLACEMENTS`, `SIZES`, `SizeChoice` are re-exported from `apps/web/src/app/enquire/logic.ts` (all exist there today).
