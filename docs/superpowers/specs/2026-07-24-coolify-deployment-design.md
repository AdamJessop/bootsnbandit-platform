# Coolify Deployment — Design Spec

**Date:** 2026-07-24
**Status:** Approved (design), pending implementation

## Goal

Host the entire bootsnbandit stack — the public web app, staff admin PWA, and
reception kiosk PWA — on Coolify from a single production docker-compose file.
Postgres runs as a separate Coolify-managed database resource (for its backup
tooling); everything else is self-contained in the compose stack.

## Context

- npm-workspaces monorepo: `apps/web` (:3000), `apps/admin` (:3001),
  `apps/reception` (:3002), all Next.js 15.5 / React 19 / Node 22.
- Shared `packages/core` (`@bnb/core`) ships TypeScript source consumed via
  `transpilePackages`; it owns the Prisma 7 schema, migrations (real
  `prisma/migrations/` history exists, so `prisma migrate deploy` is usable),
  services, auth (WebAuthn passkeys + session cookies), and Resend email.
- `@bnb/core` has a `postinstall` hook running `prisma generate`, so the
  schema must be present before `npm ci`.
- Each app already sets `outputFileTracingRoot` to the monorepo root (required
  for standalone output tracing across workspaces).
- The admin app exposes `/api/cron/run` (guarded by `CRON_SECRET`) which runs
  idempotent CRM automations (reminders, review requests, loyalty rewards) and
  needs an external scheduler.
- The existing root `docker-compose.yml` is a dev-only Postgres (host port
  5435) and must keep working unchanged.

## Decisions (made during brainstorming)

1. **Database:** Coolify-managed Postgres resource, NOT in the compose stack.
   The stack connects via `DATABASE_URL`.
2. **Domains:** not decided yet — everything is domain-agnostic via env vars
   set in Coolify. No hostnames hardcoded anywhere.
3. **Cron:** an alpine+curl sidecar service inside the compose stack calls the
   admin cron endpoint on an interval. Self-contained; no Coolify scheduled
   task config needed.
4. **Images:** ONE multi-stage `Dockerfile` at the repo root with a target per
   app (plus a `migrate` target). Not per-app Dockerfiles, not a single
   all-in-one container.

## Architecture

### Dockerfile (repo root, multi-stage)

- `base` — `node:22-alpine`.
- `deps` — copy root + workspace `package.json`s, lockfile, and
  `packages/core/prisma/` (schema needed by the postinstall
  `prisma generate`), then `npm ci`.
- `build-web` / `build-admin` / `build-reception` — copy full source over
  `deps`, run `npm run build -w @bnb/<app>` with `output: "standalone"`
  enabled. Because `outputFileTracingRoot` is the monorepo root, the
  standalone output lands at `apps/<app>/.next/standalone/` containing the
  whole traced monorepo layout with `apps/<app>/server.js` as the entrypoint.
- `web` / `admin` / `reception` (runtime targets) — `node:22-alpine`,
  non-root `nextjs` user, copy the app's `.next/standalone` tree plus
  `apps/<app>/.next/static` and `apps/<app>/public`; env
  `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=<app port>`;
  `CMD ["node", "apps/<app>/server.js"]`.
- `migrate` (runtime target) — minimal image containing the Prisma CLI,
  `packages/core/prisma/schema.prisma`, and `prisma/migrations/`;
  `CMD prisma migrate deploy`.

A `.dockerignore` excludes `node_modules`, `.next`, `.git`, docs, etc.

### Code changes

- Add `output: "standalone"` to all three `next.config.ts` files (no dev
  impact; `next dev` ignores it).
- Add a minimal `GET /api/health` route to each app returning `200 {"ok":true}`
  with **no database access** — used by container healthchecks so a DB blip
  doesn't flap the containers.

### docker-compose.prod.yml (new file; dev compose untouched)

Coolify is pointed at this filename (its compose-file path is configurable).
Services:

