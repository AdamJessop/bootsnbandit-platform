# Artist Showcase Screen Implementation Plan

Created: 2026-07-29
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: Yes
Type: Feature

## Summary

**Goal:** Tapping an artist on the reception kiosk home board (checked in or not) opens a presentable full-screen showcase of that artist — bio, style tags, specialisms, Instagram handle, and a tap-to-enlarge gallery of their work — so front-desk staff can show walk-ins the artist's styles.

**Architecture:** A new `loadArtistShowcase(artistId)` service in `@bnb/core` (fetched on demand via a new kiosk server action) feeds a new `ArtistShowcaseScreen` overlay inside the existing `KioskApp` client shell, following the established overlay-screen pattern (`StaffScreen`, `DayListScreen`, …). Board cards and "Not in" chips become tappable entry points.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, Prisma (via `@bnb/core`), plain CSS (`rk-*` classes in `globals.css`), vitest + `renderToStaticMarkup` tests.

## Scope

### In Scope

- Core service `loadArtistShowcase(artistId)`: artist profile fields + gallery items that have an uploaded image.
- Kiosk server action `artistShowcaseAction(artistId)` with the standard signed-in guard and friendly errors.
- `ArtistShowcaseScreen` overlay: hero (avatar/headshot, name, status, tag, bio), style + specialism tags, Instagram handle, experience/rating/pieces meta, gallery grid, tap-to-enlarge lightbox.
- Entry points: tap a `BoardCard` (checked-in artists) or a "Not in" chip; manual Back button only (no inactivity auto-return).
- Loading state while the showcase data fetches; toast + return home on error.

### Out of Scope

- Clock in/out changes — clocking already lives on the separate `StaffScreen`; the home board tap has no existing action to preserve.
- Gallery items without an uploaded image (hidden per user decision).
- Flash designs, reviews, booking/enquiry CTAs (kiosk is staff-facing, not self-serve marketing).
- Auto-return/inactivity timeout (user chose manual back only).
- Changes to the public web site or admin app.

## Context for Implementer

> The reception app is a front-desk kiosk (tablet) at a tattoo studio. Staff use it to check artists in/out, check customers in, book walk-ins, and check sessions out. The home screen shows a live board of artists.

- **Patterns to follow:**
  - Overlay screens: `apps/reception/src/components/kiosk/KioskApp.tsx:42` — `type Screen = "home" | "staff" | ...`; overlays render conditionally at the bottom of `KioskApp` and receive an `onExit` callback. Follow `StaffScreen.tsx` for the screen-head/back-button markup (`rk-screen`, `rk-screen-head`, `rk-back`, `rk-screen-body`).
  - Server actions: `apps/reception/src/app/actions.ts` — every action checks `kioskSignedIn()`, zod-parses input, returns `ActionResult`, maps known errors via `friendly()`. New action follows this exactly but returns a data payload on success.
  - Action injection: `apps/reception/src/app/page.tsx:22-31` — actions are injected into `KioskApp` via the `KioskActions` interface (`KioskApp.tsx:35-40`) so the shell stays testable with `noop` stubs.
  - Core service: `packages/core/src/services/reception.ts` — client-safe payload types (ISO strings, no Date/Prisma objects) exported as interfaces; `kiosk-logic.ts:1-9` re-exports them type-only so no prisma reaches the browser bundle.
  - Content reference: `apps/web/src/app/artists/[slug]/page.tsx` — the public artist page renders the same fields (kicker: status + experience; name; tag as lead; bio; Specialisms/Styles tag rows; rating stars; pieces count; insta link). Mirror the content, not the markup/CSS.
  - Avatar: `ArtistAvatar.tsx` — headshot or initials on the artist's brand-hue disc; reuse for the showcase hero (large size).
- **Conventions:** plain `<img>` with eslint-disable comment (no `next/image` in this app); lucide-react icons with `className="ic"`; `rk-`-prefixed CSS classes appended to `apps/reception/src/app/globals.css`; tests use vitest + `renderToStaticMarkup` (see `KioskApp.test.tsx`), core DB tests use the shared testdb harness in `reception.test.ts`.
- **Key files:**
  - `packages/core/src/services/reception.ts` — board loader + kiosk services (add showcase loader here).
  - `apps/reception/src/components/kiosk/KioskApp.tsx` — kiosk shell, screen state, toast helper `say()`.
  - `apps/reception/src/components/kiosk/BoardCard.tsx` — on-floor artist card (has an inner "Check out" button — see Gotchas).
  - `apps/reception/src/app/globals.css` — 1500+ lines; `rk-*` kiosk styles start ~line 464. CSS custom props (`--bb-crimson`, `--text-muted`, etc.) defined at top.
