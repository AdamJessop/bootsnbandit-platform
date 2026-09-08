# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**The studio owner(s)** — run Boots 'n' Bandit, a seven-artist tattoo studio in Worksop. They need one system that replaces Fresha / getink.app for scheduling, the CRM, and the money trail, plus full control of everything the public site says. They work from a tablet or desktop at the studio and from a phone away from it. Role `OWNER` = full admin.

**Resident artists** — manage their own calendar, bookings, clients, enquiries, leave, and public profile. Mostly on their phones between clients; at the studio on the shared tablet. Role `ARTIST` is self-scoped and read-only on studio-wide config.

**Prospective and returning customers** — visiting the public site to pick an artist, look at work, claim flash, send an enquiry with references, read aftercare, or sign in to their Bandit Pass account. Many are first-timers who do not know which style or artist they want; the site must make that decision easy without a phone call.

**Customers at the front desk** — arriving for a consult or session on the studio tablet: check in, sign the consent form, and later check out. Walk-ins are booked on the spot.

Secondary: **front-desk staff** (any signed-in staff member) running the kiosk and jumping into any artist's calendar.

## Product Purpose

Boots 'n' Bandit's own platform, built as three Next.js surfaces over one shared domain layer (`@bnb/core`) and one Postgres database:

1. **Public site** (`apps/web`, apex/www) — marketing plus the enquiry funnel: Home, Artists, Gallery, Inkling (style matcher and mood-board builder), Enquire, Flash, Aftercare/FAQ, Studio, and the Bandit Pass customer account (sign-in, bookings, stamps, perks).
2. **Back-of-house staff PWA** (`apps/admin`, admin subdomain) — installable app for owner and artists: Today, Calendar, Front Desk, Enquiries (omnichannel inbox), Bookings, Customers/CRM, Sessions & Receipts, Availability & Leave, Reports, Content CMS, Studio settings (staff, channels, email templates, integrations), My Profile.
3. **Reception kiosk** (`apps/reception`, reception subdomain) — a studio tablet signed in once with a staff passkey: artists tap in/out for the day, customers check in and sign consent, walk-ins are booked, sessions are checked out (final price → receipt, aftercare email, loyalty stamp), and any artist's profile and gallery can be presented to a customer on screen.

Why it exists: the studio wants to own the whole customer relationship, from first enquiry to healed tattoo and repeat visit, without renting it from third-party booking tools. Success is the owner and artists running the studio day-to-day on this system alone, with every customer touchpoint (ack, confirmation, reminder, receipt, aftercare, review request, loyalty) logged on the customer's timeline.

## Positioning

A single-studio platform where **the enquiry is the unit of the relationship**. Every contact, whether from the web form, Inkling, a flash claim, an email reply, Messenger, or Instagram DM, lands on one customer and one threaded enquiry (30-day threading rule), and staff replies go out wearing the assigned artist's name on the channel the customer used. Booking tools sell a calendar; this sells the studio a memory of every customer.

Second differentiator: **Inkling**, a deterministic style matcher and mood-board builder that turns "I don't know what I want" into a ranked artist match and a reference board attached to the enquiry. No AI generation; the matcher is a scored formula and the board is captured references.

No payments are processed. Payments are bank transfer; the system records amounts and issues receipts and reports.

## Operating Context

- **Studio:** Boots 'n' Bandit Tattoo Studio, 67 Newcastle Avenue, Worksop, Nottinghamshire, S80 1LX. Tue–Sat 10am–6pm, closed Sun/Mon. Licensed by Bassetlaw District Council. UK English, GBP, `en-GB` dates.
- **Devices:** admin is used on a studio tablet/desktop and on artist phones (bottom nav under 1024px, sidebar above). The kiosk is a fixed-viewport tablet PWA, fullscreen, no pinch-zoom, on its own origin. The public site is mobile-first for customers.
- **Rituals:** free 15-minute consultations; flash drops with a deadline and limited claims; sessions completed at the desk with the amount confirmed on the spot; artists declare leave, owners approve it; the Bandit Pass card fills with one stamp per piece (8 stamps, perks at 2/4/6/8).
- **Automations (cron):** enquiry auto-ack, booking confirmation, one idempotent reminder inside the 48h window, receipt + aftercare on completion, review request at T+3–5d, loyalty perk emails, orphan asset purge, webhook-failure prune. Every send is logged to the customer timeline and gated on marketing consent where applicable.
- **Channels:** email via Resend (inbound through a dedicated mail subdomain), Facebook Messenger and Instagram DMs via Meta webhooks (shipped dark behind env until the studio has a developer app). Owner-only Studio › Channels panel shows connection status and replays failed events.
- **Auth:** staff = email + passkey (WebAuthn), no passwords; customers = email + password for the Bandit Pass account. Staff and customer sessions are isolated by origin and cookie name (`docs/SUBDOMAIN-ISOLATION.md`).
- **Local dev:** Docker Postgres on :5435; `npm run dev` runs web :3000, admin :3001, reception :3002.

## Capabilities and Constraints

**Confirmed functionality** is recorded in `docs/PROJECT-BRIEF.md` (status log), `docs/BACKOFHOUSE-IA.md` (screen inventory), `docs/CHANNELS.md`, `docs/CRON.md`, and the specs under `docs/superpowers/specs/`. Treat those as the capability inventory rather than restating them here.

