# Tattoo Styles Management & Home Page Showcase Implementation Plan

Created: 2026-07-07
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Add an example image to each tattoo style (managed via the existing admin styles CMS) and replace the abstract art plate in the home page's Inkling teaser with a tile grid showcasing styles and their sample images, linking to the Style Matcher.

**Architecture:** Extend the existing `TattooStyle` Prisma model with a nullable `image` column (same convention as `GalleryItem.image` / `Flash.image` — a `/uploads/...` path string). The admin styles CMS page (`apps/admin/.../content/styles/page.tsx`) already uses the generic `CrudSection`, which has built-in `image` field support via the shared `ImageUploader` (POST `/api/uploads`) — adding the field is declarative. On the web side, a new `getStyleShowcase()` data function returns only styles that have an image; the home page server component renders them as a linked tile grid in the `ai-teaser-art` column, falling back to the current abstract plate when no styles have images.

**Tech Stack:** Next.js (App Router, server components), Prisma/PostgreSQL, Vitest + `renderToStaticMarkup`, plain CSS in `site.css`.

## Scope

### In Scope

- `image String?` column on `TattooStyle` + migration.
- Admin styles CMS: upload/change/remove an example image per style (owner-only, existing page).
- New `getStyleShowcase()` web data function (name + image, ordered, image-only rows).
- Home page Inkling teaser: style tile grid replacing the abstract plate art, whole grid links to `/inkling?tab=match`, crimson Sparkles core badge kept overlaid.
- Empty state: keep the current abstract gradient plate when zero styles have images.
- Unit tests for all of the above, following existing patterns.

### Out of Scope

- Seeding example images (seed styles stay imageless; showcase appears as images are uploaded).
- Changing `getStyles()` or any existing consumer (gallery filters, artist form checkboxes, matcher).
- Per-style detail pages or gallery deep-links (user chose: all tiles → Style Matcher).
- Upload storage changes (stays `public/uploads/` dev sink).
- Image display elsewhere (artist pages, gallery) — unchanged.

## Context for Implementer

> Written for an implementer who has never seen this codebase.

- **Monorepo:** npm workspaces — `apps/web` (public site, port 3000), `apps/admin` (staff CMS, port 3001), `packages/core` (`@bnb/core`: Prisma schema/client, services, auth).
- **Patterns to follow:**
  - Image field on a CMS model: `apps/admin/src/app/(staff)/content/gallery/page.tsx:15,30` — `{ name: "image", kind: "string", nullable: true }` in `SPEC` and `{ name: "image", label: "Image", type: "image", hideInTable: true }` in `FIELDS`. `CrudSection` renders the shared `ImageUploader` for `type: "image"` (`apps/admin/src/app/(staff)/content/_components/CrudSection.tsx:269`).
  - Web data functions: `apps/web/src/app/_data.ts` — small async functions over `prisma`, e.g. `getStyles()` at line 249. Tests in `_data.test.ts` mock `@bnb/core/db`.
  - Home page tests: `apps/web/src/app/page.test.tsx` mocks `./_data` wholesale with `vi.mock` — **any new export used by `page.tsx` must be added to that mock or all three tests crash**.
  - CSS: component classes live in `apps/web/src/app/site.css` (plain CSS, CSS custom properties like `var(--radius)`, `var(--border-default)`). The Inkling teaser styles are at lines 1311–1406 (`.ai-teaser`, `.ai-teaser-art`, `.ai-core`).
- **Key files:**
  - `packages/core/prisma/schema.prisma:429` — `TattooStyle` model (id, name unique, sortOrder).
  - `apps/admin/src/app/(staff)/content/styles/page.tsx` — existing styles CRUD (owner-only), declarative SPEC/FIELDS.
  - `apps/web/src/app/page.tsx:167-226` — Inkling teaser section; the art column is lines 206–224 (`ai-teaser-art` → `plate` → gradient `plate-art` + `ai-core` Sparkles badge).
