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
4. **Domains** — in the resource's service list, assign a domain to each app
   service with its container port: `web` → your apex/www domain, port 3000;
   `admin` → admin subdomain, port 3001; `reception` → reception subdomain,
   port 3002. `migrate` and `cron` get no domain. Coolify's Traefik proxy
   terminates TLS and routes to the container ports.
5. **Deploy.** Order per deploy: `migrate` runs `prisma migrate deploy` and
   must exit 0 before the apps start; the `cron` sidecar starts once admin is
   healthy and immediately fires its first `POST /api/cron/run`, then
   repeats every `CRON_INTERVAL_SECONDS` (default hourly).

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
