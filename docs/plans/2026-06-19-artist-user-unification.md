# Artist/User Unification & Profile Refactor Implementation Plan

Created: 2026-06-19
Status: COMPLETE
Approved: Yes
Iterations: 1
Worktree: No
Type: Feature

## Summary

**Goal:** Make every Artist a User (enforced 1:1), separate access (`User.role`) from title (`Artist.status` enum), link artist styles to the `TattooStyle` list, and make rates numeric £ (drop free-text) with a session-price auto-suggest.
**Architecture:** Prisma schema change + dev reseed; data loaders map the new style relation to the existing `string[]` shapes so service/match logic is unchanged; admin Artist + Staff flows converge to create/link both halves; public pages and the booking drawer read the new fields.
**Tech Stack:** Next.js 15, Prisma/Postgres, TypeScript, vitest (unchanged).

## Scope

### In Scope
- `Artist.userId` becomes **required + unique** (1:1). Every Artist has a User; managed as one staff record.
- New `ArtistStatus` enum `CO_OWNER | RESIDENT | APPRENTICE` (display: "Co-owner" / "Resident Artist" / "Apprentice"), replacing free-text `Artist.role`. Access stays on `User.role` (OWNER|ARTIST).
- `Artist.styles` String[] → **implicit m-n relation** to `TattooStyle`.
- Rates: keep numeric `hourlyRatePence` + `dayRatePence` as canonical (rename `hourlyPence`→`hourlyRatePence`); **drop `rateText`**. Booking/session drawer auto-suggests price from rate (editable).
- Update seed (7 artists each get a User; co-owners=OWNER+CO_OWNER, others ARTIST + RESIDENT/APPRENTICE), services/auth/match data-loaders, admin Content→Artists CMS + Studio→Staff, public artist pages + Inkling, and all affected tests.
- Keep whole repo green (tsc/lint/build/440+ tests) and passkey RBAC intact.

### Out of Scope
- Production data backfill migration (no prod DB yet — dev uses `migrate reset` + reseed; documented).
- Changing booking/session/reporting business logic beyond reading the new fields + the price-suggest helper.
- Full merge into a single table (explicitly rejected in favour of enforced 1:1).

## Context for Implementer
- **Current schema** (`prisma/schema.prisma`): `User`(email, role Role(ARTIST|OWNER), displayName, active, `artist Artist?`) ↔ `Artist`(slug, `userId String? @unique`, name, `role String` free-text, `styles String[]`, `rateText String?`, `hourlyPence Int?`, `dayRatePence Int?`, booksStatus, …). All of Booking/GalleryItem/Flash/Enquiry/AvailabilityRule/Leave/CalendarFeed reference `Artist` by `artistId` — **these FKs do NOT change**.
- **Auth link**: `src/lib/auth/session.ts` + `webauthn.ts` read `user.artist` to resolve `artistId` for `SessionUser`. Enforced 1:1 keeps this working; verify it still returns `artistId`.
- **Match**: `src/lib/services/match.ts` consumes `MatchArtist { styles: string[]; specials: string[]; booksStatus }` — keep this interface; the data loader maps `artist.styles.map(s => s.name)`.
- **Seed** (`prisma/seed.ts`): `ARTISTS` array (lines ~51+) has `role`, `styles: string[]`, `rateText`, `hourlyPence`, `dayRatePence`; lines ~792+ create the 2 demo Users + link. Co-owners: Sarah, Calum. Apprentice: Tom. Emails convention `<first>@bootsnbandit.co.uk` (owner stays adamjjessop@gmail.com linked to Sarah, OR give Sarah her own — see Assumptions).
- **Consumers to update**: public `src/app/(site)/artists/{page,[slug]/page}.tsx` + `_data.ts` (role→status label, styles relation, rates £); `enquire/{page,steps,logic}.tsx` + `inkling` (styles); admin `content/artists/page.tsx`, `profile/_components/ProfileEditor.tsx` + `_lib/actions.ts`, `studio/staff`; `components/admin/BookingDrawer.tsx` (price suggest); plus `*.test.*` for each.
- **Gotcha**: dropping a column + changing `styles String[]`→relation is destructive; for dev, `prisma migrate reset` then reseed is acceptable (no prod). The status/role display strings must map to the prototype's exact labels.
- **Money**: integer pence everywhere; display via existing `_format.ts` pence→£ helper.

