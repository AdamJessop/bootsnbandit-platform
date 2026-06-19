# Monorepo + @bnb/core shared package

Created: 2026-06-19
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-backend-app-separation
Wave: 1

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-backend-app-separation-phase-1.md` to plan this phase.

## Summary

**Goal:** Set up npm workspaces (`workspaces: [apps/*, packages/*]`). Create `packages/core` (`@bnb/core`) and move `src/lib` (db/services/auth/email/pricing/calendar/cron/artist-status/utils + api _lib http helper + shared types) and `prisma` (schema+migrations, client generated in-package) into it. Rewire the current root app's `@/lib/*` imports to `@bnb/core/*` and keep it green. Scaffold `apps/web` + `apps/admin` Next 15 shells (own next.config/tsconfig/tailwind/globals/layout, importing @bnb/core; admin shell gets PWA manifest+sw scaffold). Move `admin-nav`/`pwa` toward admin and `site-nav` toward web.
**Context:** See master plan at `docs/plans/2026-06-19-backend-app-separation.md` (Architecture, Context, Goal Verification). Decisions: npm workspaces; `@bnb/core` = domain only; UI per-app; web=apex/www, admin=admin.<domain>; all staff endpoints (incl iCal/cron/uploads) on admin. Preserve functionality; keep each workspace green (tsc/lint/build/tests, ≥483 total).

**Review-driven scope note:** Make `SESSION_COOKIE` + the wrong-role redirect target env-configurable (currently hard-coded `bb_session` / `redirect("/admin")`). Add `transpilePackages:["@bnb/core"]` to both app next.configs. GATE: end with root app green importing only from @bnb/core + a pre-parallel checkpoint commit; P2/P3 don't start until then.