- **Gotchas:**
  - `BoardCard` contains an inner "Check out" `<button>`. The card must become tappable **without** nesting buttons (invalid HTML): make the `rk-card` div clickable (`onClick` + `role="button"`) and `e.stopPropagation()` in the checkout button's handler.
  - "Not in" artists render as `<span className="rk-off-chip">` (`KioskApp.tsx:221-229`) — convert to `<button>` for tappability.
  - `Artist.styles` is a relation to `TattooStyle` (`schema.prisma:191`) — select `{ name: true }` and map to `string[]`, as `apps/web/src/app/_data.ts:75,117` does.
  - `Artist.headshot` and `GalleryItem.image` are both nullable admin-uploaded URLs. Hide gallery rows with `image: null` **in the core query** (`image: { not: null }`) so the payload stays lean.
  - The board refreshes via `router.refresh()` every 30s — this re-renders server props but does NOT reset client state, so an open showcase stays open. Showcase data is a one-shot fetch (fine — profile/gallery content is not live data).
  - `insta` may or may not include a leading `@` — strip for the link, display as stored (see `apps/web/.../[slug]/page.tsx:162`).
- **Domain context:** "Checked in" = artist tapped in on the kiosk today (StaffCheckin row). Showcase must work for ALL active artists regardless of check-in state. `status` is CO_OWNER/RESIDENT/APPRENTICE — humanise via `artistStatusLabel` from `@bnb/core/artist-status` (already used in `StaffScreen.tsx:44`).

## Runtime Environment

- **Start command:** `npm run dev -w @bnb/reception` (port 3002); requires Postgres per root `docker-compose.yml` and a signed-in staff passkey session to view `/`.
- **Tests:** `npm test -w @bnb/reception`, `npm test -w @bnb/core` (core service tests use the testdb harness — see `packages/core/src/services/testdb.ts`).

## Assumptions

- Gallery volume per artist is modest (tens, not thousands) so a single unpaginated fetch is fine — supported by seeded studio data and `getArtistGallery` doing the same (`_data.ts:181-190`) — Tasks 1, 3 depend on this.
- `renderToStaticMarkup` testing (no user-event simulation) is acceptable for the new screen, matching every existing kiosk test — Tasks 3, 4 depend on this.
- Appending ~120 lines of CSS to the already-large `globals.css` follows existing convention (all kiosk styles live there) — Task 3 depends on this.
- An artist tapped on the board always exists in the DB (board data comes from the same DB moments earlier); deleted/deactivated mid-session is handled by the action's friendly error path — Task 2 depends on this.

## Testing Strategy

- **Unit (core):** `loadArtistShowcase` in `reception.test.ts` — returns profile fields + only imaged gallery items in sortOrder; null for unknown/inactive artist.
- **Unit (reception):** action test (signed-out guard, invalid id, success shape, unknown-artist error) mirroring `actions.test.ts` conventions; `ArtistShowcaseScreen` render test (hero fields, tags, gallery tiles, empty-gallery message, loading state); `KioskApp`/`BoardCard` wiring tests (tap → showcase screen appears; chips are buttons).
- **Manual:** sign in on dev kiosk, tap a checked-in artist's card and a "Not in" chip; verify showcase, lightbox enlarge/dismiss, Back returns home; artist with no imaged gallery shows the fallback message.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Tap-target conflict: checkout button inside newly-clickable card triggers showcase | Medium | Medium | `stopPropagation` in checkout handler + explicit test that both handlers stay independent |
| Gallery image URLs broken/slow on kiosk network | Low | Low | Plain `<img>` with CSS `object-fit` sizing; broken images collapse gracefully within grid tile; no layout dependency on load |
| Showcase payload type drift between core and client | Low | Medium | Type-only re-export through `kiosk-logic.ts` (existing pattern) — single source of truth in core |
| `renderToStaticMarkup` can't exercise lightbox open/close interaction | High | Low | Test lightbox as a pure conditional render (export screen with controllable initial state or test the closed/open markup separately); manual verification covers the tap flow |

## Pre-Mortem

_Assume this plan failed. Most likely internal reasons:_

