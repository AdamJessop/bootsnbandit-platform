# Staff-Based Availability, Calendar & Session Customer Creation Implementation Plan

Created: 2026-07-07
Status: VERIFIED
Approved: Yes
Iterations: 1
Worktree: No
Type: Feature

## Summary

**Goal:** Remove the chair/resource concept in favour of per-artist scheduling, fix staff dropdowns showing IDs, add an all-staff calendar view, let owners edit any artist's profile (incl. headshot), and let staff create customers inline while booking — with customer accounts (set-password link), a login-gated passport/account area on the public site, and booking confirmation emails.

**Architecture:** npm-workspaces monorepo. `apps/web` (public site, port 3000) + `apps/admin` (staff PWA, port 3001) share `packages/core` (Prisma singleton, services, auth, React Email templates). Staff auth is WebAuthn + JWE session cookie; customer auth (new) mirrors the JWE cookie pattern with scrypt password hashing, all in `@bnb/core`.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma + Postgres, Base UI (`@base-ui/react`) select components, React Email + Resend, Vitest.

## Scope

### In Scope

1. Full removal of `Chair` model, `Booking.chairId`, Studio→Resources page, and the dashboard "Chairs in use" stat (replaced with an artist-based stat).
2. Fix all ID-showing staff/customer `Select` dropdowns (calendar, availability, booking drawer, enquiries, reports).
3. "All staff" calendar option for owners: day view = one column per artist; week view = single grid with colour-coded overlaid events + legend.
4. Owner-gated per-artist profile editor (headshot, bio, rates, styles, specials, insta, status) reached from Studio→Staff "Edit profile".
5. Booking drawer: new bookings default to `confirmed`; inline "new customer" creation (name, DOB, email) which mints a set-password token and sends a welcome email.
6. Customer auth: `passwordHash`/`dob` on Customer, `CustomerPasswordToken` (30-day expiry, auto-reissue on expired use), JWE customer session cookie, sign-in/sign-out/set-password pages on the web app.
7. Passport page becomes a login-gated account area with real loyalty data, upcoming/past bookings, and a "request cancellation" action; admin bookings table surfaces cancellation requests.
8. `welcome` email template (set-password link) + email-templates admin preview entry.

### Out of Scope

- Customer self-service rescheduling or true self-cancellation (staff still action cancellations).
- Password reset flow for customers who forget passwords after activation (future; the token reissue only covers expired *activation* links).
- SMS notifications; payments/deposits.
- Migrating existing production data (no `chairId` values are meaningfully used; dev DB is reseeded).
- Changing reports — utilisation is already computed per-artist from `AvailabilityRule` (`packages/core/src/services/reports.ts`).

## Context for Implementer

> Zero-context notes. Dev: `npm run dev` starts web (:3000) + admin (:3001). DB via docker on :5435. Tests: `npm test` (vitest per workspace). Prisma CLI needs `DATABASE_URL` — scripts in `packages/core/package.json` (`db:migrate`, `db:generate`, `db:seed`); load root `.env` (e.g. `npx tsx --env-file=.env` pattern used by root `admin:link` script).

- **Patterns to follow:**
  - Server actions + zod validation: `apps/admin/src/app/(staff)/calendar/actions.ts`.
  - Owner gating: `requireRole("OWNER")` from `@bnb/core/auth` (see `studio/staff/page.tsx:15`).
  - JWE session: `packages/core/src/auth/session.ts` (HKDF from `SESSION_SECRET`, `dir`+A256GCM). Cookie helpers: `packages/core/src/auth/cookies.ts`.
  - Invite-token flow to copy for set-password tokens: `StaffInvite` model + `packages/core/src/auth/invite.ts`.
  - Email sending: `sendEmail` in `packages/core/src/email/index.ts` — logs to `MessageLog`, never throws. Templates in `packages/core/src/email/templates/*.tsx`, registered in `packages/core/src/email/render.ts` (`renderEmail` switch) and previewed in `apps/admin/src/app/(staff)/studio/email-templates/page.tsx` (static registry at line ~16).
  - Confirmation email dedup pattern: `sendConfirmationEmail` in `packages/core/src/services/bookings.ts:107`.
  - Image upload: `ImageUploader` (`apps/admin/src/components/admin/ImageUploader.tsx`) POSTs to owner-gated `/api/uploads`.
  - CRUD/coerce helpers for admin forms: `apps/admin/src/app/(staff)/content/_lib/`.
