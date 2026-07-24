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