1. **Nested-interactive markup breaks the board** (Task 4) → Trigger: React hydration warning or eslint jsx-a11y error when `rk-card` gains `onClick` while containing a `<button>` — caught the moment `BoardCard.test.tsx` renders or `npm run lint` runs.
2. **We assumed on-demand fetch needs no cache, but repeated taps feel sluggish on the tablet** (Task 4) → Trigger: manual test shows noticeable delay reopening the same artist; mitigation ready: keep last-fetched showcase in `KioskApp` state keyed by artist id (one-line memo), without changing the action contract.
3. **Styles relation select shape mismatches Prisma types after `styles: true` shortcut** (Task 1) → Trigger: `tsc` error or empty `styles` array in the new core test — fix by selecting `styles: { select: { name: true } }` exactly as `_data.ts:75`.

## Execution Waves

**Wave 1** — Core service (solo): Task 1 has no dependencies; everything else consumes its exported types.
**Wave 2** — Action + Screen (parallel): Task 2 (action plumbing: `actions.ts`, `page.tsx`) and Task 3 (component + CSS: new files, `globals.css`) both depend only on Task 1 and touch disjoint files.
**Wave 3** — Wiring (solo): Task 4 modifies `KioskApp.tsx`/`BoardCard.tsx` and needs both the action (Task 2) and the screen (Task 3).

## Goal Verification

### Truths

1. `packages/core/src/services/artist-showcase.ts` contains `export async function loadArtistShowcase` and a `ShowcaseArtist` interface (grep).
2. The core showcase query filters imageless items: `artist-showcase.ts` contains `image: { not: null }` (grep).
3. `apps/reception/src/app/actions.ts` contains `export async function artistShowcaseAction` guarded by `kioskSignedIn` (grep).
4. `apps/reception/src/components/kiosk/KioskApp.tsx` includes `"artist"` in the `Screen` union and renders `ArtistShowcaseScreen` (grep `screen === "artist"`).
5. `BoardCard.tsx` exposes an open handler (grep `onOpen`) and `KioskApp.tsx` "Not in" chips are `<button` elements (grep `rk-off-chip`).
6. `npm test -w @bnb/core` and `npm test -w @bnb/reception` pass (command).
7. `ArtistShowcaseScreen.tsx` renders a lightbox overlay (grep `rk-lightbox`).

### Artifacts

| Artifact | Provides | Exports |
| -------- | -------- | ------- |
| `packages/core/src/services/artist-showcase.ts` | Showcase data loader | `loadArtistShowcase`, `ShowcaseArtist`, `ShowcaseGalleryItem`, `ArtistShowcase` |
| `apps/reception/src/app/actions.ts` | Kiosk server action | `artistShowcaseAction` |
| `apps/reception/src/components/kiosk/ArtistShowcaseScreen.tsx` | Showcase overlay UI | `ArtistShowcaseScreen` |
| `apps/reception/src/components/kiosk/KioskApp.tsx` | Entry points + screen state | `KioskApp` (extended `KioskActions`) |
| `apps/reception/src/app/globals.css` | `rk-showcase-*`, `rk-lightbox` styles | — |

### Key Links

| From | To | Via | Pattern |
| ---- | -- | --- | ------- |
| `apps/reception/src/app/actions.ts` | core service | showcase fetch | `loadArtistShowcase` |
| `apps/reception/src/app/page.tsx` | actions | injection | `artistShowcase: artistShowcaseAction` |
| `apps/reception/src/components/kiosk/KioskApp.tsx` | ArtistShowcaseScreen | overlay render | `ArtistShowcaseScreen` |
| `apps/reception/src/components/kiosk/BoardCard.tsx` | KioskApp | tap entry | `onOpen` |
| `apps/reception/src/components/kiosk/kiosk-logic.ts` | core types | type-only re-export | `ArtistShowcase` |

## Progress Tracking

- [x] Task 1: Core `loadArtistShowcase` service + types (Wave 1)
- [x] Task 2: `artistShowcaseAction` server action + page wiring (Wave 2)
- [x] Task 3: `ArtistShowcaseScreen` component, lightbox + CSS (Wave 2)
- [x] Task 4: KioskApp/BoardCard entry-point wiring (Wave 3)
      **Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Deviations

- **Task 1:** `loadArtistShowcase` + types live in a NEW module `packages/core/src/services/artist-showcase.ts` (with companion `artist-showcase.test.ts`) instead of `reception.ts` — the Sentinal file-checker blocks `reception.ts` at >400 lines. Import path for consumers: `@bnb/core/services/artist-showcase`. Goal-verification truths/artifacts updated accordingly.
- **Task 2:** `friendly()` in `actions.ts` refactored into a `friendlyMessage()` string helper so the read-only showcase action can reuse error mapping without `revalidatePath`. The `artistShowcase` field was added to `KioskActions` (and a stub to `KioskApp.test.tsx`) in this task — tsc's excess-property check made deferring it to Task 4 impossible. Orchestrator added `artistShowcaseAction` to the `./actions` mock in `page.test.tsx` (wave integration).
- **Task 3:** lucide-react v1 has no brand icons — Instagram handle uses `AtSign` instead of an Instagram glyph. `ShowcaseLightbox` exported as a pure subcomponent for markup testing.

