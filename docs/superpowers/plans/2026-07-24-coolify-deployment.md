# Coolify Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the three Next.js apps (web, admin, reception) plus a migration runner and cron sidecar into one production docker-compose file deployable on Coolify against a Coolify-managed Postgres.

**Architecture:** One multi-stage Dockerfile at the repo root with a shared `deps` stage (npm ci + prisma generate), per-app build stages using Next.js `output: "standalone"`, slim per-app runtime targets, and a `migrate` target running `prisma migrate deploy`. A new `docker-compose.prod.yml` wires them together (apps gated on migration success, curl-loop cron sidecar); the existing dev `docker-compose.yml` stays untouched.

**Tech Stack:** Next.js 15.5 (standalone output), Node 22 alpine images, npm workspaces, Prisma 7 (prisma.config.ts, driver-adapter pg — no engine binaries), Docker Compose, Coolify (Traefik proxy).

**Spec:** `docs/superpowers/specs/2026-07-24-coolify-deployment-design.md`

## Global Constraints

- Node version in images: `node:22-alpine` (repo runs Node 22).
- Postgres is NOT part of the prod compose stack — it is a Coolify-managed resource reached via `DATABASE_URL`.
- No hostnames/domains hardcoded anywhere — all origins come from env vars (`WEB_ORIGIN`, `ADMIN_ORIGIN`, `RECEPTION_ORIGIN`, `RP_ID`).
- The existing root `docker-compose.yml` (dev Postgres on host port 5435) must remain byte-for-byte unchanged.
- App ports: web 3000, admin 3001, reception 3002. No host `ports:` bindings in `docker-compose.prod.yml` (Coolify's Traefik routes by domain); `expose` only.
- Health endpoints must NOT touch the database.
- `@bnb/core`'s `postinstall` runs `prisma generate`, and `packages/core/prisma.config.ts` resolves `env("DATABASE_URL")` — so `npm ci` in Docker needs the schema + config present and a dummy `DATABASE_URL` on the RUN line (never as a persistent `ENV`).
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: DB-free health endpoints in all three apps

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/web/src/app/api/health/route.test.ts`
- Create: `apps/admin/src/app/api/health/route.ts`
- Create: `apps/admin/src/app/api/health/route.test.ts`
- Create: `apps/reception/src/app/api/health/route.ts`
- Create: `apps/reception/src/app/api/health/route.test.ts`

**Interfaces:**
- Consumes: nothing (routes are import-free by design).
- Produces: `GET /api/health` → `200 {"ok":true}` on each app. Task 4's compose healthchecks (`wget -qO- http://127.0.0.1:<port>/api/health`) and Task 5's smoke test depend on this exact path and response.

- [ ] **Step 1: Write the failing test (identical file in all three apps)**

Write this exact content to `apps/web/src/app/api/health/route.test.ts`, `apps/admin/src/app/api/health/route.test.ts`, and `apps/reception/src/app/api/health/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w @bnb/web run test -- health && npm -w @bnb/admin run test -- health && npm -w @bnb/reception run test -- health`
Expected: FAIL in each app — cannot resolve `./route` (module not found).

- [ ] **Step 3: Write the route (identical file in all three apps)**

Write this exact content to `apps/web/src/app/api/health/route.ts`, `apps/admin/src/app/api/health/route.ts`, and `apps/reception/src/app/api/health/route.ts`:

```ts
/**
 * /api/health — container liveness probe. Deliberately touches NOTHING
 * (no database, no imports): a DB outage must degrade requests, not
 * restart-loop the app container.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm -w @bnb/web run test -- health && npm -w @bnb/admin run test -- health && npm -w @bnb/reception run test -- health`
Expected: PASS (1 test per app).

- [ ] **Step 5: Run each app's full test suite to check for regressions**

Run: `npm test`
Expected: all workspaces PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/health apps/admin/src/app/api/health apps/reception/src/app/api/health
git commit -m "feat(deploy): DB-free /api/health liveness route in web, admin, reception

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Enable Next.js standalone output

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/admin/next.config.ts`
- Modify: `apps/reception/next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `next build` emits `apps/<app>/.next/standalone/` containing the traced monorepo with `apps/<app>/server.js` as entrypoint (because `outputFileTracingRoot` is the repo root). Task 3's runtime stages copy exactly these paths.

- [ ] **Step 1: Add `output: "standalone"` to all three configs**

All three `next.config.ts` files are currently identical. In each, change the `nextConfig` object to (keep the existing comments):

```ts
const nextConfig: NextConfig = {
  // Standalone output for Docker: `next build` emits .next/standalone with
  // server.js + only the traced files needed at runtime. `next dev` ignores it.
  output: "standalone",
  // @bnb/core ships TypeScript source via its exports map; Next must transpile
  // the workspace package rather than treat it as pre-compiled JS.
  transpilePackages: ["@bnb/core"],
  // File tracing must span the monorepo root so the app can trace files it
  // imports from packages/core (otherwise Next infers the app dir as root).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};
```

- [ ] **Step 2: Build one app and verify the standalone layout**

Run: `npm -w @bnb/web run build && ls apps/web/.next/standalone/apps/web/server.js apps/web/.next/standalone/node_modules apps/web/.next/static`
Expected: build succeeds; `server.js` exists at `apps/web/.next/standalone/apps/web/server.js` (monorepo-rooted layout); `standalone/node_modules` and `.next/static` directories listed.

- [ ] **Step 3: Build the other two apps**

Run: `npm -w @bnb/admin run build && npm -w @bnb/reception run build && ls apps/admin/.next/standalone/apps/admin/server.js apps/reception/.next/standalone/apps/reception/server.js`
Expected: both builds succeed and both `server.js` paths exist.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts apps/admin/next.config.ts apps/reception/next.config.ts
git commit -m "feat(deploy): enable Next standalone output for Docker runtimes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Root Dockerfile (multi-target) + .dockerignore

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`

**Interfaces:**
- Consumes: standalone output layout from Task 2; `/api/health` from Task 1.
- Produces: buildable targets `web`, `admin`, `reception` (CMD `node apps/<app>/server.js`, listening on 3000/3001/3002) and `migrate` (workdir `/app/packages/core`, CMD `npx prisma migrate deploy`; also contains `tsx` + `prisma/seed.ts` for one-off seeding). Task 4's compose services build these exact targets.

- [ ] **Step 1: Write `.dockerignore`**

```
# Dependencies + build output (rebuilt inside the image)
node_modules
**/node_modules
.next
**/.next
**/tsconfig.tsbuildinfo

# VCS / env / local state — env vars come from compose, never baked in
.git
.env
.env.*
*.env

# Not needed in images
docs
design-src
.claude
*.md
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
# Multi-target build for the bootsnbandit monorepo.
#
#   web | admin | reception  — Next.js standalone runtimes (ports 3000/3001/3002)
#   migrate                  — one-shot `prisma migrate deploy` (+ tsx for seeding)
#
# Built by docker-compose.prod.yml; see docs/DEPLOY.md.

FROM node:22-alpine AS base
WORKDIR /app

# ---- deps: install the full workspace node_modules once ---------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/reception/package.json apps/reception/
COPY packages/core/package.json packages/core/prisma.config.ts packages/core/
COPY packages/core/prisma packages/core/prisma
# @bnb/core's postinstall runs `prisma generate`, and prisma.config.ts resolves
# env("DATABASE_URL") — provide a dummy for the install only (generate never
# connects). Deliberately NOT a persistent ENV so runtime can't inherit it.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci

# ---- build: full source over deps, one stage per app ------------------------
FROM deps AS build
COPY . .

FROM build AS build-web
RUN npm run build -w @bnb/web

FROM build AS build-admin
RUN npm run build -w @bnb/admin

FROM build AS build-reception
RUN npm run build -w @bnb/reception

# ---- runtime base: non-root user ---------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# The standalone tree is monorepo-rooted (outputFileTracingRoot), so server.js
# lives at apps/<app>/server.js and static/public assets sit beside it.

FROM runtime AS web
ENV PORT=3000
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM runtime AS admin
ENV PORT=3001
COPY --from=build-admin --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=build-admin --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build-admin --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]