- **Gotchas:**
  - Uploads are stored under the **admin** app's `public/uploads/` and saved as root-relative `/uploads/<name>` strings. The web app renders these same paths for gallery/flash images already (see `page.test.tsx:37,75`) — follow the convention, do not try to "fix" cross-app serving in this feature.
  - After editing `schema.prisma`, run `npm run db:migrate` (root script → `prisma migrate dev`) which also regenerates the client. Without regeneration, TypeScript won't know `tattooStyle.image`.
  - `packages/core/src/db/seed-counts.test.ts:21` expects `TattooStyle: 9` rows — adding a column does not affect it; do not touch the seed.
  - `/inkling?tab=match` is a valid deep link — `InklingTabs.tsx` reads `initialTab` and `"match"` is the default tab.
- **Domain context:** "Inkling" is the site's AI-flavoured discovery brand (Style Matcher quiz + Mood Board). Styles are tattoo genres ("Blackwork", "Fine-line", …) stored in the `TattooStyle` table; artists link to them via an implicit M:N join. The home page teaser sells the matcher — the style grid gives visitors a visual taste of what styles exist before they click through.

## Runtime Environment

- **Start:** `npm run dev` (web :3000 + admin :3001) or `npm run dev:web` / `npm run dev:admin`.
- **DB:** PostgreSQL via docker-compose; Prisma schema at `packages/core/prisma/schema.prisma`.
- **Tests:** `npm test` (all workspaces) or `npx vitest run <file>` inside `apps/web` / `apps/admin`.

## Assumptions

- Uploaded `/uploads/...` paths are renderable by the web app in production (same convention as gallery/flash images) — supported by `apps/web/src/app/page.test.tsx:75` asserting such a src renders — Tasks 3, 4 depend on this.
- `CrudSection`'s `image` field type works for any model without model-specific code — supported by `CrudSection.tsx:16,269-270` (generic ImageUploader wiring) — Task 2 depends on this.
- Plain `<img>` (not `next/image`) is the site convention — supported by `GalleryBrowser.tsx:145` and existing test assertions on `src="..."` — Task 4 depends on this.
- Nine seeded styles is the realistic upper count; a 2- or 3-column tile grid fits the `0.9fr` teaser art column — supported by `seed-counts.test.ts:21` — Task 4 depends on this.

## Testing Strategy

- **Unit (vitest):** admin styles page test (image field present in form), web `_data.test.ts` (`getStyleShowcase` filters imageless styles, ordered), web `page.test.tsx` (grid renders names + img srcs; abstract fallback when empty; link to `/inkling?tab=match`).
- **Manual:** upload an image to a style in admin `/content/styles`, confirm it appears on the web home page teaser and the grid links to the matcher.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Stale Prisma client after schema change breaks typecheck/tests | Medium | Low | Task 1 DoD includes `db:generate` (migrate dev runs it); verify with tsc |
| Web app can't serve `/uploads/...` in some environments | Low | Medium | Pre-existing platform concern shared with gallery/flash images; out of scope, noted for deploy |
| Grid layout breaks teaser proportions on mobile | Low | Low | Reuse existing responsive breakpoint at `site.css:1606` where `.ai-teaser` stacks |

## Pre-Mortem

_Assume this plan failed. Most likely internal reasons:_

1. **`page.test.tsx` mock missing the new export** (Task 4) → Trigger: all three home page tests fail with "getStyleShowcase is not a function" immediately on first run. Fix by adding it to the `vi.mock("./_data")` factory.
2. **Migration drift on the dev DB** (Task 1) → Trigger: `prisma migrate dev` reports drift or pending migrations from the staff-scheduling work and wants to reset. Stop and surface to user rather than resetting data.
3. **ImageUploader renders nothing in `renderToStaticMarkup`** (Task 2) → Trigger: admin styles page test can't assert on the upload widget because it's a client component with effects. Assert on stable markup (label text "Example image") instead of widget internals.

## Execution Waves

**Wave 1** — Schema (sequential): Task 1 alone — every other task needs the `image` column and regenerated client.
**Wave 2** — Admin CMS + web data (parallel): Tasks 2 and 3 touch disjoint files (`apps/admin/...styles/page.tsx` vs `apps/web/.../_data.ts`) and both depend only on Task 1.
**Wave 3** — Home page UI (sequential): Task 4 consumes `getStyleShowcase` from Task 3.

## Goal Verification

### Truths

