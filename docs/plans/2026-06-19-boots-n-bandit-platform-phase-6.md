# Domain Services & API

Created: 2026-06-19
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-boots-n-bandit-platform
Wave: 3

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-boots-n-bandit-platform-phase-6.md` to plan this phase.

## Summary

**Goal:** Server services + app/api route handlers for customers, enquiries, bookings (lifecycle + conflict checks), sessions, availability/leave, flash claims, and report queries (bookings/capacity/revenue per artist). Money in pence.
**Context:** See master plan at `docs/plans/2026-06-19-boots-n-bandit-platform.md`, plus `docs/PROJECT-BRIEF.md`, `docs/BACKOFHOUSE-IA.md`, and `design-src/` (styles.css tokens, data.jsx seed content). Reuse the shared domain model, auth contract, and design tokens defined in the master plan.

**Review-driven scope note:** Add `lib/services/loyalty.ts` (stamp-award, called by P10 at session-complete). Booking conflict-check MUST be leave-aware: an overlapping `Leave` row blocks the slot.