FROM runtime AS reception
ENV PORT=3002
COPY --from=build-reception --chown=nextjs:nodejs /app/apps/reception/.next/standalone ./
COPY --from=build-reception --chown=nextjs:nodejs /app/apps/reception/.next/static ./apps/reception/.next/static
COPY --from=build-reception --chown=nextjs:nodejs /app/apps/reception/public ./apps/reception/public
EXPOSE 3002
CMD ["node", "apps/reception/server.js"]

# ---- migrate: one-shot `prisma migrate deploy` -------------------------------
# Based on deps (has the prisma CLI, tsx, and generated client). Full
# packages/core source included so `tsx prisma/seed.ts` works for one-off
# seeding (see docs/DEPLOY.md). DATABASE_URL must come from the environment.
FROM deps AS migrate
COPY packages/core packages/core
WORKDIR /app/packages/core
CMD ["npx", "prisma", "migrate", "deploy"]
```

- [ ] **Step 3: Build every target**

Run:
```bash
docker build --target web -t bnb-web:test . \
  && docker build --target admin -t bnb-admin:test . \
  && docker build --target reception -t bnb-reception:test . \
  && docker build --target migrate -t bnb-migrate:test .
```
Expected: all four builds succeed (later ones mostly cache-hits).

Contingency: unlike the Task 2 local builds (where the dev DB may be running), there is NO database inside `docker build`. If a build fails because a page statically prerenders with a DB query, add `export const dynamic = "force-dynamic";` to that page (matching the pattern already used by API routes) and rebuild — do not add a DB to the build.

- [ ] **Step 4: Sanity-boot one runtime image without a DB**

Run: `docker run -d --rm --name bnb-web-smoke bnb-web:test && sleep 4 && docker exec bnb-web-smoke wget -qO- http://127.0.0.1:3000/api/health; docker rm -f bnb-web-smoke`
Expected: prints `{"ok":true}` — the app boots and the health route responds with no `DATABASE_URL` set (proves the healthcheck is DB-free).