| Service     | Build target | Port | Notes                                            |
| ----------- | ------------ | ---- | ------------------------------------------------ |
| `migrate`   | `migrate`    | —    | `restart: "no"`; runs `prisma migrate deploy`    |
| `web`       | `web`        | 3000 | `depends_on: migrate: service_completed_successfully` |
| `admin`     | `admin`      | 3001 | same                                             |
| `reception` | `reception`  | 3002 | same                                             |
| `cron`      | `alpine/curl` image | — | `depends_on: admin: service_healthy`; loop: curl admin cron endpoint, sleep |

- **No host port bindings** on app services — Coolify's Traefik proxy routes
  each service to the domain assigned to it in the Coolify UI. Ports are
  `expose`d only.
- App healthchecks: `wget -qO- http://127.0.0.1:<port>/api/health`.
- Cron sidecar loop:
  `curl -fsS -H "x-cron-secret: $CRON_SECRET" http://admin:3001/api/cron/run`
  every `CRON_INTERVAL_SECONDS` (default `3600`).
- If `migrate` fails, the apps never start — the deploy fails loudly instead
  of serving against an unmigrated schema.

### Environment variables (set in Coolify, referenced by compose)

Shared: `DATABASE_URL` (points at the Coolify-managed Postgres),
`SESSION_SECRET` (min 32 chars, shared across apps — HKDF derives per-audience
keys), `RESEND_API_KEY`, `CRON_SECRET`, `RP_ID`.

Origins: `WEB_ORIGIN`, `ADMIN_ORIGIN`, `RECEPTION_ORIGIN` — full https
origins. Mapped per service:

- web: `APP_ORIGIN=$WEB_ORIGIN`
- admin: `APP_ORIGIN=$ADMIN_ORIGIN`, `PUBLIC_SITE_ORIGIN=$WEB_ORIGIN`,
  `SESSION_COOKIE=bb_admin_session`, `AUTH_REDIRECT=/`, `CRON_SECRET`
- reception: `APP_ORIGIN=$RECEPTION_ORIGIN`, `PUBLIC_SITE_ORIGIN=$WEB_ORIGIN`,
  `SESSION_COOKIE=bb_reception_session`, `AUTH_REDIRECT=/`
- cron: `CRON_SECRET`, `CRON_INTERVAL_SECONDS`

A new `.env.production.example` documents every variable, including the
passkey constraints: `RP_ID` must be the registrable parent domain shared by
the admin and reception origins (e.g. `example.co.uk` for
`admin.example.co.uk` + `reception.example.co.uk`), and changing `RP_ID`
invalidates all enrolled passkeys.

### One-off operations (documented, not automated)

- Seed: one-shot run of the migrate image with the seed script, e.g.
  `docker compose -f docker-compose.prod.yml run --rm migrate npx tsx prisma/seed.ts`
  (the migrate image includes `prisma/seed.ts` and `tsx` for this purpose).
- First admin enrolment: `admin:link` script run pointed at the production
  `APP_ORIGIN` / `DATABASE_URL`.

## Error handling

- Migration failure blocks app startup (hard deploy failure, loud).
- Health endpoints are DB-free so transient DB outages don't restart-loop the
  app containers.
- Cron sidecar uses `-f` (fail on HTTP error) but the loop continues — a
  failed tick is logged, not fatal; the endpoint's automations are idempotent.

## Testing / verification

1. `docker build` each target successfully.
2. Local smoke test: run `docker-compose.prod.yml` with a small
   `docker-compose.local-test.yml` override adding a throwaway Postgres and
   local env values; verify `migrate` completes, all three health routes
   return 200, and a real page renders from each app.
3. Existing `npm run build` / `npm test` remain green (standalone flag and
   health routes are additive).

## Out of scope

- Actual Coolify server setup / DNS / choosing the domain.
- Database backup configuration (owned by the Coolify-managed DB resource).
- CI pipeline changes.