- **Conventions:** money in integer pence; tests co-located `*.test.ts(x)`; pure logic extracted to tested helper modules (e.g. `calendar-layout.ts`); files ≤400 lines (Sentinal limit); en-GB formatting.
- **Key files:**
  - `packages/core/prisma/schema.prisma` — all models.
  - `apps/admin/src/components/ui/select.tsx` — Base UI Select wrapper. **Gotcha:** Base UI `Select.Value` renders the raw `value` string (the cuid) in the closed trigger unless `items` (a `{ value, label }[]` or record) is passed to `Select.Root` — that is the entire "shows ID" bug.
  - `apps/admin/src/components/admin/CalendarGrid.tsx` + `calendar-layout.ts` — time-grid geometry (Tue–Sat 10:00–18:00, `PX_PER_MIN`).
  - `apps/admin/src/app/(staff)/calendar/{page,CalendarClient,data,actions}.tsx/ts` — calendar surface; owner artist switching via `?artist=` param.
  - `apps/admin/src/components/admin/{BookingDrawer.tsx,booking-form.ts,booking-drawer-state.ts}` — booking form; all field maths in the pure modules.
  - `apps/admin/src/app/(staff)/profile/{page.tsx,_components/ProfileEditor.tsx,_lib/actions.ts}` — self-service profile editor (already includes headshot via ImageUploader).
  - `packages/core/src/services/{bookings,customers,reports}.ts`.
  - `apps/web/src/app/passport/page.tsx` — currently static sample content.
  - `apps/web/src/lib/site-nav.ts` — public nav links.
- **Gotchas:**
  - Web app has **no auth at all** today (no middleware). Customer session must use a cookie name distinct from staff (`bb_customer_session`), host-only, and `SESSION_SECRET` + `RESEND_API_KEY` must be added to `apps/web/.env.example` (root `.env` covers dev).
  - `Artist.hue` exists (string) — use it for all-staff event colouring; artists without hue need a deterministic fallback palette.
  - `sendEmail` requires the `MessageType` Prisma enum to contain any new type — enum change is a migration.
  - The admin `saveProfile` action (`profile/_lib/actions.ts`) saves *the signed-in user's* artist; the owner variant must take an explicit artistId and `requireRole("OWNER")`.
  - `EnquiryInbox` selects use placeholder-only `SelectValue` with artist IDs as values — same items fix applies.
  - No bcrypt/argon dependency exists; use `node:crypto` scrypt + `timingSafeEqual` (no new dep).
- **Domain context:** Bookings belong to a customer + artist with `[start,end)` conflict checks against other bookings and approved leave. Loyalty: `Customer.loyaltyStamps/loyaltyTier`, config in `LoyaltyConfig` (perks ladder JSON). Passport = customer-facing loyalty card branding ("Bandit Pass").

## Runtime Environment

- **Start:** `npm run dev:web` (:3000), `npm run dev:admin` (:3001)
- **DB:** `docker compose up -d` (Postgres :5435); migrate: `npm run db:migrate`; seed: `npm run db:seed`
- **Admin login:** `npm run admin:link` → open printed URL, passkey sign-in
- **Health check:** GET / on each port

## Assumptions

- No production data exists; destructive `Chair` drop + reseed is safe — supported by dev-stage repo, seed script rebuilds everything — Tasks 1, 2 depend on this.
- Base UI `Select.Root` accepts an `items` prop that makes `Select.Value` render labels — VERIFIED against the installed package (`node_modules/@base-ui/react/select/root/SelectRoot.d.ts`) by the plan reviewer; fallback (SelectValue render function) documented in Task 3 regardless — Task 3 depends on this.
- `Artist.hue` is a usable CSS hue/colour token for event colouring — supported by schema field + existing usage in web content — Tasks 5, 6.
- Customer email is unique-enough to key sign-in (schema has non-unique `email`); sign-in resolves the most recent customer with a `passwordHash` for that email — Tasks 7, 10. (No unique constraint added: existing data may hold duplicates.)
- Admin app sends the welcome email using `PUBLIC_SITE_ORIGIN` for the set-password URL (already in `apps/admin/.env.example:25`) — Tasks 8, 9.

## Testing Strategy

- **Unit:** pure helpers (token expiry/reissue decision, scrypt hash/verify, drawer state defaults, multi-artist layout mapping, dropdown item mapping) via co-located Vitest files.
- **Integration:** service-level tests using the existing `testdb` harness (`packages/core/src/services/testdb.ts`) for customer-auth service, welcome-email dedup, booking-with-new-customer action.
- **Manual verification:** run both apps; book a session for a brand-new customer → welcome + confirmation emails logged in MessageLog; open set-password link, set password, sign in, see passport with the booking; request cancellation → badge in admin bookings.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Base UI version lacks `items` on Select.Root | Low | Medium | Fallback: `SelectValue` children render fn mapping value→label (wrapper already forwards props) |
| Dropping `Chair` breaks unnoticed references (tests/fixtures) | Medium | Low | Repo-wide grep for `chair` after migration; run full `npm test` |
| Duplicate customer emails make sign-in ambiguous | Medium | Medium | Sign-in picks newest credentialed match; document; admin can merge later (out of scope) |
| Welcome email leaks across origins (admin vs web reissue) | Low | Medium | Set-password URL always built from `PUBLIC_SITE_ORIGIN` in both apps |
| All-staff week overlay unreadable with many artists | Medium | Low | Colour-coded blocks + legend; day view carries the per-artist columns detail |
| Brute-force of sign-in password / set-password token guessing on new public endpoints | Medium | High | 24-byte base64url tokens (~192 bits); rate-limit both actions via `apps/web/src/lib/rate-limit.ts` with a test asserting the limiter fires (Task 10 DoD) |