1. `packages/core/prisma/schema.prisma` — the `TattooStyle` model block contains `image` (grep: `image\s+String\?` between `model TattooStyle` and the next `model`).
2. A migration exists: `ls packages/core/prisma/migrations | grep -i tattoo_style_image` returns a directory.
3. `apps/admin/src/app/(staff)/content/styles/page.tsx` contains `type: "image"` (grep-verifiable).
4. `apps/web/src/app/_data.ts` exports `getStyleShowcase` and it filters on image presence (grep: `export async function getStyleShowcase`).
5. `apps/web/src/app/page.tsx` contains `href="/inkling?tab=match"` on the showcase grid and calls `getStyleShowcase` (grep-verifiable).
6. `npm test` passes in `apps/web`, `apps/admin`, and `packages/core`.

### Artifacts

| Artifact | Provides | Exports |
| -------- | -------- | ------- |
| `packages/core/prisma/schema.prisma` | `image String?` on TattooStyle | Prisma client type `TattooStyle.image` |
| `packages/core/prisma/migrations/*_add_tattoo_style_image/` | DB column | — |
| `apps/admin/src/app/(staff)/content/styles/page.tsx` | Image upload in styles CMS | default page (modified) |
| `apps/web/src/app/_data.ts` | Showcase data | `getStyleShowcase(): Promise<{name, image}[]>` |
| `apps/web/src/app/page.tsx` | Style tile grid in Inkling teaser | default page (modified) |
| `apps/web/src/app/site.css` | `.style-showcase` grid styles | CSS classes |

### Key Links

| From | To | Via | Pattern |
| ---- | -- | --- | ------- |
| `apps/web/src/app/page.tsx` | `apps/web/src/app/_data.ts` | import + call | `getStyleShowcase` |
| `apps/web/src/app/_data.ts` | `prisma.tattooStyle` | showcase query | `tattooStyle\.findMany` |
| `apps/admin/.../content/styles/page.tsx` | ImageUploader | CrudSection field type | `type: "image"` |
| `apps/web/src/app/page.tsx` | `/inkling?tab=match` | showcase link | `inkling\?tab=match` |

## Progress Tracking

- [x] Task 1: Add `image` column to TattooStyle + migration (Wave 1)
- [x] Task 2: Admin styles CMS — example image upload field (Wave 2)
- [x] Task 3: Web data — `getStyleShowcase()` (Wave 2)
- [x] Task 4: Home page Inkling teaser style tile grid (Wave 3)

**Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Implementation Notes (deviations)

- Wave 2 agents ran in the shared checkout instead of isolated worktrees: fresh worktrees lack `node_modules`/generated Prisma client so tests couldn't run there; the two tasks touch disjoint apps so no conflict was possible. Pre-parallel checkpoint commit skipped for the same reason (it only serves worktree forks).
- Task 2 test asserts the exported `FIELDS` config contains the image field instead of rendered form markup — CrudSection's form only mounts on click and the admin test env is node/renderToStaticMarkup (consistent with `CrudSection.test.tsx`'s own approach).
- Task 4: showcase extracted into `apps/web/src/components/site/StyleShowcase.tsx` (+ colocated test, exported via site index) rather than inlined in `page.tsx` — the Sentinal file-size hook flagged `page.tsx` at 415 lines (soft limit 400); extraction brings it to 383 and matches the site-component composition pattern.
- Both dev servers were restarted after the migration: the long-running processes held the pre-migration Prisma client in memory, 500ing any page touching the new column. Fresh-process query + live curl verified both showcase and fallback render paths against the real DB.

## Verification Fixes

- **Build break (must_fix, found in Phase B build):** Task 2 exported `FIELDS` from `page.tsx` for testing, but Next.js App Router pages only permit route-level exports — `next build` failed its page type check (unit tests/tsc could not catch this). Fixed by moving `SPEC`/`FIELDS` to a sibling `fields.ts` (+ `fields.test.ts`); page imports them. Admin build now compiles.
- **Click interception (must_fix, found in E2E):** the absolutely-centred `.ai-core` Sparkles badge swallowed clicks on the middle of the showcase grid (Playwright click timed out with "subtree intercepts pointer events"). Fixed with `pointer-events: none` on `.ai-core` — decorative in both teaser states. Click-through to `/inkling?tab=match` verified in a real browser after the fix.
- ESLint `@next/next/no-img-element` warning on the showcase `<img>` suppressed with the same disable comment `Plate.tsx:67` uses (site convention).
- E2E: seeded 5 styles with images → 3-column grid rendered with name overlays and alt text, whole grid navigated to the Style Matcher on click; reverted to 0 images → abstract plate fallback confirmed live. Screenshot captured.
- Reviewer suggestions applied: admin intro copy reworded; per-task DoD checkboxes ticked.