## Implementation Tasks

### Task 1: Core `loadArtistShowcase` service + types

**Objective:** Add a client-safe showcase loader to the core reception service: full artist profile + gallery items that have an uploaded image.
**Dependencies:** None
**Wave:** 1

**Files:**

- Modify: `packages/core/src/services/reception.ts`
- Test: `packages/core/src/services/reception.test.ts`

**Key Decisions / Notes:**

- New interfaces (all serialisable — strings/numbers/null only):

  ```ts
  export interface ShowcaseArtist {
    id: string; name: string; status: string; tag: string | null;
    bio: string | null; styles: string[]; specials: string[];
    insta: string | null; experience: string | null;
    rating: number | null; pieces: number | null;
    headshot: string | null; hue: string | null;
  }
  export interface ShowcaseGalleryItem {
    id: string; title: string; style: string | null;
    placement: string | null; image: string; hue: string | null;
    featured: boolean;
  }
  export interface ArtistShowcase { artist: ShowcaseArtist; gallery: ShowcaseGalleryItem[]; }
  ```

- `loadArtistShowcase(artistId: string): Promise<ArtistShowcase | null>` — `prisma.artist.findFirst({ where: { id: artistId, active: true }, select: { ..., styles: { select: { name: true } } } })`; return `null` when not found. Gallery: `prisma.galleryItem.findMany({ where: { artistId, image: { not: null } }, orderBy: { sortOrder: "asc" } })`; map `image` as non-null string. Map `styles` to `string[]` (pattern: `apps/web/src/app/_data.ts:106-127`).
- Do both queries in a `Promise.all` after confirming artist exists, or sequentially — either fine; match file's existing `Promise.all` style (`reception.ts:105`).

**Definition of Done:**

- [ ] All tests pass (`npm test -w @bnb/core`)
- [ ] No diagnostics errors
- [ ] New test: seeded artist returns profile fields + only its imaged gallery items in sortOrder; items with `image: null` excluded; unknown id and inactive artist return `null`

**Verify:**

- `npm test -w @bnb/core -- reception`

### Task 2: `artistShowcaseAction` server action + page wiring

**Objective:** Expose the showcase loader to the kiosk client via a guarded server action, injected through `KioskActions`.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Modify: `apps/reception/src/app/actions.ts`
- Modify: `apps/reception/src/app/page.tsx`
- Test: `apps/reception/src/app/actions.test.ts`

**Key Decisions / Notes:**

- Follow the exact structure of existing actions (`actions.ts:57-70`): `kioskSignedIn()` guard → zod validation (`z.string().min(1)`) → try/catch with `friendly()`. Success returns data: `type ShowcaseResult = { ok: true; data: ArtistShowcase } | { ok: false; error: string }` — a `null` loader result becomes `{ ok: false, error: "Artist not found — refresh the board" }`.
- No `revalidatePath` — this is a read, not a mutation.
- `page.tsx`: add `artistShowcase: artistShowcaseAction` to the injected actions object.

**Definition of Done:**

- [ ] All tests pass (`npm test -w @bnb/reception`)
- [ ] No diagnostics errors
- [ ] Action test covers: signed-out → SIGNED_OUT error; empty id → generic error; found artist → `{ ok: true, data }` with gallery; missing artist → friendly not-found error

**Verify:**

- `npm test -w @bnb/reception -- actions`

### Task 3: `ArtistShowcaseScreen` component, lightbox + CSS

**Objective:** Build the presentable full-screen showcase overlay: hero, tags/meta, gallery grid, tap-to-enlarge lightbox, loading and empty states.
**Dependencies:** Task 1 (types only)
**Wave:** 2

**Files:**

- Create: `apps/reception/src/components/kiosk/ArtistShowcaseScreen.tsx`
- Modify: `apps/reception/src/components/kiosk/kiosk-logic.ts` (type-only re-export of `ArtistShowcase` types)
- Modify: `apps/reception/src/app/globals.css`
- Test: `apps/reception/src/components/kiosk/ArtistShowcaseScreen.test.tsx`

**Key Decisions / Notes:**

