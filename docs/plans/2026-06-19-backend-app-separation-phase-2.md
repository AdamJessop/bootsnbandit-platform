# Web app (public/customer)

Created: 2026-06-19
Status: PENDING
Approved: No
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-backend-app-separation
Wave: 2

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-backend-app-separation-phase-2.md` to plan this phase.

## Summary

**Goal:** Create `apps/web`: move `src/app/(site)/**` to apex routes, public API (enquiries/flash/match/reviews), `src/components/site`, a copy of `src/components/ui`, site-nav, _data/_format/site.css, and the root layout/globals copy. Imports from @bnb/core. web builds + its tests pass.
**Context:** See master plan at `docs/plans/2026-06-19-backend-app-separation.md` (Architecture, Context, Goal Verification). Decisions: npm workspaces; `@bnb/core` = domain only; UI per-app; web=apex/www, admin=admin.<domain>; all staff endpoints (incl iCal/cron/uploads) on admin. Preserve functionality; keep each workspace green (tsc/lint/build/tests, ≥483 total).
