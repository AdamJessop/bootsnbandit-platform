# Back-of-House Admin — Information Architecture & Screen Inventory

> Scoping output (ui-ux-pro-max). The staff PWA at `(admin)`. Dark heritage theme, denser than the public site, shadcn/ui. Primary device: tablet/desktop at the studio + artist phones. All touch targets ≥44px, contrast ≥4.5:1, focus rings, 150–300ms transitions, reduced-motion respected.

## Navigation model

- **Desktop/tablet (≥1024px):** persistent left **sidebar** (primary nav) + top bar (studio/date switch, front-desk button, search, profile/role badge, install-PWA prompt). Sidebar items adapt by role.
- **Mobile (<1024px):** bottom nav (max 5: Today, Calendar, Front Desk, CRM, More) + top bar. Secondary items under "More".
- Active location highlighted (color + weight + indicator). Owner-only items badged with a small crest; hidden for artists.

### Sidebar (OWNER sees all; ARTIST sees ⟨self-scoped⟩)

1. **Today / Dashboard** — at-a-glance day.
2. **Calendar** — own (artist) / any-artist switch (owner + front desk).
3. **Front Desk** — in-studio board + instant artist calendar.
4. **Enquiries** — inbound leads → triage → convert to booking.
5. **Bookings** — list/search all appointments (consult/session), statuses.
6. **Customers (CRM)** — directory + per-customer timeline.
7. **Sessions & Receipts** — complete sessions, confirm amount, receipts.
8. **Availability & Leave** — working hours + annual leave/unavailability.
9. **Reports** — bookings, capacity, revenue (owner: all; artist: self).
10. **Content** (owner) — Gallery, Flash, Artists, Styles, Aftercare stages, FAQ, Loyalty (Bandit Pass), Site settings.
11. **Studio** (owner) — staff/users, chairs/resources, opening hours, email templates, integrations (iCal/Google).
12. **My Profile** — own artist profile + portfolio, passkeys, calendar feed URL.

## Key screens (inventory)

### A. Auth
- **A1 Sign in** — email field → passkey (WebAuthn) prompt. "Add this device" for new passkeys. No passwords.
- **A2 Passkey enrolment** — register/manage passkeys (owner can invite staff; first-login enrolment).
- **A3 PWA install** — installable; offline shell for read-only (today/calendar/customer views).

### B. Today / Dashboard
- **B1 Today (artist):** next appointment, today's column (mini-calendar), enquiries awaiting reply, sessions to complete, leave reminder.
- **B1' Today (owner):** studio-wide KPIs (today's bookings, chairs utilised, revenue MTD, new enquiries), per-artist strip, alerts (unconfirmed, overdue follow-ups).

### C. Calendar (replaces Fresha/getink scheduling)
- **C1 Day view** — vertical time grid (10–18, Tue–Sat), columns = chairs or single artist; blocks = consult/session; drag to move/resize; click empty slot → new booking. Status colours.
- **C2 Week view** — 7-day overview, compact blocks, leave/closed days shaded.
- **C3 Booking drawer/modal** — create/edit: customer (search or new), artist, type (consult/session/flash), style, placement, duration, price estimate, deposit flag, notes, status (enquiry→pending→confirmed→completed→cancelled/no-show), reminders toggle. "Add to my calendar feed" info.
- **C4 Artist switcher** — owner/front-desk: instant dropdown/tabs to view any artist's calendar.
- **C5 Calendar feed/sync** — per-artist iCal subscribe URL; Google Calendar connect (later); shows external busy times.

### D. Front Desk mode
- **D1 In-studio board** — cards of who's believed in today: each artist (present/away toggle) with their current/next client and chair. Walk-in friendly.
- **D2 Quick-add** — pick any artist (present or not) → their calendar opens → add consultation/session in 2 taps.
- **D3 Presence** — mark artist/client arrived/left; drives the board + "in studio" list.

### E. Enquiries (inbound, from public Enquire + Flash claim)
- **E1 Enquiry inbox** — list (new/replied/converted/closed), filter by artist/style. Shows idea, placement, size, budget, mood-board images, preferred artist.
- **E2 Enquiry detail** — full brief, message thread, assign artist, reply (emails customer), convert → booking (opens C3), or decline.

