# Auth/PWA/cookie isolation per subdomain

Created: 2026-06-19
Status: PENDING
Approved: No
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-backend-app-separation
Wave: 3

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-backend-app-separation-phase-4.md` to plan this phase.

## Summary

**Goal:** Give each app its own `APP_ORIGIN`/`RP_ID`/`SESSION_COOKIE`. WebAuthn RP-ID + passkey origin = admin subdomain (localhost in dev); staff session cookie scoped to the admin origin (distinct name/Domain) so it is never accepted by web; web reserved for future customer auth. Finalize admin PWA scope; ensure web is not the installable staff app. Document staff-vs-customer session isolation. Re-enrol dev passkeys as needed.
**Context:** See master plan at `docs/plans/2026-06-19-backend-app-separation.md` (Architecture, Context, Goal Verification). Decisions: npm workspaces; `@bnb/core` = domain only; UI per-app; web=apex/www, admin=admin.<domain>; all staff endpoints (incl iCal/cron/uploads) on admin. Preserve functionality; keep each workspace green (tsc/lint/build/tests, ≥483 total).

**Review-driven scope note:** WebAuthn RP-ID change invalidates passkeys → dev re-enrol via `npm run admin:link`. Staff cookie Domain/name admin-scoped (not eTLD+1) so web never accepts it.