**Terminology (use these words):**
- *Enquiry* (never "lead" or "ticket"); statuses new → replied → customer replied → converted → closed. *Source*: web, inkling, flash, email, messenger, instagram.
- *Booking* of type *consult* or *session*; statuses pending → confirmed → completed → cancelled / no-show.
- *Session* = the completed piece of work with a confirmed amount and receipt.
- *Books* status per artist: open / limited / closed (teal / gold / grey).
- *Flash* = one-off pre-drawn designs, *claimed* not "bought".
- *Bandit Pass* = the loyalty card; *stamps*, *perks ladder*, tier labels like "Level 2 · Outlaw".
- *Inkling* = the style matcher + mood-board builder. *Mood board*, *references*.
- *Front Desk* = the in-studio board and kiosk; artists *tap in / tap out*; customers *check in / check out*.
- *Aftercare stages* (five, ordered, Day 1–2 through Day 30+).
- Staff are *the crew*; the studio voice says "proper brew", "no daft questions", "we never copy another person's tattoo".

**Technical constraints:** Next.js 15 App Router + React 19 + TypeScript strict; Tailwind v4; shadcn/ui in admin; lucide-react icons; Prisma 7 on Postgres; Resend + React Email; vitest with TDD companion tests for real logic; Prettier. Each app deploys as its own host (Vercel or Docker standalone) against one shared database. Server Components by default; client islands where interaction demands.

**Product rules:**
- Artists see their own enquiries plus any unassigned enquiry on any channel; replying claims it; only the assigned artist or an owner may close.
- Meta's 24-hour messaging window is enforced before send; the composer offers "email them instead".
- An unverified email sender is labelled, never filtered.
- The `enquiriesOpen` site setting closes the public funnel (API 403 + books-closed page).
- Customer-facing links use the public site origin; staff links use the admin origin.

**Explicitly undecided / deferred (do not assume built):** a `Service` model for the "5 services" studio fact; real consult-slot availability on the public Enquire step (currently a deterministic placeholder); Google Calendar two-way sync; DB-backed email-template editing; front-desk presence persistence beyond the day; calendar drag-resize and chair columns; loyalty reward redemption model; sign-out-everywhere.

## Brand Commitments

- **Name:** Boots 'n' Bandit (straight apostrophes in code, typographic in copy where the design does so). Tagline lockup "Boots 'n' Bandit / TATTOO STUDIO".
- **Mark:** crimson 8-point star/compass on warm black. Logo raster at `bb-logo.png` (root) and `apps/web/public/bb-logo.png`; PWA icons under each app's `public/icons`.
- **Visual authority:** the imported prototype in `design-src/` (`styles.css` tokens, `styles-pages.css`, `COMPOSITION-NOTES.md`) is the binding reference for the public site. The brief pins the **heritage** direction as the public default (grit / noir exist as `[data-direction]` variants), Pirata One + Cinzel display faces with Inter standing in for the unlicensed Termina, and the crimson / gold / teal on warm-black palette. Admin and reception use a calmer, denser subset of the same tokens. These are recorded here as binding constraints; DESIGN.md will document the world itself.
- **Voice:** warm, plain, Nottinghamshire; confident without swagger; never clinical, never salesy. Reassuring to first-timers ("no daft questions"), matter-of-fact about hygiene and licensing.
- **Accessibility floor the user mandated:** 44px touch targets, 4.5:1 contrast, visible focus rings, 150–300ms transitions, reduced-motion respected, responsive at 375 / 768 / 1024 / 1440.

## Evidence on Hand

- **Real:** studio name, address, opening hours, council licence, Facebook page id. Seed content in `design-src/data.jsx` (7 artists, 26 gallery pieces, 9 flash, 5 services, 7 FAQs, 9 styles, 10 placements) and the aftercare stages, Inkling matcher weights, and Bandit Pass perks ladder in `COMPOSITION-NOTES.md`.
- **Not confirmed during init (the Evidence question was left unanswered); treat as prototype placeholder until the owner confirms:**
  - whether the seven named artists (Sarah, Cal, Marnie, …) are real people or prototype personas;
  - whether real gallery / flash photographs have been uploaded (the brief says binary images were never imported and procedural `Plate` placeholders stand in);
  - the review figures ("4.9 from 380+ reviews") and the home stats ("10+ years", "12k+ pieces");
  - the studio history ("Est. 2016", two founders above a barber's) and the sample reviews (Hannah M., Dec R., Priya K.).
- **Known placeholder:** phone number `01909 000 000`; the public Enquire consult slots.
- **No customer data yet:** the product is pre-launch; no real bookings, customers, or enquiries exist. Do not fabricate testimonials, counts, or case studies.

## Product Principles

1. **One customer, one thread.** Every channel and every surface writes to the same customer timeline; never create a side-channel that the CRM cannot see.
2. **The desk is the moment of truth.** Check-in, consent, amount confirmed, receipt sent: the in-studio flow must be completable in a few taps on a shared tablet by whoever is standing there.
3. **Own the tools, not the rent.** Anything Fresha or getink did, this does, with the studio's data in its own database and no per-booking fee.
4. **First-timers are the audience.** Every public path assumes the visitor has never been tattooed and does not know the vocabulary; Inkling, aftercare, and "no daft questions" exist for them.
5. **Say only what is true.** Pre-launch means no invented social proof; the site's numbers and names must come from the CMS and the database, not the prototype.

## Accessibility & Inclusion

WCAG-aligned floor set by the owner: 44px minimum touch targets on every surface (the kiosk and phones especially), 4.5:1 text contrast on the dark heritage palette, visible `:focus-visible` rings in all apps, `prefers-reduced-motion` respected, charts with legends, tooltips, accessible colours, and a table alternative. The kiosk disables pinch-zoom, so its type and targets must be legible at arm's length without it.

## Stage

Pre-launch, still building (confirmed 2026-09-08). No studio staff are on the system yet; Fresha / getink are still in use. Go-live is ahead.