- Props: `{ artist: BoardArtist; showcase: ArtistShowcase | null; onExit: () => void }` — `artist` (board data) renders the header instantly while `showcase === null` shows a loading hint in the body; when data arrives the full content renders. No internal fetching.
- Screen chrome copies `StaffScreen.tsx:18-31` (`rk-screen` overlay, `rk-back` button, title/sub). Title: artist name; sub: `artistStatusLabel(status)` + tag.
- Hero: `ArtistAvatar` at large size (or headshot panel), name, status label + experience kicker, tag as lead line, bio paragraph. Meta row: rating (star icon + value), pieces count, insta handle (display only — kiosk shouldn't open external links; render as text with an Instagram icon).
- Tags: two `rk-` tag rows — Styles (from `showcase.artist.styles`) and Specialisms (`specials`), mirroring content of `apps/web/src/app/artists/[slug]/page.tsx:114-138`.
- Gallery: CSS grid of `<img>` tiles (`object-fit: cover`), `featured` items span 2 columns (`grid-column: span 2`). Caption strip: title · style · placement. Empty gallery → "Portfolio photos coming soon." muted line.
- Lightbox: `useState<ShowcaseGalleryItem | null>`; tapping a tile sets it; full-screen `rk-lightbox` overlay (image + caption), tap anywhere closes. Pure conditional render — testable via markup with/without state by extracting a `Lightbox` subcomponent rendered from props if needed.
- CSS: append a clearly-commented `/* Artist showcase */` block (~120 lines) of `rk-showcase-*` + `rk-lightbox` styles to `globals.css`, reusing existing custom props and the kiosk's touch-first sizing.

**Definition of Done:**

- [ ] All tests pass (`npm test -w @bnb/reception`)
- [ ] No diagnostics errors
- [ ] Test renders: hero fields (name, status label, bio, tag), style + specialism tags, insta handle, gallery tiles with captions, featured spanning class, empty-gallery message, loading state when `showcase` is null

**Verify:**

- `npm test -w @bnb/reception -- ArtistShowcaseScreen`

### Task 4: KioskApp/BoardCard entry-point wiring

**Objective:** Make every artist on the home board tappable and wire the showcase screen into the kiosk shell with loading/error handling.
**Dependencies:** Task 2, Task 3
**Wave:** 3

**Files:**

- Modify: `apps/reception/src/components/kiosk/KioskApp.tsx`
- Modify: `apps/reception/src/components/kiosk/BoardCard.tsx`
- Test: `apps/reception/src/components/kiosk/KioskApp.test.tsx`
- Test: `apps/reception/src/components/kiosk/BoardCard.test.tsx`

**Key Decisions / Notes:**

- `KioskActions` gains `artistShowcase: (artistId: string) => Promise<{ ok: true; data: ArtistShowcase } | { ok: false; error: string }>`.
- `Screen` union gains `"artist"`. New state: `showcaseArtistId: string | null`, `showcase: ArtistShowcase | null`.
- `openShowcase(artistId)`: set id, clear old data, `setScreen("artist")` immediately (header renders from board data), then await action; on `ok` set data, on error `say(error, "error")` + `setScreen("home")`.
- `BoardCard` gains `onOpen: (artistId: string) => void`; the `rk-card` div gets `onClick={() => onOpen(artist.id)}` + `role="button"` + `tabIndex={0}`; the existing checkout button handler adds `e.stopPropagation()`. Do NOT wrap the card in a `<button>` (nested-button HTML violation — see Gotchas).
- "Not in" chips (`KioskApp.tsx:221-229`): `<span>` → `<button className="rk-off-chip" onClick={() => openShowcase(a.id)}>` (add minimal button-reset CSS if chip styling shifts).
- Render branch: `{screen === "artist" && showcaseBoardArtist && <ArtistShowcaseScreen artist={showcaseBoardArtist} showcase={showcase} onExit={...} />}` where `showcaseBoardArtist = board.artists.find((a) => a.id === showcaseArtistId)`. `onExit` resets screen to `"home"` and clears showcase state.
- Update `KioskApp.test.tsx` action stubs with an `artistShowcase` noop; add wiring assertions (chips render as buttons; BoardCard test asserts `onOpen` presence via role attr).

**Definition of Done:**

- [ ] All tests pass (`npm test -w @bnb/reception`)
- [ ] No diagnostics errors
- [ ] Lint passes (`npm run lint -w @bnb/reception`) — no jsx-a11y/nested-interactive violations
- [ ] Tapping a card or chip in the rendered markup wires to the showcase (asserted via role="button"/`<button` markup + screen branch test)

**Verify:**

- `npm test -w @bnb/reception && npm run lint -w @bnb/reception`