## Pre-Mortem

_Assume this plan failed. Most likely internal reasons:_

1. **Select `items` prop doesn't behave as expected in the installed `@base-ui/react`** (Task 3) → Trigger: closed trigger still renders the cuid in the first manual check → switch immediately to the `SelectValue` render-function fallback.
2. **All-staff mode bolted onto CalendarGrid breaks single-artist drag/create geometry** (Tasks 5–6) → Trigger: existing CalendarGrid tests fail or drag produces wrong ISO times in single-artist view → keep single-artist code path untouched; artist-columns is a sibling rendering branch, not a rewrite.
3. **Customer session work stalls on web/admin env drift** (Tasks 10–11) → Trigger: JWE decode fails on web with valid cookie → confirm both apps share `SESSION_SECRET` from root `.env` in dev and web `.env.example` documents it for standalone deploys.

## Execution Waves

**Wave 1** — foundations (parallel): Task 1 (schema+seed), Task 3 (select fix), Task 4 (owner profile editor), Task 5 (calendar grid multi-artist) — disjoint files.
**Wave 2** — dependents (parallel): Task 2 (chair sweep; needs new client), Task 6 (all-staff wiring; needs Task 5), Task 7 (customer auth core; needs schema), Task 12 (admin cancel badge; needs schema).
**Wave 3** — email foundation: Task 8 (welcome email template + orchestration; needs Task 7 tokens).
**Wave 4** — consumers (parallel): Task 9 (inline customer creation; needs Tasks 3, 7, 8), Task 10 (web auth pages; needs Tasks 7, 8) — disjoint files.
**Wave 5** — Task 11 (gated passport/account; needs Task 10).

## Goal Verification

### Truths

1. `grep -c "Chair\|chairId" packages/core/prisma/schema.prisma` returns 0.
2. `apps/admin/src/app/(staff)/studio/resources/` no longer exists; `grep -r "prisma.chair" apps packages` (excluding migrations) returns nothing.
3. `grep "items=" apps/admin/src/app/(staff)/calendar/CalendarClient.tsx apps/admin/src/components/admin/BookingDrawer.tsx apps/admin/src/app/(staff)/availability/AvailabilityEditor.tsx` each match (label-rendering fix applied).
4. `grep -i "all staff\|ALL_STAFF" apps/admin/src/app/(staff)/calendar/CalendarClient.tsx` matches, and `CalendarGrid.tsx` supports an artist-columns day mode (`grep -i "artistColumns\|byArtist" apps/admin/src/components/admin/CalendarGrid.tsx`).
5. `grep "confirmed" apps/admin/src/components/admin/booking-drawer-state.ts` shows new-booking default status.
6. `grep "dob\|passwordHash" packages/core/prisma/schema.prisma` matches on Customer; `grep "model CustomerPasswordToken" packages/core/prisma/schema.prisma` matches.
7. `packages/core/src/email/templates/welcome.tsx` exists and `grep "welcome" packages/core/src/email/render.ts` matches.
8. `apps/web/src/app/account/sign-in/page.tsx` and `apps/web/src/app/account/set-password/page.tsx` exist.
9. `grep "getCustomerSession\|requireCustomer" apps/web/src/app/passport/page.tsx` matches (passport is gated).
10. `grep "cancelRequestedAt" packages/core/prisma/schema.prisma apps/admin/src/app/(staff)/bookings/BookingsTable.tsx` both match.
11. `curl -s -o /dev/null -w "%{http_code}" localhost:3000/passport` returns 307/302 (redirect to sign-in) when unauthenticated.
12. `grep "loyaltyStamps\|loyaltyTier" apps/web/src/app/passport/page.tsx` matches (loyalty points wired into the gated passport).

### Artifacts