## Implementation Tasks

### Task 1: Add `image` column to TattooStyle + migration

**Objective:** Extend the `TattooStyle` Prisma model with a nullable `image` string and create the migration so the column exists and the generated client knows it.
**Dependencies:** None
**Wave:** 1

**Files:**

- Modify: `packages/core/prisma/schema.prisma` (TattooStyle model, line ~429)
- Create: `packages/core/prisma/migrations/<timestamp>_add_tattoo_style_image/migration.sql` (generated)

**Key Decisions / Notes:**

- Field: `image String?` placed after `name`, matching `GalleryItem.image` (`schema.prisma:393`) and `Flash.image` (`schema.prisma:411`). No index needed.
- Run `npm run db:migrate` from repo root with name `add_tattoo_style_image`. `prisma migrate dev` regenerates the client automatically.
- If Prisma reports schema drift and proposes a reset, STOP and surface to the user — do not reset the dev database.
- No seed changes: seeded styles intentionally have `image = NULL` (hide-until-uploaded behaviour).

**Definition of Done:**

- [x] `TattooStyle` model contains `image String?`
- [x] Migration directory exists and applied cleanly (no drift/reset)
- [x] `npx tsc --noEmit` inside `packages/core` passes (client regenerated)
- [x] `packages/core` tests still pass (`npm -w @bnb/core test`)

**Verify:**

- `grep -A5 "model TattooStyle" packages/core/prisma/schema.prisma | grep "image"`
- `ls packages/core/prisma/migrations | grep tattoo_style_image`
- `npm -w @bnb/core test`

### Task 2: Admin styles CMS — example image upload field

**Objective:** Let the owner upload/replace/remove an example image per style from the existing `/content/styles` CMS page.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Modify: `apps/admin/src/app/(staff)/content/styles/page.tsx`
- Test: `apps/admin/src/app/(staff)/content/styles/page.test.tsx`

**Key Decisions / Notes:**

- Copy the gallery pattern exactly (`apps/admin/src/app/(staff)/content/gallery/page.tsx:15,30`):
  - `SPEC` += `{ name: "image", kind: "string", nullable: true }`
  - `FIELDS` += `{ name: "image", label: "Example image", type: "image", hideInTable: true }`
