# Enquiries Omnichannel Inbox + CRM Identity — Design Spec

**Date:** 2026-09-07
**Status:** Approved for planning (user answered the 8 scoping questions below; remaining calls made by Claude and flagged)

## Goal

Turn the admin **Enquiries** section into a support-ticket style inbox that
receives and sends messages across **web forms, email, Facebook Messenger and
Instagram DMs**, threads every message into the enquiry's log, routes
unassigned enquiries to all artists and assigned ones to the assigned artist
(owners see everything with an assigned-artist pill), and binds every enquiry
to a single CRM customer record whose email and phone are unique.

## User decisions (2026-09-07)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Inbound email | **Resend inbound webhook** (dedicated subdomain, MX → Resend) |
| 2 | Facebook / Instagram depth | **Full two-way via Meta APIs** (Messenger Platform + Instagram Messaging, webhooks in, Graph API out) |
| 3 | Threading of inbound messages | **Token match → same customer's most recent non-closed enquiry active in last 30 days → new enquiry** |
| 4 | Existing duplicate customers | **Migrate and auto-merge** into the oldest record, then add unique constraints |
| 5 | Meta prerequisites | Studio has a Facebook Page + Instagram professional account, **no developer app yet** → ship behind env vars + full setup runbook |
| 6 | Outbound email identity | **Studio address with the artist's name** (`"Sarah at Boots 'n' Bandit" <enquiries@mail.<domain>>`), Reply-To carries the per-enquiry token |
| 7 | Attachments | **Store images in Postgres** (generalised asset store), non-images as download links |
| 8 | Notifications | **In-app badge only** (unread counts in nav + inbox), no emails |

## Current state (verified in code)

- `Enquiry` (`packages/core/prisma/schema.prisma`) has `customerId?`, contact
  fields, `preferredArtistId?`, brief fields, `moodboard[]`, `moodboardData`,
  `status: new|replied|converted|closed`, `source: web|flash|inkling`.
- `MessageLog` is **outbound-only** (`type: MessageType`, `channel: email|sms`,
  `status`, `subject`, `body`, `customerId?`, `relatedBookingId?`); written by
  `sendEmail` (`packages/core/src/email/index.ts`) and shown as a flat "Message
  history" in the enquiry dialog via `buildThreadMap`.
- `Customer.email` / `Customer.phone` are nullable, **indexed but not unique**;
  `upsertCustomerByContact` (`services/customers.ts`) finds by exact email or
  phone and never mutates an existing match (contact-takeover guard).
- Admin inbox: `apps/admin/src/app/(staff)/enquiries/` — `page.tsx` (owner sees
  all; artist sees own + unassigned Inkling boards via `artistInboxWhere`),
  `EnquiryInbox.tsx` (status tabs, artist/style/source filters, detail dialog
  with reply/assign/claim/convert/close), `actions.ts` (server actions with
  `canAccessEnquiry` scope, race-safe claim), `EnquiryDetailSections.tsx`.
- `CustomerTimeline` component already renders enquiries/bookings/emails on the
  customer page (`apps/admin/src/app/(staff)/customers/[id]`).
- Email: Resend v6 (`resend` package), outbound only; `EMAIL_FROM` env.
- Mood-board uploads live in `MoodboardAsset` (bytes in Postgres) served by
  web `/api/inkling/assets/[id]`.
- Cron: `runAllCron` in `packages/core/src/cron`, hit hourly by the compose
  sidecar via admin `/api/cron/run`.

## Architecture

### 1. Data model (additive migration + one data migration)