| Artifact | Provides | Exports |
| --- | --- | --- |
| `packages/core/prisma/migrations/*_staff_based_scheduling/` | Chair drop + customer auth schema | — |
| `packages/core/src/auth/customer-session.ts` | Customer JWE session encode/decode + cookie name | `encodeCustomerSession`, `decodeCustomerSession`, `CUSTOMER_COOKIE` |
| `packages/core/src/services/customer-auth.ts` | scrypt hash/verify, set-password token mint/redeem/reissue, sign-in | `hashPassword`, `verifyPassword`, `mintSetPasswordToken`, `redeemSetPasswordToken`, `signInCustomer` |
| `packages/core/src/email/templates/welcome.tsx` | Welcome email w/ set-password link | default template component |
| `packages/core/src/services/customer-welcome.ts` | Create-customer-with-welcome orchestration (+ reissue send) | `createCustomerWithWelcome`, `resendSetPasswordLink` |
| `apps/admin/src/components/admin/CalendarGrid.tsx` (mod) | Artist-columns day mode + overlay colours | `CalendarGrid` (new props) |
| `apps/admin/src/app/(staff)/studio/staff/[id]/page.tsx` | Owner edit-any-artist profile screen | page |
| `apps/web/src/app/account/sign-in/page.tsx` + `set-password/page.tsx` + `actions.ts` | Customer sign-in / activation | pages + server actions |
| `apps/web/src/lib/customer-auth.ts` | Web-side session guard | `getCustomerSession`, `requireCustomer` |
| `apps/web/src/app/passport/page.tsx` (mod) | Gated account: loyalty + bookings + cancel request | page |

### Key Links

| From | To | Via | Pattern |
| --- | --- | --- | --- |
| `apps/admin/src/app/(staff)/calendar/actions.ts` | `customer-welcome` service | new-customer booking action | `createCustomerWithWelcome` |
| `packages/core/src/services/customer-welcome.ts` | `email/index.ts` | welcome send | `sendEmail\(` and `type: "welcome"` |
| `apps/web/src/app/account/set-password/page.tsx` | `customer-auth` service | token redeem + expired reissue | `redeemSetPasswordToken` |
| `apps/web/src/app/passport/page.tsx` | `apps/web/src/lib/customer-auth.ts` | gate | `requireCustomer` |
| `apps/admin/src/app/(staff)/calendar/CalendarClient.tsx` | `CalendarGrid` | all-staff mode | `ALL_STAFF\|byArtist` |
| `apps/admin/src/app/(staff)/studio/staff/page.tsx` | `[id]/page.tsx` | Edit profile link | `href={\`/studio/staff/` |
| `apps/admin/src/app/(staff)/page.tsx` | artist-based stat | dashboard swap | `Artists booked\|artistsBooked` |

## Progress Tracking

