# Data Layer

Created: 2026-06-19
Status: PENDING
Approved: No
Iterations: 0
Worktree: No
Type: Feature
Parent: 2026-06-19-boots-n-bandit-platform
Wave: 2

> Awaiting detailed planning. Run `/spec docs/plans/2026-06-19-boots-n-bandit-platform-phase-2.md` to plan this phase.

## Summary

**Goal:** Define the full Prisma schema (User/Authenticator/Artist/Customer/Enquiry/Booking/Session/AvailabilityRule/Leave/Chair/GalleryItem/Flash/TattooStyle/AftercareStage/Faq/LoyaltyConfig/SiteSettings/MessageLog/CalendarFeed/Review); Docker Postgres; migrations; seed from design-src/data.jsx.
**Context:** See master plan at `docs/plans/2026-06-19-boots-n-bandit-platform.md`, plus `docs/PROJECT-BRIEF.md`, `docs/BACKOFHOUSE-IA.md`, and `design-src/` (styles.css tokens, data.jsx seed content). Reuse the shared domain model, auth contract, and design tokens defined in the master plan.

**Review-driven scope note:** Explicitly deliver `docker-compose.yml` (Postgres) and `.env.example`.
