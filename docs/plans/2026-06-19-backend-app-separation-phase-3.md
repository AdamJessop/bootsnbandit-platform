# Admin app (staff PWA)

Created: 2026-06-19
Status: PENDING
Approved: No
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-backend-app-separation
Wave: 2

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-backend-app-separation-phase-3.md` to plan this phase.

## Summary

**Goal:** Create `apps/admin`: move `src/app/(admin)/admin/**` rebasing `/admin/*`→`/*`, ALL staff API (auth/availability/bookings/calendar.ics/cron/customers/integrations/leave/reports/sessions/uploads), `src/components/admin`, a copy of `src/components/ui`, admin-nav, pwa, root layout/globals copy. Update every internal link/redirect /admin/x→/x; sign-in at /sign-in. Installable PWA (manifest+sw). admin builds + its tests pass.
**Context:** See master plan at `docs/plans/2026-06-19-backend-app-separation.md` (Architecture, Context, Goal Verification). Decisions: npm workspaces; `@bnb/core` = domain only; UI per-app; web=apex/www, admin=admin.<domain>; all staff endpoints (incl iCal/cron/uploads) on admin. Preserve functionality; keep each workspace green (tsc/lint/build/tests, ≥483 total).

**Review-driven scope note:** Rebase NON-href paths too: `revalidatePath('/admin/..')`, `router.push('/admin/..')`, `redirect('/admin/..')` (CalendarClient/ReportsView/content/core-auth) → `/..`. Add admin `middleware.ts` auth guard + `robots.ts` Disallow: /.