- [ ] **Step 5: Verify migrate image fails loudly without env**

Run: `docker run --rm bnb-migrate:test; echo "exit=$?"`
Expected: non-zero exit with a Prisma error about `DATABASE_URL` not being set (the build-time dummy did NOT leak into the runtime env).

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(deploy): multi-target root Dockerfile (web/admin/reception/migrate) + .dockerignore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: docker-compose.prod.yml + .env.production.example

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.production.example`
- Modify: `.gitignore` (the `.env*` rule would ignore the new example file — add `!.env.production.example` on the line after the existing `!.env.example`)

**Interfaces:**
- Consumes: Dockerfile targets from Task 3; `/api/health` from Task 1; admin's existing `/api/cron/run` (auth: `x-cron-secret` header).
- Produces: services `migrate`, `web`, `admin`, `reception`, `cron`. Task 5 runs this file with a local override; docs in Task 6 reference the env var names verbatim.

- [ ] **Step 1: Write `docker-compose.prod.yml`**

```yaml
# Production stack for Coolify — one compose file, one Dockerfile, four targets.
#
# Postgres is NOT in this stack: it is a separate Coolify-managed database
# resource, reached via DATABASE_URL. The dev database lives in
# docker-compose.yml (unchanged). All variables are documented in
# .env.production.example and set in the Coolify UI. Coolify's Traefik proxy
# routes a domain to each app service (no host port bindings here) — assign
# the domain + container port per service in Coolify. See docs/DEPLOY.md.

