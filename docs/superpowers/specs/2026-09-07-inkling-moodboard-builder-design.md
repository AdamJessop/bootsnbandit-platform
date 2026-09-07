# Inkling Mood Board Builder — Design Spec

**Date:** 2026-09-07
**Status:** Approved for implementation (autonomous goal session; decisions
below were made by Claude and are flagged where the user may want to revisit)

## Goal

Replace the Inkling "Mood Board" tab (paste-a-URL capture + contact form) with
a guided **mood board builder** that mirrors the original Inkling design
generator flow: the visitor picks styles and describes the piece, we show them
inspiration images (a web image search seeded with their brief plus "tattoo",
alongside matching work from the studio's own gallery), they tap to add
images to their board or upload / paste their own, then add placement, size,
budget, artist preference and contact details and send the board to the
studio. The studio reviews boards in the admin enquiry inbox, and artists can
review open boards and respond.

## Context

- `apps/web/src/app/inkling/` — `page.tsx` (server shell, loads artists),
  `InklingTabs.tsx` (Style Matcher | Mood Board), `StyleMatcher.tsx`,
  `MoodBoard.tsx` (to be replaced), `logic.ts` (quiz + enquiry payload).
- The Enquire wizard (`apps/web/src/app/enquire/`) is the visual pattern to
  follow: stepper, `panel`/`cols`/`aside` summary, `Chip`/`Field` primitives,
  `enquire.module.css`.
- Leads land in `Enquiry` (`packages/core/prisma/schema.prisma:269`) via
  `POST /api/enquiries` (web) → `createEnquiry` (`@bnb/core/services/enquiries`),
  which upserts a Customer and sends the `enquiry_ack` email.
- Admin inbox: `apps/admin/src/app/(staff)/enquiries/` — owners see all,
  artists see enquiries with `preferredArtistId === their artist`. Detail
  dialog renders `moodboard: string[]` as thumbnails, plus reply / assign /
  convert / close server actions.
- Admin has an owner-gated `POST /api/uploads` writing to `public/uploads/`
  (documented as dev storage). Web and admin run as separate containers in
  production, so filesystem uploads on one origin are invisible to the other
  and do not survive redeploys.
- The prototype's `pages-ai.jsx` / `moodboard.jsx` are not in the repo or in
  any Claude Design project, so the "design generator" flow is reconstructed
  from the brief: pick styles → describe → results → pick favourites → send.

## Decisions

1. **Flow.** Four steps inside the existing Mood Board tab: **Brief** →
   **Inspiration** → **Details** → **Send**. Same stepper / panel / summary
   aside as the Enquire wizard. The Style Matcher tab is untouched.
2. **Image search provider.** Google Programmable Search (Custom Search JSON
   API, `searchType=image`, `safe=active`) behind a small provider interface
   in `@bnb/core`. Configured by `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX`. When
   unset, the web results section is hidden with a hint and the builder still
   works with studio gallery matches + uploads. *(User may prefer another
   provider; the interface isolates that choice to one file.)*
3. **Query building** is deterministic and server-side: description + chosen
   styles + colour preference + the word "tattoo", normalised and capped.
   Studio gallery matches come from `GalleryItem` rows with an image whose
   `style` is one of the chosen styles (or any style when none chosen),
   filtered by description keywords against `title` when that yields hits.
4. **Uploads / paste are stored in Postgres**, not on disk: a new
   `MoodboardAsset` table holds the bytes (max 5 MB after client-side
   downscale to ≤1600 px), served publicly by unguessable id from the web app
   at `GET /api/inkling/assets/[id]`. This survives redeploys and is
   reachable from the admin origin. Orphan assets (never attached to an
   enquiry) are purged by a new cron job after 24 h.
5. **Data model.** Keep `Enquiry.moodboard: string[]` (display URLs — the
   admin thumbnails and older code keep working) and add
   `Enquiry.moodboardData: Json?` holding the rich board (styles, colour,
   description, search query, items with kind / source page / thumbnail /
   asset id). No new "Moodboard" table.
6. **Artist review.** Artists see, in addition to enquiries assigned to them,
   **unassigned Inkling boards** (`source = inkling`, `preferredArtistId =
   null`). An artist replying to an unassigned board claims it (sets
   `preferredArtistId` to them) in the same action; a "Take this board"
   button does the claim alone. Owners keep full visibility and assign as
   today.
7. **Scope guard.** The Enquire wizard's own "Mood board" step keeps the
   paste-URL `MoodboardRefs` component. Swapping it for the new picker is a
   follow-up.

## Architecture

### Web (`apps/web`)

```
src/app/inkling/
  page.tsx               loads artists + styles + studio gallery flag → InklingTabs
  InklingTabs.tsx        tab shell (unchanged API, passes new props)
  StyleMatcher.tsx       unchanged
  moodboard/
    logic.ts             pure: steps, state, reducer helpers, payload builder
    logic.test.ts
    MoodBoardBuilder.tsx client shell: stepper, step switch, submit, success
    BriefStep.tsx        styles chips (≤3), colour, description textarea
    InspirationStep.tsx  search trigger, results grid, board tray, upload/paste
    DetailsStep.tsx      placement, size, budget, artist, notes
    SendStep.tsx         contact fields + consent copy
    BoardSummary.tsx     aside (brief, board count, details)
    useImageSearch.ts    fetch wrapper for /api/inkling/search (+ load more)
    image-prep.ts        pure-ish client downscale helper (canvas) + tests for
                         the size math
    moodboard.module.css builder-specific styles (results grid, tray, tiles)
src/app/api/inkling/
  search/route.ts        POST — rate-limited, zod, calls core searchInspiration
  uploads/route.ts       POST — rate-limited, multipart, sniff, store asset
  assets/[id]/route.ts   GET  — streams asset bytes, immutable cache headers
```

`MoodBoard.tsx` and `MoodBoard.test.tsx` are deleted. `logic.ts`'s
`buildInklingEnquiryPayload` gains the new board fields (the matcher's
enquire path still links to `/enquire`, so only the board uses it).

**Builder state** (`moodboard/logic.ts`):

```ts
interface BoardItem {
  key: string;                 // stable client key (url or asset id)
  kind: "web" | "studio" | "upload" | "link";
  url: string;                 // full-size display URL (asset URL for uploads)
  thumbUrl: string | null;
  sourceUrl: string | null;    // page the image came from (web) / gallery page
  title: string | null;
  assetId: string | null;      // uploads only
  galleryItemId: string | null;// studio only
}
interface BuilderState {
  styles: string[]; colour: "bw" | "colour" | "either" | null;
  description: string;
  items: BoardItem[];          // MAX_BOARD_ITEMS = 12
  placement: string; size: SizeChoice | ""; budget: string;
  artistId: string | null; notes: string;
  name: string; email: string; phone: string;
}
```

Pure helpers: `emptyBuilder()`, `toggleItem(items, item)` (dedupe by key,
cap), `removeItem`, `canAdvance(step, state)` (Brief needs ≥1 style or a
description ≥ 3 chars; Inspiration needs ≥1 item; Details always; Send needs
name + email-or-phone), `buildSearchRequest(state, start)`,
`buildBoardEnquiryPayload(state)`.

**Paste / upload.** The Inspiration step listens for `paste` on its
container: image files in the clipboard go through `prepareImage` (downscale
via canvas, re-encode JPEG q0.85, skip if already small) then
`POST /api/inkling/uploads`; a pasted http(s) URL becomes a `link` item.
A file input + drop zone use the same path. Upload errors show inline.

### Core (`packages/core`)

```
src/services/image-search.ts      buildInspirationQuery(), ImageSearchProvider
                                  interface, googleCseProvider(env),
                                  searchInspiration({ styles, colour,
                                  description, start }) → { query, studio[],
                                  web[], nextStart, providerConfigured }
                                  with an in-process TTL cache (10 min, 200 keys)
src/services/image-search.test.ts
src/services/moodboard-assets.ts  createMoodboardAsset(bytes, mime),
                                  getMoodboardAsset(id), attachAssetsToEnquiry,
                                  purgeOrphanMoodboardAssets(olderThanHours)
src/services/moodboard-assets.test.ts (testdb harness)
src/uploads.ts                    sniffImageMime + EXT_BY_MIME moved here from
                                  the admin route (admin imports it)
src/uploads.test.ts
src/cron/moodboard-assets.ts      runMoodboardAssetPurge() → CronJobResult
src/services/enquiries.ts         CreateEnquiryInput gains moodboardData +
                                  assetIds; createEnquiry attaches assets
```

`package.json` exports gain `./uploads`.

### Schema (Prisma migration `20260907120000_moodboard_builder`)

```prisma
model Enquiry {
  ...
  moodboardData Json?
  moodboardAssets MoodboardAsset[]
}

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

`moodboardData` shape (version 1):

```json
{
  "version": 1,
  "styles": ["Fine-line"], "colour": "bw",
  "description": "peony wrapping the forearm",
  "query": "peony wrapping the forearm fine-line black and grey tattoo",
  "items": [
    { "kind": "web", "url": "https://…/img.jpg", "thumbUrl": "https://…",
      "sourceUrl": "https://…/page", "title": "…", "assetId": null,
      "galleryItemId": null }
  ],
  "notes": "…"
}
```

### Public API (web)

| Route | Method | Notes |
| --- | --- | --- |
| `/api/inkling/search` | POST | `{ styles: string[], colour?, description: string, start?: number }` → `{ query, studio, web, nextStart, providerConfigured }`. 20 req/min/IP. Query result cached in-process. Never leaks the API key or raw provider errors (maps to 502 with a friendly message). |
| `/api/inkling/uploads` | POST | multipart `file`; 10 req/min/IP; ≤5 MB; magic-number sniff (png/jpeg/webp/gif/avif); returns `{ assetId, url }` where `url` is `/api/inkling/assets/<id>`. |
| `/api/inkling/assets/[id]` | GET | streams bytes with the stored mime, `Cache-Control: public, max-age=31536000, immutable`, 404 when unknown. |
| `/api/enquiries` | POST | schema extended with `moodboardData` (object, validated loosely: version, styles[], items[] with kind/url) and `assetIds: string[]`. Server rewrites upload items' `url` to `${APP_ORIGIN}/api/inkling/assets/<id>` and fills `moodboard[]` from `items[].url`. |

### Admin (`apps/admin`)

- `enquiries/page.tsx` — artist scope becomes
  `{ OR: [{ preferredArtistId }, { source: "inkling", preferredArtistId: null }] }`
  via a pure `artistInboxWhere(artistId)` helper in `enquiry-helpers.ts`.
  `EnquiryItem` gains `moodboardData` (parsed via a pure `parseMoodboardData`
  that tolerates null / old rows).
- `actions.ts` — `loadEnquiryScoped` allows unassigned Inkling boards for
  artists; `replyToEnquiry` claims an unassigned board for a replying artist;
  new `claimEnquiry(enquiryId)` action.
- `EnquiryDetailSections.tsx` — new `MoodBoardBriefSection` (styles, colour,
  description, query, notes) and an upgraded `MoodboardSection` that, when
  `moodboardData` is present, renders each item with a kind badge, opens the
  full image, and links to the source page; falls back to the current URL
  thumbnails otherwise.
- `EnquiryInbox.tsx` — a "Source" filter (All / Mood boards / Web / Flash),
  an "Open board" badge on unassigned Inkling rows, and for artists a
  "Take this board" button.
- `api/uploads/route.ts` — imports `sniffImageMime` from `@bnb/core/uploads`
  (behaviour unchanged).

### Cron

`runAllCron` adds `runMoodboardAssetPurge()` — deletes `MoodboardAsset` rows
with `enquiryId = null` older than 24 h. Reported like the other jobs.

### Config / deploy

- `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` documented in root `.env.example`,
  `apps/web/.env.example`, `.env.production.example`; passed to the `web`
  service in `docker-compose.prod.yml` (optional, empty default); one line in
  `docs/DEPLOY.md` and `docs/PROJECT-BRIEF.md` build log.
- Home page teaser copy for the Mood Board row updated to describe the
  builder. Nav / sitemap unchanged (`/inkling`).

## Data flow

1. Visitor fills the Brief, presses **Find inspiration** → client POSTs
   `/api/inkling/search` → core builds the query, runs the studio gallery
   query and (if configured) the Google CSE call in parallel → response
   rendered as two groups ("From our studio", "From the web"), each tile a
   toggle button; **Load more** requests `start = nextStart`.
2. Tapping a tile adds/removes a `BoardItem`; uploads/pastes POST bytes,
   receive `{assetId, url}` and become `upload` items. The board tray shows
   selected tiles with remove buttons and a count of 12.
3. Details + Send steps collect the rest; **Send board** POSTs
   `/api/enquiries` with `source: "inkling"`, `moodboard`, `moodboardData`,
   `assetIds`, `placement`, `size`, `budgetPence`, `style` (styles joined),
   `description` (description + notes), `preferredArtistId`.
4. `createEnquiry` stores the row, attaches assets (`enquiryId`), sends the
   `enquiry_ack` email (subjectIdea = description).
5. Admin inbox shows the board to the owner and (if unassigned) all artists;
   an artist replies → claim + `replied`, or owner assigns as before.

## Error handling

- Search provider missing/failing → `web: []` with `providerConfigured:false`
  or a 502 "Web search is unavailable right now — you can still upload or
  paste images"; studio results still return. Errors are logged server-side
  without the key.
- Upload rejects: empty, >5 MB, unsupported / mismatched bytes → 400/413/415
  with the same messages the admin route uses; UI shows them inline and keeps
  the board intact.
- Enquiries closed (`enquiriesOpen=false`) → existing 403 message surfaced on
  the Send step.
- Rate limits → existing 429 messages.
- `moodboardData` parse failures in admin → treated as absent (fallback to
  URL thumbnails), never a crash.

## Testing

- **Core:** `buildInspirationQuery` (ordering, dedupe, "tattoo" suffix, cap),
  `googleCseProvider` with a mocked `fetch` (maps items, handles non-200,
  never throws raw), `searchInspiration` cache hit/miss, studio matching;
  `moodboard-assets` create/get/attach/purge via the testdb harness;
  `sniffImageMime` table test.
- **Web:** `moodboard/logic.test.ts` (toggle/cap/dedupe, canAdvance per step,
  payload builder incl. asset URL passthrough); route tests for search (fetch
  mocked, env set/unset, rate limit), uploads (sniff, size, mime), assets
  (200 with headers, 404); enquiries route accepts `moodboardData` +
  `assetIds` and rewrites URLs; `renderToStaticMarkup` tests for each step
  and the builder shell (like `MoodBoard.test.tsx` did).
- **Admin:** `artistInboxWhere`, `parseMoodboardData`, source filter helper;
  detail sections render badges/links; actions tests for claim + reply-claim
  scoping (existing `actions.test.ts` conventions).
- **Manual:** run web + admin, build a board with search + upload + paste,
  send, confirm it appears for owner and for an artist, claim and reply.

## Out of scope

- Replacing the Enquire wizard's paste-URL step with the new picker.
- AI generation, reverse image search, Pinterest/Instagram integrations.
- A dedicated "boards" screen in admin (the inbox filter covers it).
- Customer-side history of sent boards.