## Runtime Environment
- Postgres via `docker compose up -d` (host port 5435; `DATABASE_URL` in `.env`). Migrate: `npm run db:migrate` / for destructive dev change `npx prisma migrate reset --force` then `npm run db:seed` (needs env sourced: `set -a && . ./.env && set +a`). Dev: `npm run dev`.

## Assumptions
- Every staff member is an artist (incl. owners) — supported by the prototype (7 artists incl. 2 co-owners); non-artist-only staff are out of scope. Tasks 1,2,4 depend on this.
- The seeded OWNER `adamjjessop@gmail.com` remains the owner login and is linked 1:1 to the Sarah artist profile (Sarah's displayName stays "Sarah"); other artists get `<first>@bootsnbandit.co.uk` Users. Supported by current seed (owner→Sarah link). Task 2 depends on this.
- `ArtistStatus` for the two co-owners = `CO_OWNER` + `User.role=OWNER`; Tom = `APPRENTICE`; the rest = `RESIDENT`. Derived from prototype `role` strings. Task 2 depends on this.
- Implicit m-n (no ordering needed for an artist's styles) is sufficient — supported by prototype (styles shown as an unordered tag set). Task 1 depends on this.

## Testing Strategy
- Unit: status-label mapping, styles-relation → names mapping, price-suggest helper, seed-count assertions (still 7 artists, now 7 linked Users, each artist has ≥1 style relation + numeric rates).
- Integration: a staff/artist created via admin yields BOTH a User (auth) and Artist (profile) linked 1:1; passkey sign-in still resolves `artistId`.
- Whole-repo: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` (≥ previous 440, all green) after a `migrate reset` + reseed.

## Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Destructive migration loses dev data | High (expected) | Low | Dev-only; `migrate reset` + reseed is the documented path; no prod |
| Artist-create flow forgets to create the User (orphan) | Med | High | Required 1:1 FK makes an artist-without-user impossible at the DB; admin create wrapped in a single transaction (User+Artist) |
| `styles String[]`→relation breaks match/enquire reads | Med | High | Keep `MatchArtist.styles: string[]`; map relation→names in the loader only; covered by a match test |
| Renaming `hourlyPence`→`hourlyRatePence` misses a consumer | Med | Med | grep inventory enumerates all 6 sites; tsc catches the rest |
| Owner/Sarah link ambiguity (two emails) | Low | Med | Pinned in Assumptions; seed asserts exactly one OWNER user linked to the Sarah artist |

## Pre-Mortem
1. **Auth regression** (Task 3) → Trigger: after the schema change, `getCurrentUser()` returns `artistId: null` because the `user.artist` include/relation name changed → sign-in lands a staff user with no artist scope. Check: the auth integration test must still assert `artistId` is populated.
2. **Half-created staff** (Task 4) → Trigger: admin "add artist" creates an Artist row but no User (or vice-versa), or a non-transactional create leaves an orphan on error. Check: create is a single `prisma.$transaction`; an integration test asserts both rows exist + are linked.
3. **Style data lost on migration** (Task 1/2) → Trigger: reseed runs but artists end up with zero linked styles (relation connect by name failed because TattooStyle rows seed after artists) → matcher returns degenerate results. Check: seed orders TattooStyle before Artist and a seed-count test asserts every artist has ≥1 style.

## Execution Waves
**Wave 1** — Schema foundation: Task 1 alone (everything depends on the new schema).
**Wave 2** — Data + logic (parallel): Task 2 (seed) and Task 3 (auth/services/match loaders + price helper) — disjoint files, both depend only on Task 1.
**Wave 3** — Surfaces (parallel): Task 4 (admin CMS + staff) and Task 5 (public pages + Inkling + BookingDrawer) — disjoint route areas, depend on Tasks 1–3.
**Wave 4** — Consolidation: Task 6 (whole-repo green after reset+reseed; reconcile any stray tests).

## Goal Verification

### Truths
1. `prisma/schema.prisma` has `model Artist { ... userId String @unique ... status ArtistStatus ... styles TattooStyle[] ... hourlyRatePence Int? dayRatePence Int? }` and **no** `rateText`, **no** `role String`, **no** `styles String[]` (grep-verifiable).
2. `enum ArtistStatus { CO_OWNER RESIDENT APPRENTICE }` exists; `Artist.userId` is non-nullable (grep `userId String @unique`, not `String?`).
3. After `migrate reset` + `db:seed`: 7 Artists, **7 Users** each linked 1:1 (`prisma.user.count` where `artist` is not null = 7), 2 with `role=OWNER`, every artist has ≥1 style relation and non-null `hourlyRatePence`+`dayRatePence`.
4. `src/lib/services/match.ts` still exports the same matcher and a loader maps `styles` relation → `string[]` (grep `\.styles\.map`); `npm test` match tests pass.
5. Auth: `getCurrentUser()` returns `artistId` for an artist user (auth integration test passes; grep `user.artist` in `src/lib/auth/session.ts`).
6. Admin create-artist creates **both** a User and an Artist in one transaction (grep `prisma.$transaction` in the artist/staff action); integration test asserts linkage.
7. BookingDrawer suggests a price from the artist rate (grep a `suggest`/`hourlyRatePence` reference in `src/components/admin/BookingDrawer.tsx` or its logic module).
8. Public `/artists/[slug]` renders the status label ("Co-owner"/"Resident Artist"/"Apprentice") and £ hourly/day rates (grep status label + no `rateText`).
9. Whole repo green: `tsc` 0 errors, lint clean, `next build` green, `npm test` 0 failures (≥440).

### Artifacts
| Artifact | Provides | Exports |
| -------- | -------- | ------- |
| `prisma/schema.prisma` + new migration | Unified model, status enum, style relation, numeric rates | Artist/User/ArtistStatus |
| `prisma/seed.ts` | 7 artists+users, style connects, statuses, rates | seed |
| `src/lib/services/match.ts` (+ loader) | Style-relation→names mapping | matcher unchanged |
| `src/lib/pricing.ts` (new) | Session-price suggestion | `suggestSessionPricePence(artist, durationMin)` |
| `src/app/(admin)/admin/content/artists/*` + `studio/staff/*` | Unified create/edit (User+Artist) | server actions |
| `src/app/(site)/artists/*` + `enquire`/`inkling` | Status label, styles, £ rates | pages |

### Key Links
| From | To | Via | Pattern |
| ---- | -- | --- | ------- |
| `src/lib/auth/session.ts` | `Artist` | `user.artist` 1:1 | `user\.artist` |
| match data loader | `TattooStyle` | relation→names | `styles\.map\(.*name` |
| admin artist action | `prisma` | atomic User+Artist | `prisma\.\$transaction` |
| BookingDrawer | `src/lib/pricing.ts` | price suggest | `suggestSessionPricePence` |
| seed | `TattooStyle` | connect by name | `styles:\s*\{\s*connect` |

## Progress Tracking
- [x] Task 1: Schema + ArtistStatus enum + style relation + rate rename + migration (Wave 1)
- [x] Task 2: Seed — 7 users 1:1, statuses, style connects, numeric rates (Wave 2)
- [x] Task 3: Auth/services/match loaders + `pricing.ts` price-suggest helper (Wave 2)
- [x] Task 4: Admin Content→Artists CMS + Studio→Staff unified create/edit (Wave 3)
- [x] Task 5: Public artist pages + Inkling + BookingDrawer price-suggest UI (Wave 3)
- [x] Task 6: Whole-repo green — reset+reseed, reconcile tests (Wave 4)
      **Total Tasks:** 6 | **Completed:** 6 | **Remaining:** 0

## Implementation Tasks

### Task 1: Schema, enum, style relation, rate rename + migration
**Objective:** Land the new data model.
**Dependencies:** None · **Wave:** 1
**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_artist_user_unification/`.
**Key Decisions:** `Artist.userId String @unique` (required); `User.artist Artist?` stays optional (allows future non-artist staff). Add `enum ArtistStatus { CO_OWNER RESIDENT APPRENTICE }`, `Artist.status ArtistStatus @default(RESIDENT)`, remove `role String`. Replace `styles String[]` with `styles TattooStyle[]` (+ `TattooStyle.artists Artist[]`). Rename `hourlyPence`→`hourlyRatePence`; remove `rateText`. Generate the migration; for dev, `migrate reset` is acceptable.
**DoD:** `npx prisma validate` passes; `npx prisma migrate reset --force` applies; `npx prisma generate` clean; grep confirms Truth #1/#2.
**Verify:** `npx prisma validate && npx prisma generate`.

### Task 2: Seed
**Objective:** Seed 7 artists each with a 1:1 User, statuses, style connects, numeric rates; drop rateText usage.
**Dependencies:** Task 1 · **Wave:** 2
**Files:** Modify `prisma/seed.ts`; Modify `src/lib/db/seed-counts.test.ts`.
**Key Decisions:** Seed `TattooStyle` before `Artist`; connect each artist's styles by name (the style strings must already exist in `STYLES`). **Decisive email map (no fork):** Sarah → `adamjjessop@gmail.com` (User.role OWNER), Calum → `calum@bootsnbandit.co.uk` (OWNER), the other 5 → `<first>@bootsnbandit.co.uk` (ARTIST). `status`: Sarah/Calum=CO_OWNER, Tom=APPRENTICE, rest=RESIDENT. Set `hourlyRatePence`/`dayRatePence` from existing values; remove `rateText`. Keep the demo ARTIST user count consistent with auth tests.
**DoD:** reseed → 7 Artists, 7 linked Users (2 OWNER), every artist ≥1 style + non-null rates; seed-counts test asserts this (Truth #3).
**Verify:** `set -a && . ./.env && set +a && npx prisma migrate reset --force && npm run db:seed && npm test src/lib/db/seed-counts.test.ts`.

### Task 3: Auth/services/match loaders + pricing helper
**Objective:** Keep auth + matcher working on the new model; add price-suggest helper.
**Dependencies:** Task 1 · **Wave:** 2
**Files:** Modify `src/lib/auth/session.ts`/`webauthn.ts` (verify `user.artist` include); Modify `src/lib/services/match.ts` (+ wherever `MatchArtist` is built, e.g. the match route/_data) to map `styles`→names and `status`; Create `src/lib/pricing.ts` + `src/lib/pricing.test.ts`; Modify `src/lib/services/reports.ts`/calendar/front-desk only if they read `artist.role`.
**Key Decisions:** `suggestSessionPricePence(a: {hourlyRatePence?:number|null; dayRatePence?:number|null}, durationMin:number)` → if duration ≥ 360 and dayRate set → dayRatePence; else `ceil(durationMin/60) * hourlyRatePence` (null-safe → undefined). Matcher interface unchanged. **match.ts hard-codes exact style strings (`"Fine-line"`, `"First tattoos"` at ~lines 136-137) — the relation→names mapping MUST yield those exact `TattooStyle.name` values, so style names in the DB must match the matcher's literals; add a match test that an artist with the "Fine-line" style still scores.** (`specials` stays a `String[]` on Artist — only `styles` becomes a relation.)
**DoD:** auth integration test passes (`artistId` populated — Truth #5); match tests pass with relation-sourced styles (Truth #4); pricing helper unit-tested (Truth #7 logic).
**Verify:** `npm test src/lib/auth src/lib/services/match.test.ts src/lib/pricing.test.ts`.

### Task 4: Admin — Content→Artists CMS + Studio→Staff (unified create/edit)
**Objective:** One flow creates/edits both the User (auth) and Artist (profile); status enum select; styles multi-select from TattooStyle; numeric £ rate inputs; no rateText.
**Dependencies:** Tasks 1–3 · **Wave:** 3
**Files:** Modify `src/app/(admin)/admin/content/artists/page.tsx` (**lines ~18,60 read `role`/`rateText`**) + its action/`coerce` schema (currently coerces `rateText` + comma-joined `styles` string → switch to status enum + style-id array + numeric rates); `src/app/(admin)/admin/profile/_components/ProfileEditor.tsx` (**lines ~56-62,80 expose `rateText`/comma-joined styles**) + `_lib/actions.ts`; `src/app/(admin)/admin/studio/staff/*`; their tests.
**Key Decisions:** Create-artist server action wraps `prisma.$transaction(async tx => { user.create; artist.create{connect user + styles} })` so User+Artist are atomic (Truth #6). Status select (3 options, from the shared label helper); access role (OWNER/ARTIST) on the staff side. Styles = checkbox/multiselect bound to `TattooStyle.findMany` (connect/set by id). Rates = two numeric £ inputs (store pence). **Remove the `rateText` field and the comma-joined-styles input entirely.**
**DoD:** creating an artist yields linked User+Artist (integration test); editing updates styles relation + status + rates; tsc/lint clean for these files.
**Verify:** `npm test src/app/(admin)/admin/content src/app/(admin)/admin/profile` + `npm run build`.

### Task 5: Public artist pages + Inkling + BookingDrawer price-suggest
**Objective:** Surface status label, style relation, £ rates publicly; wire price-suggest into the drawer.
**Dependencies:** Tasks 1–3 · **Wave:** 3
**Files:** Modify `src/app/(site)/_data.ts` (the `SiteArtist` type — drop `role`/`rateText`/`hourlyPence`, add `status` + `hourlyRatePence`; map style relation→`string[]`), `artists/page.tsx`, `artists/[slug]/page.tsx` (**line ~137 currently falls back to `rateText` for rate display — replace with £ hourly/day from numeric**), **`studio/page.tsx` (MUST-FIX: line ~52 filters founders via `a.role.toLowerCase().includes("owner")` and renders `{f.role}` at ~119 — switch the founder filter to `status === "CO_OWNER"` (or linked `user.role === "OWNER"`) and render the status label)**, `enquire/{page,steps,logic}.tsx`, `inkling` style reads; `src/components/admin/BookingDrawer.tsx` (+ its `booking-form.ts` logic) to call `suggestSessionPricePence`; their tests.
**Key Decisions:** Status label map (`CO_OWNER`→"Co-owner", `RESIDENT`→"Resident Artist", `APPRENTICE`→"Apprentice") — define ONCE in a shared helper (e.g. `src/lib/artist-status.ts`) and reuse in public + admin. `_data.ts` selects `styles: { select: { name: true } }` and maps to `string[]`; rates rendered via pence→£ (no `rateText` fallback anywhere). Drawer pre-fills price estimate from the selected artist + duration (editable).
**DoD:** `/artists` + `/artists/[slug]` build and show status + £ rates + styles (Truth #8); drawer shows a suggested price (Truth #7); tests pass.
**Verify:** `npm test src/app/(site)/artists src/components/admin` + `npm run build`.

### Task 6: Whole-repo green
**Objective:** Reconcile every remaining reference and prove the repo is green end-to-end.
**Dependencies:** Tasks 1–5 · **Wave:** 4
**Files:** Any stray `*.test.*` / consumer still referencing `role`/`rateText`/`styles` string shape.
**Key Decisions:** Run reset+reseed then the four gates; fix fallout (mostly test fixtures). No behavior change.
**DoD:** Truth #9 — `tsc` 0 errors, lint clean, `next build` green, `npm test` 0 failures (≥440).
**Verify:** `docker compose up -d && set -a && . ./.env && set +a && npx prisma migrate reset --force && npm run db:seed && npx tsc --noEmit && npm run lint && npm run build && npm test`.