services:
  # One-shot: applies pending Prisma migrations, then exits. The three apps
  # only start after it succeeds, so a failed migration fails the deploy
  # loudly instead of serving against an unmigrated schema.
  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: migrate
    restart: "no"
    environment:
      DATABASE_URL: ${DATABASE_URL}

  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: web
    restart: unless-stopped
    depends_on:
      migrate:
        condition: service_completed_successfully
    expose:
      - "3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM:-}
      APP_ORIGIN: ${WEB_ORIGIN}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s

  admin:
    build:
      context: .
      dockerfile: Dockerfile
      target: admin
    restart: unless-stopped
    depends_on:
      migrate:
        condition: service_completed_successfully
    expose:
      - "3001"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM:-}
      CRON_SECRET: ${CRON_SECRET}
      APP_ORIGIN: ${ADMIN_ORIGIN}
      PUBLIC_SITE_ORIGIN: ${WEB_ORIGIN}
      RP_ID: ${RP_ID}
      SESSION_COOKIE: bb_admin_session
      AUTH_REDIRECT: /
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s

  reception:
    build:
      context: .
      dockerfile: Dockerfile
      target: reception
    restart: unless-stopped
    depends_on:
      migrate:
        condition: service_completed_successfully
    expose:
      - "3002"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM:-}
      APP_ORIGIN: ${RECEPTION_ORIGIN}
      PUBLIC_SITE_ORIGIN: ${WEB_ORIGIN}
      RP_ID: ${RP_ID}
      SESSION_COOKIE: bb_reception_session
      AUTH_REDIRECT: /
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3002/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s

  # CRM cron scheduler: curls the admin cron endpoint on an interval. Every
  # job behind the endpoint is idempotent, so a failed tick is logged and
  # simply retried next interval — the loop never exits.
  cron:
    image: curlimages/curl:8.10.1
    restart: unless-stopped
    depends_on:
      admin:
        condition: service_healthy
    environment:
      CRON_SECRET: ${CRON_SECRET}
      CRON_INTERVAL_SECONDS: ${CRON_INTERVAL_SECONDS:-3600}
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        echo "cron sidecar: hitting admin every $${CRON_INTERVAL_SECONDS}s"
        while true; do
          sleep "$${CRON_INTERVAL_SECONDS}"
          curl -fsS -X POST -H "x-cron-secret: $${CRON_SECRET}" \
            http://admin:3001/api/cron/run \
            || echo "cron tick failed (will retry next interval)"
        done
```

- [ ] **Step 2: Write `.env.production.example`**

```bash
# Production environment for docker-compose.prod.yml — set ALL of these in the
# Coolify UI (Environment Variables of the compose resource). Nothing here is
# read at build time; images are domain-agnostic.

# Coolify-managed Postgres resource (internal connection URL). Use the
# internal hostname Coolify shows for the DB so traffic stays on the Docker
# network, e.g. postgresql://user:pass@<coolify-db-host>:5432/bootsnbandit?schema=public
DATABASE_URL=""

# Session encryption secret, min 32 chars, SHARED by all three apps (HKDF
# derives per-audience keys so staff/customer/kiosk tokens stay isolated).
# Generate: openssl rand -base64 48
SESSION_SECRET=""

# Transactional email (Resend). Optional EMAIL_FROM overrides the default
# sender ("Boots 'n' Bandit <hello@bootsnbandit.co.uk>").
RESEND_API_KEY=""
EMAIL_FROM=""

# Secret the cron sidecar presents to admin /api/cron/run.
# Generate: openssl rand -hex 32
CRON_SECRET=""
# Seconds between cron ticks (default 3600 = hourly).
CRON_INTERVAL_SECONDS="3600"

# Full https origins for the three apps — must match the domains assigned to
# each service in Coolify. WEB_ORIGIN is also where customer-facing email
# links point (PUBLIC_SITE_ORIGIN).
WEB_ORIGIN="https://example.com"
ADMIN_ORIGIN="https://admin.example.com"
RECEPTION_ORIGIN="https://reception.example.com"

# WebAuthn Relying Party ID: the REGISTRABLE PARENT DOMAIN shared by the
# admin and reception origins (e.g. "example.com" for admin.example.com +
# reception.example.com) so staff passkeys enrolled on admin also work on the
# reception kiosk. WARNING: changing RP_ID invalidates ALL enrolled passkeys.
RP_ID="example.com"
```

- [ ] **Step 2b: Un-ignore the example file**

In `.gitignore`, directly after the existing `!.env.example` line, add:

```
!.env.production.example
```

Verify: `git check-ignore .env.production.example; echo "exit=$?"` → `exit=1` (not ignored).

- [ ] **Step 3: Validate compose interpolation**

Run:
```bash
DATABASE_URL=postgresql://u:p@db:5432/x SESSION_SECRET=s RESEND_API_KEY=r \
CRON_SECRET=c WEB_ORIGIN=http://w ADMIN_ORIGIN=http://a RECEPTION_ORIGIN=http://r RP_ID=d \
docker compose -f docker-compose.prod.yml config --quiet && echo OK
```
Expected: `OK` (no interpolation warnings/errors).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml .env.production.example .gitignore
git commit -m "feat(deploy): production compose stack (migrate-gated apps + cron sidecar) and env template

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Local smoke test of the full prod stack

**Files:**
- Create: `docker-compose.local-test.yml`
- Create: `local-test.env`

**Interfaces:**
- Consumes: `docker-compose.prod.yml` (Task 4) — this override adds a throwaway Postgres and host port bindings, changing nothing else.
- Produces: a repeatable smoke-test procedure (also referenced by docs in Task 6).

- [ ] **Step 1: Write `docker-compose.local-test.yml`**

```yaml
# Local smoke-test override for docker-compose.prod.yml — adds a throwaway
# Postgres and host port bindings so the prod stack can be exercised on a dev
# box. Never used by Coolify. Usage (see docs/DEPLOY.md):
#   docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml \
#     --env-file local-test.env up --build -d