- [x] Task 1: Schema migration + seed (Wave 1) — note: `chairId` removal from `bookings.ts` + `api/bookings/route.ts` pulled forward from Task 2 (Prisma runtime rejected the dropped column; anticipated in Task 1 DoD)
- [x] Task 2: Chair/resource code sweep + dashboard stat (Wave 2) — dashboard KPI is now "Artists booked today" (`artistsBookedToday` helper, unit-tested)
- [x] Task 3: Select dropdown label fix (Wave 1) — `items` prop approach; also fixed `__all__`/`all` sentinel labels in EnquiryInbox/ReportsView filters
- [x] Task 4: Owner artist-profile editor from Studio (Wave 1)
- [x] Task 5: CalendarGrid multi-artist modes + data loaders (Wave 1) — new `CalendarLegend.tsx` extracted for the line limit; API: `mode`/`artists` props, `onCreate(start, artistId?)`, `artistTone()`, `loadCalendarDataAll()`
- [x] Task 6: All-staff calendar wiring (Wave 2) — includes drag-move fix (event's own artistId, not activeArtistId)
- [x] Task 7: Customer auth core (Wave 2)
- [x] Task 8: Welcome email template + orchestration service (Wave 3)
- [x] Task 9: Booking drawer inline customer creation + confirmed default (Wave 4) — new `NewCustomerFields.tsx` extracted for the line limit
- [x] Task 10: Web sign-in / set-password / sign-out (Wave 4) — note: `core-auth-guard.test.ts` narrowed to allow only the `@bnb/core/auth/customer-session` subpath on the web origin (staff auth barrel still forbidden)
- [x] Task 11: Gated passport account area + cancel requests (Wave 5)
- [x] Task 12: Admin surfacing of cancellation requests (Wave 2)
      **Total Tasks:** 12 | **Completed:** 12 | **Remaining:** 0

## Deferred Issues

- `packages/core/prisma/seed.ts` exceeds the Sentinal 600-line limit (876 lines) and has no companion test — pre-existing condition; this spec only removed lines from it. Splitting the seed script is out of scope.
- The web sign-in/set-password rate limiter (`apps/web/src/lib/rate-limit.ts`) is in-memory/per-process — sufficient for the current single-instance deployment, but horizontal scaling would need a shared store (e.g. Redis). Known limitation, noted by spec review.

## Implementation Tasks

### Task 1: Schema migration + seed

**Objective:** One migration that drops the chair concept and adds customer-auth fields.
**Dependencies:** None
**Wave:** 1

**Files:**

- Modify: `packages/core/prisma/schema.prisma`
- Modify: `packages/core/prisma/seed.ts`
- Create: migration via `npm run db:migrate` (name: `staff_based_scheduling`)

**Key Decisions / Notes:**

- Remove `model Chair`, `Booking.chairId` + `chair` relation (schema.prisma:305, 365–374).
- Add to `Customer`: `dob DateTime?`, `passwordHash String?`.
- Add `model CustomerPasswordToken { id, customerId, token @unique, expiresAt, redeemedAt DateTime?, createdAt }` with relation + `@@index([customerId])`. Relation added on Customer.
- Add `Booking.cancelRequestedAt DateTime?`.
- Add `welcome` to `MessageType` enum.
- Seed: remove `CHAIRS` const + Chair insert block (seed.ts:662, 837–869 region); keep everything else. Reseed dev DB.

**Definition of Done:**

- [ ] Migration applies cleanly on the dev DB; `npm run db:generate` succeeds
- [ ] `grep -c "Chair" packages/core/prisma/schema.prisma` = 0
- [ ] `npm run db:seed` completes
- [ ] Core package tests still pass (except known chair references removed in Task 2 — if service tests reference chairId, adjust them here since seed/service types break at compile time)

**Verify:**

- `npm -w @bnb/core run test`
- `grep -n "chairId\|Chair" packages/core/prisma/schema.prisma packages/core/prisma/seed.ts` → no matches

### Task 2: Chair/resource code sweep + dashboard stat

**Objective:** Remove every chair code path and replace the dashboard chair stat with an artist-based one.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Modify: `packages/core/src/services/bookings.ts` (drop `chairId` from inputs/creates/updates, lines 144, 172, 196, 237; comment line 30)
- Modify: `apps/admin/src/app/api/bookings/route.ts` (drop `chairId` zod field, line 25)
- Delete: `apps/admin/src/app/(staff)/studio/resources/page.tsx` (+ its test)
- Modify: `apps/admin/src/app/(staff)/studio/page.tsx` (remove Resources card + `Armchair` import, lines 2, 18–19)
- Modify: `apps/admin/src/app/(staff)/page.tsx` (replace "Chairs in use" stat, lines 63–119, with "Artists booked today" = distinct artists with active bookings today / active artists)

**Key Decisions / Notes:**

- Utilisation in reports/`reports.ts` is already artist-based — do not touch.
- Sweep check: `grep -rn "chair" apps packages --include="*.ts" --include="*.tsx" -i` — only prose mentions (seed bios, web copy) may remain.

**Definition of Done:**

- [ ] All tests pass; no `prisma.chair` or `chairId` references remain in code
- [ ] Dashboard renders the artist-based stat
- [ ] `/studio/resources` returns 404; Studio index has no Resources card

**Verify:**

- `npm -w @bnb/admin run test && npm -w @bnb/core run test`

### Task 3: Select dropdown label fix

**Objective:** Closed/selected staff & customer dropdowns show names, not cuids, everywhere.
**Dependencies:** None
**Wave:** 1

**Files:**

- Modify: `apps/admin/src/app/(staff)/calendar/CalendarClient.tsx` (artist select, ~line 191)
- Modify: `apps/admin/src/app/(staff)/availability/AvailabilityEditor.tsx` (artist select, ~line 137)
- Modify: `apps/admin/src/components/admin/BookingDrawer.tsx` (customer + artist selects, ~lines 189, 207)
- Modify: `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx` (artist filter + assign selects, ~lines 121, 253)
- Modify: `apps/admin/src/app/(staff)/reports/ReportsView.tsx` (artist select, ~line 104)
- Test: extend co-located component tests to assert the trigger renders the selected name

**Key Decisions / Notes:**

- Root cause: Base UI `Select.Value` renders the raw value. Fix: pass `items={options.map(o => ({ value: o.id, label: o.name }))}` to `Select` (Root forwards to Base UI) so `SelectValue` renders labels. If the installed version rejects `items`, use `<SelectValue>{(value) => nameById.get(value) ?? placeholder}</SelectValue>` render-function fallback — pick ONE approach and apply consistently.
- Enum-valued selects (status/type/duration) are unaffected; leave them.

**Definition of Done:**

- [ ] With a row selected, each listed dropdown's closed trigger shows the human name
- [ ] All existing component tests pass

**Verify:**

- `npm -w @bnb/admin run test`
- Manual: open /calendar as owner, pick artist — trigger shows name

### Task 4: Owner artist-profile editor from Studio

**Objective:** Owners click "Edit profile" on a staff row and edit that artist's full profile (headshot, bio, rates, styles, specials, insta, status).
**Dependencies:** None
**Wave:** 1

**Files:**

- Create: `apps/admin/src/app/(staff)/studio/staff/[id]/page.tsx` (+ test)
- Modify: `apps/admin/src/app/(staff)/profile/_lib/actions.ts` (add owner variant `saveArtistProfile(artistId, fd)` or extend `saveProfile` with explicit target + `requireRole("OWNER")` when target ≠ self)
- Modify: `apps/admin/src/app/(staff)/profile/_components/ProfileEditor.tsx` (accept optional `statusEditable` prop rendering a status select for owners; status options from `@bnb/core/artist-status`)
- Modify: `apps/admin/src/app/(staff)/studio/_components/StaffManager.tsx` (add "Edit profile" link for users with a linked artist → `/studio/staff/<userId>`)

**Key Decisions / Notes:**

- Route param is the **User id** (staff list is user-centric); page resolves `user.artist` and 404s if no linked artist.
- Reuse `ProfileEditor` exactly — headshot upload already works via `/api/uploads`. This satisfies the "owner sets headshot" requirement.
- Keep `profile/page.tsx` (self view) behaviour unchanged (status stays read-only there).

**Definition of Done:**

- [ ] Owner can open `/studio/staff/<id>` and save changes incl. headshot + status; changes persist
- [ ] Non-owner hitting the route is redirected (requireRole) — including a non-owner hitting their OWN user id (`/studio/staff/<their-own-id>`), proving the gate isn't bypassed by self-id matching
- [ ] StaffManager shows the link only for artist-linked users

**Verify:**

- `npm -w @bnb/admin run test`

### Task 5: CalendarGrid multi-artist modes + data loaders

**Objective:** Grid can render (a) day view with one column per artist and (b) week view with colour-coded multi-artist overlay; data layer loads events for many artists with artist metadata.
**Dependencies:** None
**Wave:** 1

**Files:**

- Modify: `apps/admin/src/components/admin/CalendarGrid.tsx` (new optional props: `mode: "single" | "allStaff"`, `artists: {id,name,hue}[]`; events gain optional `artistId`; day+allStaff → columns per artist; week+allStaff → existing day columns, blocks tinted per artist + name shown)
- Modify: `apps/admin/src/components/admin/calendar-layout.ts` (artist colour helper: hue → block style, deterministic fallback palette by index; export for tests)
- Modify: `apps/admin/src/app/(staff)/calendar/data.ts` (add `loadCalendarDataAll(artistIds, anchor, view)` returning events tagged with `artistId`; keep single-artist loader untouched)
- Test: `CalendarGrid.test.tsx`, `calendar-layout.test.ts`, `data.test.ts`

**Key Decisions / Notes:**

- Single-artist rendering path must remain byte-for-byte behaviourally identical (pre-mortem #2). All-staff is an additive branch.
- All-staff day columns: header = artist name; empty-slot click passes the column's `artistId` through `onCreate(startISO, artistId?)` (extend callback signature, optional arg — backwards compatible).
- Drag-to-move stays enabled within an artist's column (same artist, new time); cross-column drag is out of scope — ignore horizontal movement as today.
- Legend component for week overlay lives in CalendarGrid file if small, else `CalendarLegend.tsx` (mind 400-line limit — prefer extracting).

**Definition of Done:**

- [ ] Grid tests cover: per-artist columns render N columns; overlay week tints by artist; single mode unchanged
- [ ] `loadCalendarDataAll` returns events for all active artists in window

**Verify:**

- `npm -w @bnb/admin run test`

### Task 6: All-staff calendar wiring

**Objective:** Owners get an "All staff" option in the calendar artist dropdown showing everyone's sessions in day and week views.
**Dependencies:** Task 5
**Wave:** 2

**Files:**

- Modify: `apps/admin/src/app/(staff)/calendar/CalendarClient.tsx` (artist select gains "All staff" item with sentinel value `all`; passes mode/artists to CalendarGrid; `openCreate` uses column artistId when provided; drawer requires explicit artist in all-staff mode)
- Modify: `apps/admin/src/app/(staff)/calendar/page.tsx` (accept `?artist=all` for owners; load via `loadCalendarDataAll`; pass artist metadata)
- Test: `CalendarClient.test.tsx`, `page.test.tsx`

**Key Decisions / Notes:**

- `resolveActiveArtist` (data.ts:57) must treat `all` as valid for owners only; artists (non-owners) never see the option.
- Drag-move in all-staff mode calls `updateBookingAction` with the event's own `artistId` (from the tagged event), NOT `activeArtistId` — the current code passes `activeArtistId` (CalendarClient.tsx:140), which would corrupt bookings in all-staff mode. Use the event's artistId in both modes (safe refactor).

**Definition of Done:**

- [ ] Owner selects "All staff" → day view shows a column per artist; week view shows colour-coded overlay with legend
- [ ] Creating from an artist's column pre-selects that artist in the drawer
- [ ] Moving a booking in all-staff mode keeps its artist

**Verify:**

- `npm -w @bnb/admin run test`
- Manual: /calendar?artist=all in both views

### Task 7: Customer auth core

**Objective:** Core primitives: scrypt password hash/verify, customer JWE session, set-password token lifecycle with 30-day expiry + reissue decision.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Create: `packages/core/src/auth/customer-session.ts` (+ test) — mirror `session.ts` with payload `{ sub: customerId, email, name }`, HKDF info `"bb_customer_session_v1"`, cookie name export `bb_customer_session`
- Create: `packages/core/src/services/customer-auth.ts` (+ test)
- Modify: `packages/core/src/services/index.ts` (exports)

**Key Decisions / Notes:**

- `hashPassword`: `scrypt` (N=16384) with 16-byte random salt, stored as `scrypt$<saltB64>$<hashB64>`; `verifyPassword` uses `timingSafeEqual`.
- `mintSetPasswordToken(customerId)`: `randomBytes(24).toString("base64url")`, `expiresAt = now + 30 days` (mirror `admin-link.ts` / StaffInvite pattern).
- `redeemSetPasswordToken(token, newPassword)` returns a discriminated result: `{ ok: true, customerId }` | `{ ok: false, reason: "expired", customerId }` | `{ ok: false, reason: "invalid" }` — expired tokens return the customerId so the caller can reissue. Redeeming sets `redeemedAt`, writes `passwordHash`, and invalidates other outstanding tokens for that customer.
- `signInCustomer(email, password)`: newest customer with matching email AND non-null passwordHash; verify; return customer or null.

**Definition of Done:**

- [ ] Round-trip tests: hash/verify, session encode/decode, token mint→redeem, expired→reason "expired", tampered→"invalid"
- [ ] No new npm dependencies

**Verify:**

- `npm -w @bnb/core run test`

### Task 8: Welcome email template + orchestration service

**Objective:** `welcome` email (set-password link) plus a service that creates a customer with DOB and sends it; reissue path for expired links.
**Dependencies:** Task 7
**Wave:** 3

**Files:**

- Create: `packages/core/src/email/templates/welcome.tsx` (+ test) — greeting, what the Bandit Pass account gives them, CTA button to `setPasswordUrl`, "link valid for 30 days"
- Modify: `packages/core/src/email/render.ts` (register `welcome` with sample data)
- Create: `packages/core/src/services/customer-welcome.ts` (+ test) — `createCustomerWithWelcome({ name, dob, email, siteOrigin })` → createCustomer + mint token + `sendEmail({ type: "welcome", ... })`; `resendSetPasswordLink(customerId, siteOrigin)` → mint fresh token + send again
- Modify: `apps/admin/src/app/(staff)/studio/email-templates/page.tsx` (add `welcome` to the preview registry, ~line 16)

**Key Decisions / Notes:**

- `setPasswordUrl = ${siteOrigin}/account/set-password?token=<token>` — callers pass `PUBLIC_SITE_ORIGIN` (admin) or own origin (web reissue).
- Follow `staff-invite.tsx` template + `layout.tsx` conventions.
- `sendEmail` already logs to MessageLog with `type` — enum value added in Task 1.

**Definition of Done:**

- [ ] Template renders in email-templates admin preview
- [ ] Service test: customer created with dob; MessageLog row `type=welcome`; token row exists with ~30-day expiry

**Verify:**

- `npm -w @bnb/core run test && npm -w @bnb/admin run test`

### Task 9: Booking drawer inline customer creation + confirmed default

**Objective:** Staff can flip the drawer's customer field to "New customer" (name, DOB, email), and saving creates customer → welcome email → booking; new bookings default to `confirmed`.
**Dependencies:** Tasks 3, 7, 8
**Wave:** 4

**Files:**

- Modify: `apps/admin/src/components/admin/booking-drawer-state.ts` (+ test) — new-customer sub-state {mode, name, dob, email}; default status `confirmed` for new drafts (was pending)
- Modify: `apps/admin/src/components/admin/booking-form.ts` (+ test) — validation: new-customer requires name + valid email; dob optional but must parse when given; payload carries `newCustomer` object XOR `customerId`
- Modify: `apps/admin/src/components/admin/BookingDrawer.tsx` — toggle between existing-customer select and new-customer fields
- Modify: `apps/admin/src/app/(staff)/calendar/actions.ts` (+ test) — `saveBookingAction` accepts `newCustomer`; when present calls `createCustomerWithWelcome` (siteOrigin from `PUBLIC_SITE_ORIGIN`) then `createBooking` with the new id

**Key Decisions / Notes:**

- Booking service default status stays `pending` (API safety); the *drawer* default becomes `confirmed`, which triggers the existing confirmation email on create (bookings.ts:187) — this fulfils "any session booked sends a confirmation email" per the user's chosen semantics.
- DOB input: `<Input type="date">`; store as `DateTime` at UTC midnight.
- Keep BookingDrawer under the 400-line limit — extract the new-customer fieldset into `NewCustomerFields.tsx` if needed.

**Definition of Done:**

- [ ] Creating a booking with a new customer: Customer row (with dob), welcome MessageLog, confirmation MessageLog (status confirmed), booking linked
- [ ] Drawer default status for a brand-new draft is `confirmed`; editing an existing booking keeps its status
- [ ] Validation errors render inline for missing name/bad email

**Verify:**

- `npm -w @bnb/admin run test`

### Task 10: Web sign-in / set-password / sign-out

**Objective:** Customers activate via the emailed link (expired links auto-reissue with a clear message) and sign in/out on the public site.
**Dependencies:** Tasks 7, 8
**Wave:** 4

**Files:**

- Create: `apps/web/src/lib/customer-auth.ts` (+ test) — `getCustomerSession()` (read/decode cookie), `requireCustomer()` (redirect `/account/sign-in`)
- Create: `apps/web/src/app/account/sign-in/page.tsx` + `SignInForm.tsx` + `actions.ts` (+ tests) — email+password → `signInCustomer` → set `bb_customer_session` cookie (httpOnly, sameSite=lax, secure in prod, 30-day TTL) → redirect `/passport`
- Create: `apps/web/src/app/account/set-password/page.tsx` + form + action (+ tests) — token from query; valid → set password, sign them in, redirect `/passport`; expired → call `resendSetPasswordLink` and render "That link had expired — we've emailed you a fresh one (valid 30 days)."; invalid → error state
- Modify: `apps/web/.env.example` (document `SESSION_SECRET`, `RESEND_API_KEY`)
- Modify: `apps/web/src/lib/site-nav.ts` (+ test) — account/sign-in link (or "Passport" continues to serve as entry; add "Sign in" nav item)

**Key Decisions / Notes:**

- Server actions on the web app follow the same zod + cookies() patterns as admin; no middleware — per-page guards only.
- Rate-limit sign-in + set-password actions with the existing `apps/web/src/lib/rate-limit.ts`.
- Sign-out: server action clearing the cookie, surfaced on the passport page (Task 11 renders the button; action lives here in `account/actions.ts`).

**Definition of Done:**

- [ ] Full manual loop: set-password link → password set → signed in → cookie present; expired token → fresh email + message
- [ ] Sign-in rejects wrong password
- [ ] Rate limiter is applied to BOTH the sign-in and set-password actions, with a test asserting repeated attempts trigger the limiter

**Verify:**

- `npm -w @bnb/web run test`
- Manual: complete the loop against dev DB

### Task 11: Gated passport account area + cancel requests

**Objective:** Passport becomes the signed-in customer hub: real loyalty progress, upcoming/past bookings, cancellation requests; welcome email promise fulfilled.
**Dependencies:** Task 10
**Wave:** 5

**Files:**

- Modify: `apps/web/src/app/passport/page.tsx` (+ test) — `requireCustomer()`; real data: stamps/tier from Customer, perks from LoyaltyConfig, collection from completed bookings (artist name + date), upcoming bookings list
- Create: `apps/web/src/app/passport/BookingsList.tsx` + `actions.ts` (+ tests) — upcoming (start ≥ now, status pending/confirmed) and past bookings; "Request cancellation" button per upcoming booking → sets `Booking.cancelRequestedAt`, disabled state "Cancellation requested"
- Modify: `apps/web/src/app/passport/PassportCard.tsx` (accept real holder name/stamps — replace sample constants)
- Modify: `apps/web/src/lib/site-nav.ts` if needed (Passport nav copy)

**Key Decisions / Notes:**

- Cancel request must verify the booking belongs to the session's customerId before writing.
- Keep marketing content (perks ladder) for signed-in users below their live card; the pre-login experience is simply the redirect to sign-in (per approved gating decision).
- Loyalty stamps are already maintained by the existing session-completion flow — read-only here.

**Definition of Done:**

- [ ] Unauthenticated GET /passport redirects to /account/sign-in (Truth 11)
- [ ] Signed-in customer sees their stamps, perks, and bookings; cancel request persists and re-renders as requested
- [ ] Sign-out button works

**Verify:**

- `npm -w @bnb/web run test`

### Task 12: Admin surfacing of cancellation requests

**Objective:** Staff can see which bookings have pending cancellation requests.
**Dependencies:** Task 1
**Wave:** 2

**Files:**

- Modify: `apps/admin/src/app/(staff)/bookings/BookingsTable.tsx` (+ test) — "Cancel requested" badge on rows with `cancelRequestedAt`; filter option
- Modify: `apps/admin/src/app/(staff)/bookings/page.tsx` — include field in query

**Key Decisions / Notes:**

- Badge styling: reuse existing status-badge tones (crimson).
- Clearing the flag happens implicitly when staff set status to `cancelled` (no extra action needed this spec).

**Definition of Done:**

- [ ] Booking with `cancelRequestedAt` shows the badge; filter narrows to requested rows

**Verify:**

- `npm -w @bnb/admin run test`