- `prisma.tattooStyle.findMany` in the page has no `select`, so the new column flows through automatically.
- Update the page intro copy (`<p className="mt-2 mb-6 text-text-muted">`) to note that "Order" also controls the home page showcase tile order, so the owner understands how to curate the grid (reviewer suggestion).
- Test: extend the mocked row with `image: "/uploads/styles/example.jpg"` and assert the form renders the "Example image" label (per Pre-Mortem #3, assert label text, not ImageUploader internals).

**Definition of Done:**

- [x] `/content/styles` form shows an image uploader per style (create + edit)
- [x] Saving persists the `/uploads/...` path to `TattooStyle.image`; clearing sets NULL (via `nullable: true` coercion, `coerce.ts:28`)
- [x] Admin tests pass

**Verify:**

- `grep 'type: "image"' "apps/admin/src/app/(staff)/content/styles/page.tsx"`
- `cd apps/admin && npx vitest run "src/app/(staff)/content/styles/page.test.tsx"`

### Task 3: Web data — `getStyleShowcase()`

**Objective:** Provide the home page with ordered `{ name, image }` pairs for styles that have an example image.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Modify: `apps/web/src/app/_data.ts` (add function near `getStyles`, line ~249)
- Test: `apps/web/src/app/_data.test.ts`

**Key Decisions / Notes:**

- New function (do NOT change `getStyles()` — the gallery page consumes its `string[]` shape):

  ```
  /** Styles that have an example image, for the home page showcase. */
  export async function getStyleShowcase(): Promise<{ name: string; image: string }[]>
  ```

- Query: `prisma.tattooStyle.findMany({ where: { image: { not: null } }, orderBy: { sortOrder: "asc" }, select: { name: true, image: true } })`, then filter/map so `image` is a non-empty string (guards `""` rows and narrows the type from `string | null`).
- Test in `_data.test.ts` following its existing mock style: rows with and without images → only imaged rows returned, in sortOrder, typed image string.

**Definition of Done:**

- [x] `getStyleShowcase` exported; excludes NULL and empty-string images; ordered by `sortOrder`
- [x] Web `_data` tests pass

**Verify:**

- `grep -n "getStyleShowcase" apps/web/src/app/_data.ts`
- `cd apps/web && npx vitest run src/app/_data.test.ts`

### Task 4: Home page Inkling teaser style tile grid

**Objective:** Replace the abstract gradient plate in the Inkling teaser's art column with a style tile grid (image + name overlay), whole grid linking to `/inkling?tab=match`, keeping the crimson Sparkles core badge; fall back to the current abstract plate when no styles have images.
**Dependencies:** Task 3
**Wave:** 3

**Files:**

- Modify: `apps/web/src/app/page.tsx` (teaser art column, lines 206–224; data fetch at top)
- Modify: `apps/web/src/app/site.css` (new `.style-showcase*` classes near `.ai-teaser-art`, line ~1386)
- Test: `apps/web/src/app/page.test.tsx`

**Key Decisions / Notes:**

- Fetch `getStyleShowcase()` alongside the existing parallel data calls in the page component.
- Render (server component, no client JS needed):
  - `styles.length > 0`: a `<Link href="/inkling?tab=match" className="style-showcase">` wrapping tiles — each tile a plain `<img src={s.image} alt={`${s.name} tattoo example`} loading="lazy" />` with a `<span>` name overlay. Keep `<div className="ai-core"><Sparkles /></div>` absolutely centred over the grid (class already positions it).
  - `styles.length === 0`: keep the existing plate markup verbatim (abstract gradient + ai-core).
- Show at most 9 tiles; grid columns: 2 when ≤4 styles, else 3 — render a `data-cols="2"|"3"` attribute on the grid element so the rule is deterministic and testable. Tiles use `aspect-ratio: 1/1`, `object-fit: cover`, `border-radius` from `var(--radius)`, name overlay with a bottom gradient scrim for legibility.
- Mobile: `.ai-teaser` already stacks at the `site.css:1606` breakpoint; the grid needs no extra breakpoint beyond behaving as a normal block.
- Tests (`page.test.tsx`):
  - Add `getStyleShowcase: vi.fn(async () => [])` to the `vi.mock("./_data")` factory (Pre-Mortem #1) — default empty keeps existing tests green and covers the fallback (assert the gradient plate/`plate-art` still renders).
  - New test: `mockResolvedValueOnce` with e.g. `[{ name: "Blackwork", image: "/uploads/styles/blackwork.jpg" }, ...]` → assert `src="/uploads/styles/blackwork.jpg"`, the style name, and `href="/inkling?tab=match"` appear.

**Definition of Done:**

- [x] With imaged styles: grid of tiles (image + name) renders in the teaser art column and links to `/inkling?tab=match`
- [x] With zero imaged styles: current abstract plate renders unchanged
- [x] Sparkles `ai-core` badge visible in both states
- [x] All web tests pass

**Verify:**

- `grep -n "getStyleShowcase\|inkling?tab=match" apps/web/src/app/page.tsx`
- `cd apps/web && npx vitest run src/app/page.test.tsx`
- Manual: `npm run dev`, upload an image to a style in admin, reload home page

## Autonomous Decisions

- New `getStyleShowcase()` function instead of widening `getStyles()` — keeps the gallery consumer untouched at the cost of a second small query function.
- Tile cap of 9 / 2-vs-3 column rule — matches the seeded style count and the narrow (0.9fr) art column.
- Plain `<img>` with `loading="lazy"` (site convention; `next/image` is not used anywhere in the web app).
- `alt` text pattern "<Style> tattoo example" for accessibility.