services:
  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_DB: bnb_test
      POSTGRES_USER: bnb
      POSTGRES_PASSWORD: bnb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bnb -d bnb_test"]
      interval: 5s
      timeout: 5s
      retries: 10

  migrate:
    depends_on:
      postgres-test:
        condition: service_healthy

  web:
    ports:
      - "3000:3000"

  admin:
    ports:
      - "3001:3001"

  reception:
    ports:
      - "3002:3002"
```

- [ ] **Step 2: Write `local-test.env`** (dummy values only — safe to commit)

```bash
# Throwaway values for the local prod-stack smoke test. NOT secrets.
DATABASE_URL=postgresql://bnb:bnb@postgres-test:5432/bnb_test?schema=public
SESSION_SECRET=local-test-session-secret-0123456789abcdef
RESEND_API_KEY=
EMAIL_FROM=
CRON_SECRET=local-test-cron-secret
CRON_INTERVAL_SECONDS=60
WEB_ORIGIN=http://localhost:3000
ADMIN_ORIGIN=http://localhost:3001
RECEPTION_ORIGIN=http://localhost:3002
RP_ID=localhost
```

- [ ] **Step 3: Bring the stack up**

Run: `docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file local-test.env up --build -d && docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file local-test.env ps`
Expected: `migrate` exits 0 (state `Exited (0)`); `web`, `admin`, `reception` become `healthy`; `cron` running.

- [ ] **Step 4: Verify migrations applied**

Run: `docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file local-test.env logs migrate`
Expected: Prisma output listing each migration from `packages/core/prisma/migrations/` as applied, no errors.

- [ ] **Step 5: Hit health routes and a real page on each app**

Run:
```bash
for p in 3000 3001 3002; do curl -fsS http://localhost:$p/api/health; echo " <- $p"; done
curl -s -o /dev/null -w "web / -> %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "admin / -> %{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "reception / -> %{http_code}\n" http://localhost:3002/
```
Expected: `{"ok":true}` three times; web `/` → 200; admin and reception `/` → 200 or 307 (redirect to sign-in is fine — anything but 5xx).

- [ ] **Step 6: Verify a cron tick fires and authenticates**

Run (CRON_INTERVAL_SECONDS=60 in the test env, so within ~70s): `sleep 70 && docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file local-test.env logs cron --tail 20`
Expected: at least one tick with JSON summary output from `/api/cron/run` (not `401`/`cron tick failed`).

- [ ] **Step 7: Tear down**

Run: `docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file local-test.env down -v`
Expected: containers and the throwaway Postgres volume removed.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.local-test.yml local-test.env
git commit -m "feat(deploy): local smoke-test override + throwaway env for the prod stack

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Deployment documentation

**Files:**
- Create: `docs/DEPLOY.md`

**Interfaces:**
- Consumes: everything above — env var names from Task 4 verbatim, smoke-test commands from Task 5.
- Produces: the operator runbook for Coolify.

- [ ] **Step 1: Write `docs/DEPLOY.md`**

```markdown
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
   healthy and then hits `POST /api/cron/run` every `CRON_INTERVAL_SECONDS`
   (default hourly).

## One-off operations

Run from the Coolify terminal on the server (or SSH), in the compose
project directory:

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

## Operational notes

- App healthchecks hit `/api/health`, which never touches the DB — a DB
  outage degrades requests but does not restart-loop containers.
- A failed migration aborts the deploy (apps never start on an unmigrated
  schema); the previous containers keep serving.
- Cron jobs are idempotent; a failed tick logs and retries next interval.
- The dev database in `docker-compose.yml` is untouched by all of this.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs(deploy): Coolify runbook — setup, env, domains, one-offs, smoke test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
