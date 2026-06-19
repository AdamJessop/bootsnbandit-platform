# Boots 'n' Bandit — Project Brief & Source of Truth

> Durable brief for the full build. Read this first. Imported design reference lives in `/design-src/` (styles.css = brand foundation, data.jsx = canonical seed content, app.jsx/index.html = shell reference). The original is a CDN-React/Babel **visual prototype**; we are rebuilding it as a real full-stack product.

## What we're building

A real tattoo studio platform for **Boots 'n' Bandit** (Worksop, Notts), in **two surfaces, one Next.js codebase**:

1. **Public marketing site** — `(site)` route group. Faithful rebuild of the prototype: Home, Artists, Gallery, Inkling (AI design-assist), Enquire, Flash, Aftercare/FAQ, Studio, Bandit Pass (loyalty). Dark heritage theme.
2. **Back-of-house staff PWA** — `(admin)` route group. Installable PWA for **artists** and the **studio owner**. Replaces 3rd-party booking tools (Fresha / getink.app). Calendars, CRM, enquiry→booking, session completion + receipts, availability/leave, reporting, and full content management of everything the public site shows.

## Confirmed tech stack (user-approved)

- **Framework:** Next.js 15 (App Router) + TypeScript. Route groups `(site)` public, `(admin)` staff PWA, `app/api/*` backend.
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
