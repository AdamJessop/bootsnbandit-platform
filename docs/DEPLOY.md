# Deploying to Coolify

The whole stack (web, admin, reception, migrations, cron) deploys from
`docker-compose.prod.yml` as a single Coolify resource. Postgres runs as a
separate Coolify-managed database. Images are domain-agnostic — every origin
comes from env vars.

## One-time setup

1. **Postgres** — in Coolify, create a PostgreSQL database resource. Copy its
   *internal* connection URL and append `?schema=public`; this becomes
   `DATABASE_URL`. Configure backups on this resource (Coolify UI).
2. **Compose resource** — create a new resource → Docker Compose → point at
   this repository, branch `main`, compose file `docker-compose.prod.yml`.
3. **Environment variables** — copy every variable from
   `.env.production.example` into the resource's Environment Variables and
   fill in real values. Constraints:
   - `SESSION_SECRET` min 32 chars (`openssl rand -base64 48`).
   - `RP_ID` must be the registrable parent domain shared by the admin and
     reception origins. **Changing it later invalidates all staff passkeys.**
   - `WEB_ORIGIN` / `ADMIN_ORIGIN` / `RECEPTION_ORIGIN` must exactly match
     the domains you assign in step 4 (https, no trailing slash).
   - `BRAVE_SEARCH_KEY` (optional) — Brave Search API key for the Inkling
     mood-board image search: sign up at api-dashboard.search.brave.com,
     subscribe to the *Data for Search* plan (includes the images endpoint;
     2,000 free queries/month, then ~$5 per 1,000) and create a key. Without
     it the builder shows studio-gallery matches + uploads only.
     `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` are still read as a legacy fallback,
     but Google no longer grants new projects access to the Custom Search
     JSON API (new projects get `PERMISSION_DENIED`).
   - `INBOUND_EMAIL_DOMAIN` / `RESEND_WEBHOOK_SECRET` (optional, admin only) —
     the two-way email channel. Without them the enquiry inbox still sends
     (from `EMAIL_FROM`) but cannot receive: `/api/webhooks/resend` answers
     503 and replies carry no reply token. Setup, DNS records and the smoke
     test are in `docs/CHANNELS.md`; live status is in Studio › Channels.
4. **Domains** — in the resource's service list, assign a domain to each app
   service with its container port: `web` → your apex/www domain, port 3000;
   `admin` → admin subdomain, port 3001; `reception` → reception subdomain,
   port 3002. `migrate` and `cron` get no domain. Coolify's Traefik proxy
   terminates TLS and routes to the container ports.
5. **Deploy.** Order per deploy: `migrate` runs `prisma migrate deploy` and
   must exit 0 before the apps start; the `cron` sidecar starts once admin is
   healthy and immediately fires its first `POST /api/cron/run`, then
   repeats every `CRON_INTERVAL_SECONDS` (default hourly).

## Before deploying the enquiry-threads release (2026-09-07)

This release makes `Customer.email` and `Customer.phone` **unique** (migration
`20260907140000_customer_contact_unique`). Duplicates must be merged *before*
the deploy, in this order.

1. **Know what happens if you skip this.** `prisma migrate deploy` fails loudly
   when the index cannot be built, the `migrate` service exits non-zero, and
   the deploy aborts — the previous containers keep serving. Nothing is
   silently dropped, but the release does not land until the data is clean.

2. **Merge the duplicates from a local checkout**, not from the server: the
   `scripts/` directory is not in the migrate image, so the merge cannot run
   there at all. Use the same pattern as `npm run admin:link` — a checkout
   whose `.env` points `DATABASE_URL` at the **production** database — and
   then, in order:

   ```bash
   npm run customers:merge              # DRY RUN — reports, writes nothing
   ```

   - **Review every group it prints.** Pay particular attention to any group
     matched on a `phone-raw:` key: those are phone numbers that could not be
     parsed to E.164 and were matched on the raw string, so they are the ones
     most likely to fuse two different people. If a group looks wrong, fix the
     underlying rows by hand first and re-run the dry run.
   - **Stop the `web`, `admin` and `reception` services.** Rows created while
     the merge runs are not merged, and a lead that arrives mid-run would fail
     the migration anyway.

   ```bash
   npm run customers:merge -- --apply   # irreversible: deletes duplicate rows
   npm run customers:merge              # dry run again — confirm `groups=0`
   ```

   Only when the re-run reports `groups=0` is the database ready.

3. **Deploy** as normal (the `migrate` service runs the new migrations, then
   the apps start again).

**Recovery — someone deployed first and the migration failed.** The migration
is recorded as failed, so Prisma refuses to move on until it is resolved:

```bash
npx prisma migrate resolve --rolled-back 20260907140000_customer_contact_unique \
  --schema=packages/core/prisma/schema.prisma
```

Run that from the same local checkout (pointed at production), then do step 2
above and redeploy.

## One-off operations

Run from the Coolify terminal on the server (or SSH), in the compose
project directory: these `docker compose ... run` commands must be executed
from Coolify's generated project directory (where its env file lives) so
`DATABASE_URL` interpolates correctly — or pass it explicitly with
`-e DATABASE_URL=...`.

- **Seed the database** (optional, first boot only):
  `docker compose -f docker-compose.prod.yml run --rm migrate npx tsx prisma/seed.ts`
- **Enrol the first admin passkey**: run `npm run admin:link` from a checkout
  with `.env` pointing `DATABASE_URL` at the production DB and `APP_ORIGIN`
  at the admin origin, then open the printed enrolment URL.
- **Merge duplicate customers** (`npm run customers:merge`) — a one-off that
  must run before the 2026-09-07 enquiry-threads release; see *Before deploying
  the enquiry-threads release* above for the full order of operations.

## Local smoke test (before touching Coolify)

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml \
  --env-file local-test.env up --build -d
for p in 3000 3001 3002; do curl -fsS http://localhost:$p/api/health; echo; done
docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml \
  --env-file local-test.env down -v
```

The smoke stack runs under its own compose project name `bnb-smoke` (configured
in `docker-compose.local-test.yml`), so it cannot collide with the dev Postgres stack.

## Operational notes

- App healthchecks hit `/api/health`, which never touches the DB — a DB
  outage degrades requests but does not restart-loop containers.
- A failed migration aborts the deploy (apps never start on an unmigrated
  schema); the previous containers keep serving.
- Cron jobs are idempotent; a failed tick logs and retries next interval.
- The public web app's marketing pages render dynamically (SSR) via
  `force-dynamic`, so they always reflect current DB content without relying
  on build-time prerendering.
- The dev database in `docker-compose.yml` is untouched by all of this.
- On first deploy, verify Coolify's UI doesn't report the stack degraded due
  to the intentionally-exited one-shot `migrate` service; if it does,
  exclude `migrate` from health status in Coolify's settings.
- Inbound email (`POST /api/webhooks/resend`) answers 200 for processing
  failures on purpose — Resend retries 5xx, which would storm the endpoint
  with the same broken event. Failures are stored and replayable from
  Studio › Channels.
