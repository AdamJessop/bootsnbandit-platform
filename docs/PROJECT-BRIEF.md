# Boots 'n' Bandit — Project Brief & Source of Truth

> Durable brief for the full build. Read this first. Imported design reference lives in `/design-src/` (styles.css = brand foundation, data.jsx = canonical seed content, app.jsx/index.html = shell reference). The original is a CDN-React/Babel **visual prototype**; we are rebuilding it as a real full-stack product.

## What we're building

A real tattoo studio platform for **Boots 'n' Bandit** (Worksop, Notts), in **two surfaces** — two Next.js apps in one npm-workspaces monorepo sharing `@bnb/core` (see "Monorepo & deployment" below):

1. **Public marketing site** — `apps/web` (apex/www). Faithful rebuild of the prototype: Home, Artists, Gallery, Inkling (AI design-assist), Enquire, Flash, Aftercare/FAQ, Studio, Bandit Pass (loyalty). Dark heritage theme.
2. **Back-of-house staff PWA** — `apps/admin` (admin subdomain). Installable PWA for **artists** and the **studio owner**. Replaces 3rd-party booking tools (Fresha / getink.app). Calendars, CRM, enquiry→booking, session completion + receipts, availability/leave, reporting, and full content management of everything the public site shows.

## Confirmed tech stack (user-approved)

- **Framework:** Next.js 15 (App Router) + TypeScript. Two apps: `apps/web` public (+ public API), `apps/admin` staff PWA (+ staff API); shared domain layer in `packages/core`.
- **UI:** Tailwind CSS. Public site reuses the prototype's `design-src/styles.css` tokens/components (ported). Admin uses **shadcn/ui** themed to the same dark heritage tokens. Icons: **lucide-react**.
- **Fonts:** Pirata One + Cinzel (Google Fonts) for display; Termina is the DS face (optional, OTF in design project — fall back to Inter/system if not licensed). Body uses system stack.
- **Data:** PostgreSQL + **Prisma** ORM. Local dev via Docker Postgres.
- **Auth:** Staff login = **email + passkey (WebAuthn)** via `@simplewebauthn/server` + `@simplewebauthn/browser`. Session cookies. Roles: `ARTIST`, `OWNER` (owner = full admin).
- **Email (transactional, core):** **Resend** + **React Email** templates. Confirmations, reminders, receipts, aftercare follow-up, review request.
- **Calendar:** generate **iCal** feeds per artist (subscribe in Apple/Google); **Google Calendar** two-way later. No payment system — payments are bank transfer; we record amounts + generate receipts/reports only.
- **PWA:** manifest + service worker (installable on staff devices, offline shell for read views).

## Workflow / process (user-mandated)