```prisma
enum EnquiryChannel { web flash inkling email messenger instagram }
enum EnquiryStatus  { new replied customer_replied converted closed }   // +customer_replied
enum MessageDirection { inbound outbound internal }
enum MessageChannelKind { web email messenger instagram note }

model Enquiry {
  ...existing...
  channel        EnquiryChannel @default(web)   // originating channel
  subject        String?
  threadToken    String   @unique @default(cuid())  // reply-address + webhook correlation
  lastMessageAt  DateTime?
  lastInboundAt  DateTime?
  assignedAt     DateTime?
  messages       EnquiryMessage[]
  reads          EnquiryRead[]
}

model EnquiryMessage {
  id            String   @id @default(cuid())
  enquiryId     String
  customerId    String?
  direction     MessageDirection
  channel       MessageChannelKind
  authorUserId  String?          // staff author for outbound/internal
  fromName      String?
  fromAddress   String?          // email address / PSID / IGSID
  subject       String?
  bodyText      String
  bodyHtml      String?
  externalId    String?  @unique // Resend email id / Meta mid — idempotency
  deliveryStatus MessageStatus @default(logged)
  createdAt     DateTime @default(now())
  attachments   Attachment[]
  @@index([enquiryId, createdAt])
}

model Attachment {                 // generalised from MoodboardAsset
  id         String  @id @default(cuid())
  messageId  String?
  mime       String
  size       Int
  filename   String?
  bytes      Bytes?               // images ≤ 8 MB stored inline
  url        String?              // non-image / oversize: source link only
  createdAt  DateTime @default(now())
  @@index([messageId])
}

model EnquiryRead { enquiryId String; userId String; readAt DateTime; @@id([enquiryId, userId]) }

model CustomerIdentity {           // Meta users have no email/phone
  id         String @id @default(cuid())
  customerId String
  channel    MessageChannelKind   // messenger | instagram
  externalId String               // PSID / IGSID
  displayName String?
  @@unique([channel, externalId])
}

model ChannelConnection {          // one row per connected Page / IG account
  id           String @id @default(cuid())
  channel      MessageChannelKind
  externalId   String @unique      // page id / ig business account id
  name         String
  accessToken  String              // encrypted at rest with SESSION_SECRET-derived key
  active       Boolean @default(true)
  connectedAt  DateTime @default(now())
}

model Customer {
  email String? @unique   // normalised lowercase
  phone String? @unique   // normalised E.164 (default region GB)
  identities CustomerIdentity[]
}
```

`MessageLog` stays for non-enquiry transactional email (reminders, receipts).
`sendEmail` gains an optional `enquiryId`; when present it also writes an
`EnquiryMessage(outbound, email)`.

**Data migration (`scripts/merge-duplicate-customers.ts`, run once by the
`migrate` step before adding the unique indexes):** normalise every email and
phone; group by normalised value; keep the oldest customer per group; re-point
`Enquiry`, `Booking`, `MessageLog`, `Review`, `CustomerPasswordToken`,
`Session`; sum `loyaltyStamps`, max `loyaltyTier`, union `tags`, concatenate
`notes`, OR `marketingConsent`; delete the duplicates; then the schema
migration adds the unique indexes. Idempotent and logged.

### 2. Core services (`packages/core/src/services`)

- `contact-identity.ts` — `normaliseEmail`, `normalisePhone` (libphonenumber-js,
  GB default), `findOrCreateCustomer({ email?, phone?, name?, identity? })` with
  the existing no-mutation guard, plus `linkIdentity(customerId, channel, externalId)`.
- `enquiry-threading.ts` — pure `resolveThread(input)` implementing decision 3:
  token → recent open/replied/customer_replied enquiry of the same customer
  active in the last 30 days → new enquiry (`channel` = inbound channel,
  `contactName` from sender). Reopening closed enquiries is **not** done; a
  closed thread gets a new enquiry linked to the same customer.
- `enquiry-messages.ts` — `recordInbound`, `recordOutbound`, `recordNote`,
  `listThread(enquiryId)`, `markRead(enquiryId, userId)`,
  `unreadCountsFor(user)`; every inbound sets `status = customer_replied` when
  it was `replied`, leaves `new` as is, bumps `lastMessageAt/lastInboundAt`.