### F. Customers / CRM
- **F1 Directory** — search, tags, loyalty tier, last/next visit, lifetime value.
- **F2 Customer timeline** — unified history: enquiries, bookings, sessions, **emails sent** (confirmation, reminder, receipt, aftercare, review request) with status, notes, consent/marketing prefs, loyalty stamps, documents (ID/consent forms). Manual "send email" + see automated ones.

### G. Sessions & Receipts (the in-studio "work done" flow)
- **G1 Today's sessions** — sessions in progress / to complete.
- **G2 Complete session** — select session → **confirm amount charged** (bank transfer ref optional) + tip/deposit applied → on confirm: mark completed, **generate receipt email** + **aftercare email** (with aftercare-stage link), schedule **review request** follow-up, award loyalty stamp. Single primary CTA.
- **G3 Receipt record** — view/resend receipt; revenue feeds reports.

### H. Availability & Leave
- **H1 Working hours** — per-artist weekly pattern within studio hours.
- **H2 Leave / unavailability** — declare days off (annual leave, training, sick); marks artist unavailable, blocks calendar, removes from front-desk "in today", reflected in public booking availability. Owner can approve/see all.

### I. Reports
- **I1 Overview** — date range; bookings count, capacity/utilisation %, revenue; per-artist breakdown (owner) or self (artist). Charts: revenue trend (line), bookings by status (bar), capacity by artist (bar), style mix (donut ≤5). CSV export. (chart rules: legends, tooltips, empty/loading states, accessible colours, table alt.)

### J. Content management (owner) — everything the public site renders
- **J1 Gallery** — CRUD pieces (image upload, title, artist, style, placement, featured/big). Drag reorder.
- **J2 Flash** — CRUD designs (image, artist, size, price, total/claimed, deadline); claim tracking ties to enquiries.
- **J3 Artists** — CRUD profiles (name, role, styles, bio, rates, insta, books open/limited/closed, headshot, specials, portfolio links).
- **J4 Styles** — manage the 9 tattoo styles list.
- **J5 Aftercare stages** — ordered aftercare advice stages (the link emailed post-session); CRUD + order.
- **J6 FAQ** — CRUD Q&A, order.
- **J7 Loyalty (Bandit Pass)** — configure scheme: stamps per visit/spend, reward thresholds, expiry, messaging.
- **J8 Site settings** — studio details, hours, ticker lines, social links, opening-enquiries toggle, visual direction.

### K. Studio admin (owner)
- **K1 Staff/users** — invite staff, set role (artist/owner), enable/disable, manage their passkeys.
- **K2 Resources** — chairs/stations, capacity for utilisation calc.
- **K3 Email templates** — edit transactional templates (confirmation/reminder/receipt/aftercare/review) + sender identity.
- **K4 Integrations** — iCal feed management, Google Calendar (later), Resend status.

### L. My Profile (all staff)
- **L1 Profile & portfolio** — edit own public profile + gallery links (artists).
- **L2 Security** — manage passkeys/devices, sign-out everywhere.
- **L3 My calendar feed** — personal iCal subscribe URL, Google connect.

## CRM automation lifecycle (the "every step" relationship)

enquiry received → auto-ack email · booking confirmed → **confirmation** email · T-48h/T-24h → **reminder** email · session completed → **receipt** + **aftercare** email (aftercare-stage link) · T+3–5d → **review request** email · loyalty thresholds → reward email. All automations: scheduled jobs (cron) reading booking/session state; every send logged to the customer timeline (F2); per-customer marketing consent respected.

## Component kit (shadcn + heritage tokens)

AppShell (sidebar+topbar+bottomnav), DataTable (sortable, filter, CSV), CalendarGrid (day/week, drag), BookingDrawer, CustomerTimeline, StatCard/KPI, Chart wrappers, ImageUploader (gallery/flash/headshots), EntityForm patterns, StatusBadge (open/limited/closed; enquiry→…→completed), EmptyState, Confirm dialogs (destructive), Toast (aria-live), RoleGate (owner-only), PresenceToggle, AmountConfirm (currency, tabular figures).