- All development via **sentinal:spec** skill — this is a **Master plan** (multi-phase, parallel waves, `--worktree=no` since single checkout). Child phase plans planned + implemented + verified through sentinal. Plan-reviewer + spec-reviewer enabled.
- Design scoping done with **ui-ux-pro-max** skill (brand tokens already strong → we keep the heritage palette, NOT the skill's generic blue/Fira suggestion; we DO adopt its UX-rule checklist: 44px targets, 4.5:1 contrast, 150–300ms transitions, focus rings, reduced-motion, responsive 375/768/1024/1440).
- Break work into **individual agents** per phase/wave.
- Plan checkpoint: user reviews master plan before fan-out build.

## Roles & permissions

- **OWNER** — full visibility/admin across all artists, all CRM, all content, all reports, studio settings, staff management, loyalty config.
- **ARTIST** — own calendar, own bookings/clients, own enquiries, complete own sessions, declare own leave, edit own profile/portfolio. Read-only on studio-wide config.
- **Front desk mode** — any signed-in staff can open it: shows who's believed in-studio (artists + their clients today), lets you jump to ANY artist's calendar instantly and add a consult/session. (Not a separate login; a mode/screen.)

## Studio facts (seed)

Boots 'n' Bandit Tattoo Studio · 67 Newcastle Avenue, Worksop, Nottinghamshire, S80 1LX · Tue–Sat 10am–6pm, closed Sun/Mon · Licensed by Bassetlaw District Council · FB profile id 61562021309387. 7 artists, 26 gallery pieces, 9 flash, 5 services, 7 FAQs, 9 styles, 10 placements (see `design-src/data.jsx`).

## Brand tokens (from design-src/styles.css)

crimson `#c92f4d`, gold `#cfa05a`, teal `#36b0a8`, warm-black bg `#0d0c0a`/`#080706`, surfaces `#141210`/`#161310`, text `#fbf7f0`/`#ddd6ca`/`#9b9384`. Status dots: open=teal, limited=gold, closed=grey. Three visual directions (`heritage`/`grit`/`noir`) via `[data-direction]` — public site default = heritage. Admin uses a calmer subset (heritage tokens, less filigree, denser).

## Build order (waves) — see master plan for detail

- **Wave 1 (foundation):** Next.js scaffold + Tailwind + shadcn theme; Prisma schema + Docker Postgres + seed; design system port (tokens, primitives, layout).
- **Wave 2 (core services):** Auth (passkey) + RBAC/session; email service (Resend templates); domain services (bookings, customers, sessions, availability) + API.
- **Wave 3 (public site):** all marketing pages + enquiry submission + flash claim, fed by DB/CMS.
- **Wave 4 (admin PWA):** calendar, front-desk, CRM timeline, enquiry/booking mgmt, session-complete→receipt, leave, reports, content CMS, loyalty config; PWA manifest/SW.
- **Wave 5 (integration/polish):** iCal feeds, CRM automations (reminders/follow-ups via scheduled jobs), review capture, end-to-end verification.

## Monorepo & deployment

The codebase is an **npm-workspaces monorepo** (`workspaces: ["apps/*","packages/*"]`):

- `packages/core` (`@bnb/core`) — shared domain layer (Prisma + services + auth + email + pricing + calendar/cron). Owns the Prisma schema/migrations/seed; both apps depend on it.
- `apps/web` (`@bnb/web`) — public marketing site + public API (enquiries/flash/match/reviews). Apex/www. No staff auth.
- `apps/admin` (`@bnb/admin`) — installable staff PWA + all staff API (auth/customers/bookings/sessions/availability/leave/reports/content/studio/profile/uploads/cron + per-artist iCal feed). admin.<domain>.

**Local dev:** `docker compose up -d` (Postgres on :5435), `set -a && . ./.env && set +a`, `npm run db:seed`. `npm run dev` runs web on **:3000** and admin on **:3001** concurrently (`dev:web` / `dev:admin` run one). `npm run admin:link` mints a one-time `/sign-in?invite=...` enrolment URL against the admin origin. `npm run build|lint|test` fan out across workspaces; `npm run db:*` target `packages/core/prisma`.

**Production deploy (each app = its own host/Vercel project):**

| App | Domain | Host project | Key env |
| --- | ------ | ------------ | ------- |
| `apps/web` | `bootsnbandit.<tld>` + `www` | web project (root dir `apps/web`) | `DATABASE_URL`, `RESEND_API_KEY`, `APP_ORIGIN=https://bootsnbandit.<tld>` |
| `apps/admin` | `admin.bootsnbandit.<tld>` | admin project (root dir `apps/admin`) | `DATABASE_URL`, `RESEND_API_KEY`, `CRON_SECRET`, `SESSION_SECRET`, `APP_ORIGIN=https://admin.bootsnbandit.<tld>`, `RP_ID=admin.bootsnbandit.<tld>`, `SESSION_COOKIE=bb_admin_session`, `AUTH_REDIRECT=/`, `PUBLIC_SITE_ORIGIN=https://bootsnbandit.<tld>` |

Both apps point at one **shared Postgres**. `transpilePackages: ["@bnb/core"]` + `outputFileTracingRoot` (monorepo root) are set in each app's `next.config.ts` so the workspace package is transpiled and traced. Auth/cookie/PWA isolation per subdomain is documented in `docs/SUBDOMAIN-ISOLATION.md` (host-only `bb_admin_session`, admin-scoped WebAuthn RP-ID, admin-only installable PWA). Run DB migrations once from CI/one host against the shared database (`npm run db:migrate`).

## Status log

- [x] Design connector verified; project `da3901cf-...` ("Boots and Bandits") read.
- [x] Imported to `design-src/`: styles.css, data.jsx, index.html (+ app.jsx content captured). Page JSX (home/artists/gallery/ai/book/flash/aftercare/studio/passport), components.jsx, styles-pages.css NOT yet pulled — pull from design project in main session when porting each page (subagents cannot reach DesignSync).
- [x] Binary images (gallery/flash/studio/logo) NOT imported (infeasible via context). Use procedural `Plate` placeholders + CMS upload. Brand mark available as inline SVG (crimson 8-point star/compass on warm black — see design-src/index.html thumbnail template in original).
- [x] git initialized. ui-ux-pro-max design recommendation captured.
- [x] **Phase 1 (Scaffold & Theme) complete.** Next.js 15.5.19 (App Router, TS strict) + React 19.1.0 + Tailwind **v4** + shadcn (base-nova preset) initialized in-place. Heritage tokens ported. `(site)` → `/`, `(admin)` → `/admin`. vitest + Prettier + lucide-react wired. `npm run build|lint|test` all green.
- [ ] NEXT: Phase 2 (Data Layer) + Phase 3 (Design System & Shells) — Wave 2.

## Sentinal file-checker / TDD note (Phase 1 decision)

Sentinal exposes **no path-ignore config key** (`sentinal config list` has no ignore/exclude/companion setting; the file-checker + tdd-guard hooks live in the plugin and are not data-driven). The `file-checker` PostToolUse hook is **non-blocking** (emits a warning, the write still succeeds), and the `tdd-guard` PreToolUse hook can be bypassed per-file via the MCP `tdd_set_state … RED_CONFIRMED`. Therefore there is no file to add `design-src/` to. Convention for downstream phases:

- **Exempt from companion-test expectations** (boilerplate/config/reference, do NOT write tests for): `design-src/**`, `*.config.*` (next/vitest/postcss/eslint), `src/app/**/layout.tsx`, route-group `page.tsx` placeholders, `next-env.d.ts`, `src/components/ui/**` (generated shadcn).
- These produce a harmless non-blocking file-checker warning; ignore it. Real logic in `src/lib/services/**`, `src/lib/**` etc. DOES get companion tests (TDD).

## Build progress (orchestration log)
- Waves 1-3 VERIFIED (6/12): P1 scaffold `9a21fc3`, P2 data `1fc68d8`, P3 design `b4116e3`, P4 auth `44b6e9a`, P5 email `0cb04bd`, P6 domain `01be1fb`. Security hardening: IDOR authz `37580a7`, fail-closed/PII `e621eae`. Full suite 127/127, build green.
- Wave 4 IN FLIGHT (P7 public site, P8 enquire/inkling/review, P9 admin calendar/front-desk, P10 admin CRM/sessions/reports, P11 admin CMS/studio/PWA) — 5 parallel agents, disjoint dirs; shared admin components owned: P9 CalendarGrid+BookingDrawer, P10 CustomerTimeline+DataTable+ChartWrapper, P11 ImageUploader. Each verifies own slice (tsc/lint/build+own tests); orchestrator runs consolidated full-suite check after all 5 land.
- NEXT after Wave 4: consolidated integration verify (full npm test may have inter-phase races — clean + re-run); then Wave 5 = P12 (per-artist iCal feed endpoint `/api/calendar/<token>.ics`, Google Calendar stub, CRM cron automations: reminders T-48/24h, aftercare, review T+4d, loyalty; review-capture already in P8). Then sentinal spec-verify of the master plan.
- Postgres: docker compose, host port 5435. Tailwind v4 tokens in src/app/globals.css. Admin role: AdminRole "owner"|"artist"; DB Role OWNER|ARTIST.

## Full audit sweep + gap build (2026-07-06) — DONE

Four-agent audit of site/backend vs this brief, BACKOFHOUSE-IA, CRON.md, SUBDOMAIN-ISOLATION and `design-src/`. All specs' plans were VERIFIED but 30+ real gaps existed; the high/medium ones were built (tests: 497 → **661**, all green; both apps build + lint clean):

- **Core:** receipt email £0.00/name bug fixed; enquiry-ack content bug fixed; **booking-confirmation email now sends** on transition to confirmed (MessageLog-deduped); customer-facing email links use new `PUBLIC_SITE_ORIGIN` (set it in the admin prod env!); loyalty sends gated on marketing consent; perk emails fire at session completion; `getCurrentUser` re-checks `user.active` (disabled staff lose sessions); new `staff_reply` email type + `MessageType` enum migration; completeSession rejects cancelled/no-show, skips empty-email sends, maps double-complete to 409.
- **Admin:** sign-out control + add-passkey UI (neither existed); **owner leave-approval panel** (pending leave was previously unapprovable dead-ends); front-desk cross-artist booking CREATE for any staff; cron route accepts GET + `apps/admin/vercel.json` (Vercel Cron would have 405'd); mobile "More" nav (7 screens were unreachable on phones); enquiry reply + manual customer email now actually send via `staff_reply`; enquiry detail shows mood-board thumbs + message thread + artist/style filters; completed-sessions list with resend-receipt; CRM tags + lifetime-value columns; owner Today alerts (pending soon, overdue follow-ups); install-prompt button; sw.test.js no longer deployed.
- **Web:** enquire preselect fixed (accepts slug or id; gallery link used wrong param — main funnel silently no-opped); CMS-uploaded gallery/flash images now render (were never selected); `enquiriesOpen` gate enforced (API 403 + books-closed page); ticker/footer fed from SiteSettings; budget field on wizard; mood-board = real URL capture (was fake `moodboard:<timestamp>` strings, both Enquire + Inkling); studio contact form submits; per-IP rate limiting on all public POSTs; dead staff-auth GET removed + guard test (no `@bnb/core/auth` imports in web); sitemap artist slugs, branded 404, DB-fed home reviews, derived flash-drop banner.
- **Docs/infra:** CRON.md corrected (admin origin/:3001, `packages/core/src/cron`, GET note); brief opening updated to monorepo reality; per-app `.env.example` now deploy-complete; root `db:*` scripts fixed for Prisma 7 (delegate to `@bnb/core`); global `:focus-visible` rings both apps.

**Deferred (recommendations, not built):** front-desk presence persistence (needs schema); calendar drag-resize + chair columns; booking-drawer deposit/reminders flags + customer combobox; DB-backed email-template editing (K3); sign-out-everywhere (needs session versioning); `Service` model for the "5 services" studio fact (product decision); real consult-slot availability on public enquire (still deterministic placeholder); public mood-board *upload* backend (URL capture shipped); per-customer Bandit Pass view; `isWithinAvailability` wiring into booking create; `completedByUserId`; loyalty reward reset/redemption model; Google Calendar two-way sync (brief: later).

## Backend app separation (monorepo + subdomains) — DONE
- **All 5 phases complete.** P1 workspaces + `@bnb/core` (`f0f715b`), P2 web (`743a1e5`), P3 admin (`927b887`), **P4 auth/cookie/PWA isolation + P5 cutover** (this entry).
- **Isolation (P4):** per-app `.env.example` (web `APP_ORIGIN=:3000`, no staff auth; admin `APP_ORIGIN=:3001` + `RP_ID` + `SESSION_COOKIE=bb_admin_session` + `AUTH_REDIRECT=/`). Staff session cookie is **host-only** (no `Domain=`) + HttpOnly + SameSite=Lax + Secure(prod), env-driven name in set/read/clear (`@bnb/core` auth/cookies+config) and the admin middleware. WebAuthn RP-ID/origin env-driven (localhost dev). Only admin is the installable PWA (manifest+sw at admin root; web ships none). See `docs/SUBDOMAIN-ISOLATION.md`.
- **Cutover (P5):** deleted legacy root `src/app`, `src/components`, root `public/`, root app configs (`next.config.ts`/`tsconfig.json`/`vitest.config.ts`/`postcss.config.mjs`/`components.json`/`next-env.d.ts`/`.next`). Kept root `package.json` (orchestrator), shared `eslint.config.mjs`, `.gitignore`, `docs/`, `design-src/`, `packages/`, `apps/`, `scripts/`. `git ls-files src/app` empty. `scripts/admin-link.ts` now imports `@bnb/core/db`; seed/prisma target `packages/core/prisma`. Core gained its own `vitest.config.ts` + `test` script; the cross-app `e2e-lifecycle.test.ts` (imports the admin iCal route) moved into `apps/admin`.
- **Root scripts:** `dev` = web :3000 + admin :3001 concurrently; `build` = `db:generate` + `--workspaces`; `lint`/`test` fan out; `db:*` + `admin:link` preserved.
- **Verify (all green):** core 108 / web 89 / admin 300 = **497 tests, 0 failures** (≥483). tsc + lint + `next build` clean per app; prisma validate/generate/seed clean; `npm run admin:link` prints `http://localhost:3001/sign-in?invite=...`.