- `channels/email.ts` — `parseResendInbound(payload)` → normalised inbound
  message (+ attachment fetch via Resend API), `sendEnquiryEmail(enquiry,
  staffUser, body)` (From display name = artist first name + studio, Reply-To
  `enq-<threadToken>@<INBOUND_DOMAIN>`, `In-Reply-To` of last inbound id).
- `channels/meta.ts` — `verifyWebhookSignature(appSecret, raw, header)`,
  `parseMetaWebhook(body)` (Messenger `messaging` + Instagram `messaging`
  events; text, attachments, echoes of staff replies made in the Meta inbox),
  `sendMetaMessage(connection, recipientId, text)` (Graph API
  `/<page-id>/messages`, 24-hour messaging window honoured; outside it the send
  fails with a friendly error), `fetchProfile(psid)` for display name.
- `assets.ts` — `storeAttachment({ bytes, mime, filename })`,
  `getAttachment(id)`; `MoodboardAsset` is left as is (no churn) but the web
  asset route pattern is reused for `/api/attachments/[id]` on the **admin**
  origin (staff-gated).
- Crypto helper `secrets.ts` — AES-GCM encrypt/decrypt with an HKDF key derived
  from `SESSION_SECRET` for `ChannelConnection.accessToken`.

### 3. Inbound endpoints (admin app, unauthenticated but verified)

| Route | Verification | Work |
| --- | --- | --- |
| `POST /api/webhooks/resend` | Svix signature (`RESEND_WEBHOOK_SECRET`) | `email.received` → fetch full email via Resend API → `parseResendInbound` → `findOrCreateCustomer` → `resolveThread` → `recordInbound` (+attachments). Idempotent on `externalId`. |
| `GET/POST /api/webhooks/meta` | GET: hub.challenge with `META_VERIFY_TOKEN`; POST: `X-Hub-Signature-256` HMAC with `META_APP_SECRET` | Iterate entries; skip our own echoes unless they carry a `mid` we have not stored (staff replied from the Meta inbox → record as outbound); map PSID/IGSID → customer via `CustomerIdentity` (create customer with display name from profile fetch); `resolveThread`; `recordInbound`. Always 200 quickly; work is sequential per event. |

Rate limits are unnecessary for signed webhooks; unsigned requests get 401.

### 4. Outbound / staff actions (admin server actions)

- `replyToEnquiry(enquiryId, { body })` picks the channel of the **last inbound
  message** (email → `sendEnquiryEmail`; messenger/instagram →
  `sendMetaMessage`; web/no inbound → email if the customer has one, else
  internal note with a "no reachable channel" notice). Records
  `EnquiryMessage(outbound)`, sets `status = replied`, claims if open (kept).
- `addInternalNote(enquiryId, body)` — `direction = internal`, never sent.
- `assignEnquiry` (owner: anyone; artist: self), `claimEnquiry`, `closeEnquiry`
  (artists may close only enquiries assigned to them — fixes the open-board
  close gap noted in the mood-board review), `convertEnquiry` unchanged.
- `markEnquiryRead` on dialog open.

### 5. Visibility rules

- **Owner:** all enquiries; each row shows an **assigned-artist pill** (or
  "Unassigned").
- **Artist:** enquiries where `preferredArtistId = me` **plus** all
  `preferredArtistId = null` (any channel — generalises the Inkling-only rule),
  the latter flagged **Unassigned** and offering **Take this**.
- Once assigned, the enquiry leaves other artists' lists; reassignment is
  owner-only.

### 6. Admin UI (`apps/admin/src/app/(staff)/enquiries`)

