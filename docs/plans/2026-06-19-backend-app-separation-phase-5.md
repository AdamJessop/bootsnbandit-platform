# Dev/deploy/subdomain config + cutover + verify

Created: 2026-06-19
Status: COMPLETE
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-backend-app-separation
Wave: 4

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-backend-app-separation-phase-5.md` to plan this phase.

## Summary

**Goal:** Root scripts: `dev` runs web+admin on distinct ports, `build`/`lint`/`test` fan out across workspaces. Remove the legacy root `src/app` + `src/lib` + root app configs (monorepo is the only source). Subdomain/deploy docs (web=apex/www, admin=admin.<domain>) + per-app `.env.example`. End-to-end verification: both apps green (tsc/lint/build/test per workspace, ≥483 tests total), passkey login works on the admin origin, public flows work on web.
**Context:** See master plan at `docs/plans/2026-06-19-backend-app-separation.md` (Architecture, Context, Goal Verification). Decisions: npm workspaces; `@bnb/core` = domain only; UI per-app; web=apex/www, admin=admin.<domain>; all staff endpoints (incl iCal/cron/uploads) on admin. Preserve functionality; keep each workspace green (tsc/lint/build/tests, ≥483 total).

**Review-driven scope note:** Fix Prisma seed path + `scripts/admin-link.ts` after the core move; split sitemap/robots per app (web public, admin Disallow: /).
