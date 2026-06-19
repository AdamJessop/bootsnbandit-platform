# Design System & Shells

Created: 2026-06-19
Status: PENDING
Approved: No
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-boots-n-bandit-platform
Wave: 2

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-boots-n-bandit-platform-phase-3.md` to plan this phase.

## Summary

**Goal:** Port visual primitives (Button, Chip, Tag, Plate, Filigree, Card, Field, StatusBadge, sechead, Icon via lucide) as React components; build public Nav/Ticker/Footer and the admin AppShell (sidebar/topbar/bottom-nav + nav registry + RoleGate), themed to heritage tokens.
**Context:** See master plan at `docs/plans/2026-06-19-boots-n-bandit-platform.md`, plus `docs/PROJECT-BRIEF.md`, `docs/BACKOFHOUSE-IA.md`, and `design-src/` (styles.css tokens, data.jsx seed content). Reuse the shared domain model, auth contract, and design tokens defined in the master plan.

**Review-driven scope note:** Also create typed STUB shells + prop interfaces for shared admin components (CalendarGrid, BookingDrawer, CustomerTimeline, DataTable, ChartWrapper, ImageUploader) so Wave-4 phases (P9/P10/P11) fill them in without colliding. Owns the admin nav registry.