Split the 445-line `EnquiryInbox.tsx` into: `InboxFilters.tsx`,
`EnquiryList.tsx` (rows: customer, channel icon, subject/preview, assigned
pill, unread dot, last activity), `EnquiryThread.tsx` (chronological bubbles:
inbound left, outbound right, internal notes muted, attachments inline,
channel + timestamp per message), `ReplyComposer.tsx` (channel indicator,
reply / note toggle, 24-hour-window warning for Meta), `EnquiryMeta.tsx`
(brief fields, mood-board sections, customer link, assign/claim/close/convert).
Status tabs become: **New**, **Customer replied**, **Replied**, **Converted**,
**Closed**. Nav shows an unread badge (`unreadCountsFor(user)` from the staff
layout, refreshed with `router.refresh()` polling every 60 s like the kiosk).

Customer page: `CustomerTimeline` gains inbound/outbound message entries and
identity chips (email, phone, Messenger, Instagram); enquiry rows link to the
inbox with the enquiry pre-opened (`/enquiries?open=<id>`).

Studio settings: **Channels** panel (owner) showing Resend inbound address and
webhook status, Meta connection status, "Connect Facebook Page" (OAuth flow
via Facebook Login for Business → stores `ChannelConnection`), and a test
"send yourself a message" button.

### 7. Public web changes

`POST /api/enquiries` and `/api/flash` now go through `findOrCreateCustomer`
(normalised) and create the first `EnquiryMessage(inbound, web)` from the
description so every enquiry has a thread from birth. Inkling boards set
`channel = inkling`.

### 8. Config

| Var | Where | Purpose |
| --- | --- | --- |
| `INBOUND_EMAIL_DOMAIN` | admin, web | e.g. `mail.bootsnbandit.com` (MX → Resend; also the outbound From domain, verified in Resend) |
| `RESEND_WEBHOOK_SECRET` | admin | Svix signing secret for the inbound webhook |
| `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` | admin | Meta app + webhook verification |
| `SESSION_SECRET` (existing) | admin | key derivation for stored page tokens |

Runbook additions (`docs/CHANNELS.md`): Resend domain + inbound setup, MX
record, webhook URL; Meta app creation, Page + IG linking, permissions
(`pages_messaging`, `pages_manage_metadata`, `instagram_basic`,
`instagram_manage_messages`), business verification, app review, webhook
subscription (`messages`, `messaging_postbacks`, `message_echoes`), test-user
flow before approval.

## Error handling

- Webhook processing failures are logged with the external id and return 200
  (Resend/Meta retry otherwise storms); a `WebhookFailure` row is written so
  the Channels panel can show "3 failed events" with a retry button.
- Meta 24-hour window violations surface as a composer error suggesting email.
- Attachment over 8 MB or non-image → stored as `url` only.
- Customer merge migration runs in a transaction per duplicate group and
  prints a summary; a dry-run flag exists.

## Testing

Pure units for normalisation, threading, webhook parsing/verification, merge
planner; DB tests for `findOrCreateCustomer` uniqueness + identity linking,
`recordInbound` status transitions, visibility queries; route tests for both
webhooks with fixture payloads and bad signatures; action tests for reply
channel selection and close authorisation; render tests for thread/composer;
manual: Resend test email, Meta test user message, reply from admin, artist
vs owner views.

## Phasing (each phase is its own plan, independently shippable)

1. **Identity + threads foundation** — schema, customer merge migration,
   `EnquiryMessage`/`Attachment`/`EnquiryRead`, `findOrCreateCustomer`,
   `resolveThread`, web forms create first message, admin thread view replacing
   the flat message history, visibility generalised, close authorisation fix,
   unread badge.
2. **Email channel** — Resend inbound webhook, outbound identity + Reply-To
   token, attachments, Channels panel (email part), runbook.
3. **Meta channels** — `ChannelConnection` + token encryption, Meta webhooks
   (Messenger + Instagram), Graph API send, echo handling, Connect Page flow,
   runbook; ships dark until Meta approval.
4. **Inbox UX polish** — component split, composer UX, customer page timeline
   + identity chips, status tabs, `?open=` deep links.

## Out of scope

SMS/WhatsApp, AI drafting, SLA timers, per-artist mailboxes, email notifications
(user chose in-app only), reopening closed enquiries automatically.
