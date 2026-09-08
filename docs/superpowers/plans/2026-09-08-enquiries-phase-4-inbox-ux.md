# Enquiries Omnichannel — Phase 4: Inbox UX Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the omnichannel inbox as a screen a person can actually work in. The 545-line `EnquiryInbox.tsx` becomes five focused modules; the composer gains an explicit **Email / Messenger / Instagram / Internal note** selector that shows *why* a channel is unreachable (no address on file, no live Page, the Meta 24-hour window shut — with the closing time) so a dead Meta window can be answered by email in place; the status tabs carry visibility-scoped counts and rows carry an unread dot plus an assigned-artist pill (owner) or **Unassigned · Take this** (artist); the nav badge polls every 60 s and stops while the tab is hidden; `/enquiries?open=<id>` opens one thread and marks it read, and the customer page links to it — that page also gains inbound/outbound messages on the timeline, identity chips, and an owner-only **link a Messenger/Instagram handle** action that folds a stub customer into the real record, closing the Phase-3 hole where a known customer who DMs on Instagram became a second row. The Channels panel finally warns when a connection has heard nothing for 30 days.

**Architecture:** Nothing new goes into `packages/core` except one visibility-scoped tally (`statusCountsFor`) and one identity-merge service (`identity-linking.ts`); everything else is admin-app UI, and every decision the UI renders is re-decided server-side. The reply channel is one pure function, `replyChannelOptions(reachability, now)`, in `enquiry-helpers.ts`: the page calls it to draw the selector, and `replyToEnquiry` calls it again to validate the channel the browser sent — the client's choice is an input, never an authority. Reachability itself is derived from `toEnquiryEmailContext` (Phase 2/3), so "what can we reply on?" has exactly one definition and no duplicated last-inbound logic. The component split is behaviour-preserving by construction: `EnquiryInbox.test.tsx` is not edited in Task 1 and must stay green.

**Tech Stack:** Node 22, npm workspaces, Next.js 15 App Router, React 19, TypeScript, Prisma 7 (Postgres 16), vitest 4 (`renderToStaticMarkup` for components, `testdb` harness for DB suites), shadcn/ui on Base UI + Tailwind + lucide-react, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-09-07-enquiries-omnichannel-crm-design.md` — §6 Admin UI (component split, status tabs, unread badge polling, customer timeline + identity chips, `?open=<id>`), §4 (reply/note/assign/claim/close/convert semantics), §5 (visibility), Phasing item 4 ("Inbox UX polish — component split, composer UX, customer page timeline + identity chips, status tabs, `?open=` deep links").

**Builds on:**
- Phase 1 `docs/superpowers/plans/2026-09-07-enquiries-phase-1-identity-and-threads.md` — `EnquiryMessage`, `EnquiryRead`, `CustomerIdentity`, `recordInbound/Outbound/Note`, `unreadCountsFor`, `visibleEnquiryWhere`, the AppShell unread badge.
- Phase 2 `docs/superpowers/plans/2026-09-07-enquiries-phase-2-email-channel.md` — `ENQUIRY_EMAIL_CONTEXT_SELECT`, `toEnquiryEmailContext`, `sendEnquiryEmail`, Studio › Channels.
- Phase 3 `docs/superpowers/plans/2026-09-08-enquiries-phase-3-meta-channels.md` (branch `feat/enquiries-phase-3`, head `6dc1828`) — `ChannelConnection`, `listChannelConnections`, `loadMetaReplyTarget`, `sendEnquiryMetaMessage`, `META_SEND_WINDOW_MS`, `chooseReplyChannel`, the partial-send message.

Every signature this plan consumes from those phases is quoted verbatim in the task that first uses it.

## Global Constraints

- **No new runtime dependencies.** Nothing here adds a package to `packages/core/package.json` or to either app. Icons come from the `lucide-react` already installed; there is no Facebook or Instagram glyph in it, so Messenger uses `MessageCircle` and Instagram uses `Camera` (the convention Phase 3 set in `EnquiryThread.tsx` and the Channels panel — do not diverge).
- **Component tests use `renderToStaticMarkup` from `react-dom/server` under vitest's `node` environment and never touch the database.** They mock `./actions` (the `"use server"` module pulls in auth/db/email) and `@/components/ui/dialog` (Base UI portals to `<body>`, which does not exist under SSR). Copy the mock preamble from `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx` verbatim into every new component suite.
- **Service tests that need rows use the `testdb` harness** (`testDb`, `dbReachable`, `closeTestDb`, `uid` from `packages/core/src/services/testdb.ts`), open with `if (!(await dbReachable())) return;`, and delete their own fixtures in `afterAll`. Dev Postgres is `docker compose up -d` (port 5435).
- **Every server action keeps `requireRole` and, for enquiries, `canAccessEnquiry`.** Owner-only actions call `requireRole("OWNER")`. Nothing this phase adds may widen who can see or act on an enquiry: `visibleEnquiryWhere` (core), `artistInboxWhere` and `canAccessEnquiry` (admin) stay in lockstep — change all three together or none.
- **Never trust the client's channel.** `replyToEnquiry` recomputes reachability from the database and re-validates any `channel` the browser sent. A disabled option in the UI is a convenience; the refusal is the action's job.
- **Nothing renders a token.** `ChannelConnection.accessToken` is never selected into a page or component prop; screens show presence and health only. `listChannelConnections()` already returns a token-free row shape — use it.
- **`apps/web` is not touched in this phase** and must never import `@bnb/core/auth` (a guard test enforces it).
- Admin uses shadcn/ui + Tailwind design tokens (`text-text-muted`, `text-text-secondary`, `text-text-primary`, `border-border-default`, `border-border-strong`, `bg-bg-card`, `bg-bg-base`, `bg-bg-elevated`, `text-bb-teal`, `text-bb-gold`, `text-bb-crimson`). Images are plain `<img>`, never `next/image`.
- Tests: `npm test -w @bnb/core`, `npm test -w @bnb/admin`, `npm test -w @bnb/web`. A single file: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/EnquiryInbox.test.tsx"` (quote the path — the route group's parentheses are shell metacharacters). Types: `npm run typecheck`. Lint: `npm run lint`.
- Load env for CLI work with `set -a && . ./.env && set +a` from the repo root.
- **Appended snippets merge their imports.** Several tasks append tests to a file that already imports from the same module (`./enquiry-helpers`, `./timeline-builder`, `vitest`). Fold the new names into the existing `import` statement rather than adding a second one — `no-duplicate-imports` fails the lint step otherwise.
- Commit after every task with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ
  ```
- **Never stage** `.superpowers/`, `.sentinal/`, `.env` or `docs/plans/2026-07-29-artist-showcase-screen.md` (pre-existing unrelated changes). Every commit uses an explicit `git add` list.

---

## File map

| Path | Responsibility |
| --- | --- |
| `apps/admin/src/app/(staff)/enquiries/inbox-shared.ts` | `EnquiryItem` / `ArtistOption` types, tab + badge constants, the `useAction` toast-and-transition hook |
| `apps/admin/src/app/(staff)/enquiries/InboxFilters.tsx` (+test) | status tabs with counts, artist/style/source dropdowns |
| `apps/admin/src/app/(staff)/enquiries/EnquiryList.tsx` (+test) | rows (unread dot, channel badge, assigned pill / Take this) + the detail dialog shell |
| `apps/admin/src/app/(staff)/enquiries/EnquiryMeta.tsx` (+test) | brief fields, mood board, take / assign / convert / close |
| `apps/admin/src/app/(staff)/enquiries/ReplyComposer.tsx` (+test) | channel selector, reply body, send |
| `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx` | orchestrator only: filter state, deep-link state, composition |
| `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts` (+test) | `replyChannelOptions`, `defaultComposerChannel`, `resolveComposerChannel`, `resolveOpenParam`, `pickOpenState` |
| `apps/admin/src/app/(staff)/enquiries/actions.ts` (+test) | `replyToEnquiry` gains a validated `channel` override |
| `apps/admin/src/app/(staff)/enquiries/page.tsx` (+test) | reachability + reply options per enquiry, scoped tab counts, `?open=` resolution |
| `apps/admin/src/components/admin/AppShell.tsx` (+test) | badge polling pauses while the tab is hidden |
| `packages/core/src/services/enquiry-messages.ts` (+test) | `statusCountsFor(viewer)` |
| `packages/core/src/services/identity-linking.ts` (+test) | `listLinkableIdentities`, `linkIdentityToCustomer` (stub merge) |
| `packages/core/src/services/index.ts` | barrel gains `identity-linking` |
| `apps/admin/src/components/admin/CustomerTimeline.tsx` (+test) | `message` entry kind, channel icon, optional `href` |
| `apps/admin/src/app/(staff)/customers/[id]/timeline-builder.ts` (+test) | message entries, enquiry deep links, `messagePreview` |
| `apps/admin/src/app/(staff)/customers/[id]/IdentityChips.tsx` (+test) | email / phone / Messenger / Instagram chips |
| `apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.tsx` (+test) | owner-only "link a handle" control |
| `apps/admin/src/app/(staff)/customers/[id]/{page.tsx,actions.ts}` (+tests) | wiring + `linkIdentityAction` |
| `apps/admin/src/app/(staff)/studio/channels/page.tsx` (+test) | "Reconnect recommended" after 30 quiet days |
| `packages/core/src/services/channel-connections.ts` (+test) | `connectionHealth` + `RECONNECT_AFTER_DAYS` |
| `docs/CHANNELS.md`, `docs/PROJECT-BRIEF.md` | health hint + build-log entry |

---

## Ambiguities resolved before writing (each is restated where it applies)

1. **The 60 s poll already exists.** Phase 1 shipped `setInterval(() => router.refresh(), 60_000)` in `AppShell.tsx`. Ruling 4 is therefore only the missing half — pausing while `document.visibilityState === "hidden"` — not a new mechanism. Task 4 adds the pause and a test; it does not re-add the timer.
2. **Reachability is derived from `toEnquiryEmailContext`, not from thread rows.** The page switches its `findMany` to spread `ENQUIRY_EMAIL_CONTEXT_SELECT` and calls the same mapper the action uses. This is why no change to `ThreadMessageRow`/`MESSAGE_SELECT` is needed: `contactEmail`'s three-way fallback and the last-inbound channel/connection/address all already live in that one function, and duplicating them in the page would be a second definition to drift.
3. **The default channel is `chooseReplyChannel`'s pick, unless that pick is unavailable.** `chooseReplyChannel` returns `messenger` whenever a live Page exists, even with the 24-hour window shut — defaulting to a disabled option would be a dead composer. `defaultComposerChannel` therefore takes that pick and, when it is not available, falls back to the first available option (email, else internal note). This is the mechanism behind "a closed Meta window can be answered by email in place".
4. **A refusal message is the option's own hint.** `resolveComposerChannel` returns the unavailable option's `hint` as its error, so staff read the same sentence whether they saw it under the selector or got it back from the server. No second copy of the wording.
5. **Explicit "Internal note" is not the same as "nothing was reachable".** The UI routes a chosen note to `addInternalNote` (existing semantics: no claim, no status change, message "Note added."). `replyToEnquiry`'s derived-note branch — reached only when nothing is reachable — keeps its Phase-3 behaviour verbatim, including the `— Not sent: …` suffix and the implicit claim. `replyToEnquiry` still accepts and validates `channel: "note"` because the action must be safe when called directly.
6. **The Meta window is evaluated at render time and again at send time.** An open composer can go stale; the 60 s `router.refresh()` redraws it, and the server re-checks before sending. `MetaWindowClosedError` handling stays for the race between the two.
7. **Tab counts are a `groupBy`, not a tally of the loaded page.** `countByStatus` over the 300 loaded rows undercounts a busy inbox. `statusCountsFor(viewer)` counts every visible enquiry; the list then says "Showing the 300 most recent" when it is truncated, so a count larger than the visible rows is explained rather than confusing.
8. **A deep link resolves through a scoped query, never a bare `findUnique`.** `/enquiries?open=<id>` runs `findFirst({ where: { id, ...visibility } })`; an unknown id, another artist's enquiry, or junk all produce the same quiet notice — no 404, no 500, no way to probe which enquiries exist.
9. **"Link a handle" picks from existing identities; it is not a free-text id field.** A PSID/IGSID is an opaque number no owner will type correctly, and the actual failure this closes is "the handle is already on a stub customer". The card lists linkable identities (handles whose current customer has no email, no phone, no password and no bookings) and links the chosen one, merging that stub away. A handle attached to a real customer is refused, not stolen.
10. **The `debug_token` half of ruling 7 is dropped.** Graph's `/debug_token` is GET-only and takes both the inspected token and the app token as **query parameters** — which Phase 3's standing constraint forbids ("the page token goes in the request body, never the URL: query strings land in access logs"). The ruling's own escape hatch applies: keep the 30-day quiet-connection hint, drop the live token probe. `tokenReadable` already covers the other half (a token that no longer decrypts).
11. **`EnquiryInbox.test.tsx` is the Task 1 gate and is not edited in Task 1.** Its cases render the composed `EnquiryInbox`, so they exercise every extracted child. Task 3 edits exactly one assertion in it (the internal-note label), because that is a deliberate UX change, and says so.

---

### Task 1: Split `EnquiryInbox.tsx` into five modules (behaviour-preserving)

545 lines doing filters, rows, dialog, meta, reply and notes become an orchestrator plus four components and a shared module. **No server action changes at all**, and `EnquiryInbox.test.tsx` is not touched — it passing afterwards is the proof this task changed nothing.

**Files:**
- Create: `apps/admin/src/app/(staff)/enquiries/inbox-shared.ts`, `InboxFilters.tsx`, `InboxFilters.test.tsx`, `EnquiryList.tsx`, `EnquiryList.test.tsx`, `EnquiryMeta.tsx`, `EnquiryMeta.test.tsx`, `ReplyComposer.tsx`, `ReplyComposer.test.tsx` (all under the same directory)
- Modify: `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx`
- Untouched (regression gate): `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx`, `page.tsx`, `actions.ts`, `enquiry-helpers.ts`

**Interfaces:**
- Consumes (Phase 1–3, verbatim):
  ```ts
  // apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts
  export function countByStatus(items: { status: EnquiryStatus }[]): Record<EnquiryStatus, number>
  export function distinctStyles(items: { style: string | null }[]): string[]
  export function filterEnquiries<T extends { preferredArtistId: string | null; style: string | null; source?: EnquirySource | null }>(items: T[], filter: InboxFilter): T[]
  export function isUnassigned(e: { preferredArtistId: string | null }): boolean
  export interface InboxFilter { artistId: string | null; style: string | null; source: EnquirySource | null }

  // ./actions.ts — signatures unchanged by this task
  export async function replyToEnquiry(enquiryId: string, input: { message: string }): Promise<ActionState>
  export async function addInternalNote(enquiryId: string, input: { body: string }): Promise<ActionState>
  export async function assignEnquiry(enquiryId: string, artistId: string): Promise<ActionState>
  export async function claimEnquiry(enquiryId: string): Promise<ActionState>
  export async function closeEnquiry(enquiryId: string): Promise<ActionState>
  export async function convertEnquiry(enquiryId: string, form: { artistId: string; startISO: string; durationMin: number; type: BookingType }): Promise<ActionState>
  export async function markEnquiryRead(enquiryId: string): Promise<ActionState>
  export interface ActionState { ok: boolean; message?: string }

  // ./EnquiryThread.tsx
  export function EnquiryThread({ items }: { items: ThreadItem[] }): JSX.Element | null
  // ./EnquiryDetailSections.tsx
  export function MoodBoardBriefSection({ data }: { data: MoodboardData | null }): JSX.Element | null
  export function MoodboardSection({ urls, data }: { urls: string[]; data: MoodboardData | null }): JSX.Element | null
  // ../_shared/labels.ts
  export function enquiryStatusLabel(status: EnquiryStatus): string
  export function formatDateTime(iso: string | Date | null | undefined): string
  ```
- Produces:
  ```ts
  // inbox-shared.ts
  export interface EnquiryItem { /* unchanged shape, moved out of EnquiryInbox.tsx */ }
  export interface ArtistOption { id: string; name: string }
  export const ALL: "__all__";
  export const STATUS_ORDER: EnquiryStatus[];
  export const CHANNEL_BADGE: Record<EnquiryChannel, string>;
  export const SOURCE_FILTER_ITEMS: { value: string; label: string }[];
  export function useAction(): { pending: boolean; run: (fn: () => Promise<{ ok: boolean; message?: string }>, opts?: { onSuccess?: () => void }) => void };

  // InboxFilters.tsx
  export function InboxFilters(props: InboxFiltersProps): JSX.Element
  // EnquiryList.tsx
  export function EnquiryList(props: EnquiryListProps): JSX.Element
  // EnquiryMeta.tsx
  export function EnquiryMeta(props: EnquiryMetaProps): JSX.Element
  // ReplyComposer.tsx
  export function ReplyComposer(props: ReplyComposerProps): JSX.Element
  // EnquiryInbox.tsx — re-exports the moved types so page.tsx needs no edit
  export type { ArtistOption, EnquiryItem } from "./inbox-shared";
  ```

- [ ] **Step 1: Record the green baseline**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/EnquiryInbox.test.tsx"`
Expected: PASS (6 tests). This file must still pass at Step 10 without being edited.

- [ ] **Step 2: Write the four failing component tests**

Create `apps/admin/src/app/(staff)/enquiries/InboxFilters.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxFilters } from "./InboxFilters";

describe("InboxFilters", () => {
  it("renders every status tab with its count and label-bearing selects", () => {
    const html = renderToStaticMarkup(
      <InboxFilters
        tab="new"
        onTabChange={vi.fn()}
        counts={{
          new: 3,
          customer_replied: 2,
          replied: 1,
          converted: 0,
          closed: 7,
        }}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        styles={["fine line"]}
        artistFilter="__all__"
        styleFilter="__all__"
        sourceFilter="__all__"
        onArtistFilter={vi.fn()}
        onStyleFilter={vi.fn()}
        onSourceFilter={vi.fn()}
      />,
    );
    expect(html).toContain("Customer replied");
    expect(html).toContain("Closed");
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(triggers).toContain("All artists");
    expect(triggers).not.toContain("__all__");
  });
});
```

Create `apps/admin/src/app/(staff)/enquiries/EnquiryMeta.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
}));

import { EnquiryMeta } from "./EnquiryMeta";
import type { EnquiryItem } from "./inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  contactName: "Amy Rowe",
  contactEmail: "amy@example.test",
  subject: "Sleeve idea",
  style: "fine line",
  placement: "forearm",
  size: "small",
  budgetPence: 15000,
  description: "A ladybird, please",
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "web",
  preferredArtistId: null,
  preferredArtistName: null,
  createdAtISO: "2026-09-01T10:00:00.000Z",
  lastMessageAtISO: null,
  unread: false,
  thread: [],
};

describe("EnquiryMeta", () => {
  it("shows the brief, the assign select by name, and the close control", () => {
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={{ ...ITEM, preferredArtistId: "cln4artist1aaaa" }}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        canConvert
        viewerArtistId={null}
        onDone={vi.fn()}
      />,
    );
    expect(html).toContain("fine line");
    expect(html).toContain("Sarah North");
    expect(html).toContain("Close enquiry");
    expect(html).toContain("Create consult");
  });

  it("offers an artist the take control on an unassigned enquiry", () => {
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={ITEM}
        artists={[{ id: "a1", name: "Sarah North" }]}
        canConvert
        viewerArtistId="a1"
        onDone={vi.fn()}
      />,
    );
    expect(html).toContain("Take this enquiry");
  });
});
```

Create `apps/admin/src/app/(staff)/enquiries/ReplyComposer.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

import { ReplyComposer } from "./ReplyComposer";

describe("ReplyComposer", () => {
  it("renders the reply and note composers", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("Reply (emails customer)");
    expect(html).toContain("Internal note (staff only — never sent)");
    expect(html).toContain("Send reply");
  });

  it("warns an artist that replying to an unassigned enquiry takes it", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="inkling"
        claimsOnReply
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("assigns it to you");
    expect(html).toContain("Respond");
  });
});
```

Create `apps/admin/src/app/(staff)/enquiries/EnquiryList.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
  markEnquiryRead: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Passthrough,
    DialogContent: Passthrough,
    DialogDescription: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: Passthrough,
    DialogTrigger: Passthrough,
  };
});

import { EnquiryList } from "./EnquiryList";
import type { EnquiryItem } from "./inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  contactName: "Amy Rowe",
  contactEmail: "amy@example.test",
  subject: "Sleeve idea",
  style: "fine line",
  placement: "forearm",
  size: null,
  budgetPence: null,
  description: null,
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "messenger",
  preferredArtistId: null,
  preferredArtistName: null,
  createdAtISO: "2026-09-01T10:00:00.000Z",
  lastMessageAtISO: "2026-09-02T10:00:00.000Z",
  unread: true,
  thread: [],
};

describe("EnquiryList", () => {
  it("renders a row with its unread dot, channel badge and owner pill", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        emptyLabel="new"
      />,
    );
    expect(html).toContain('aria-label="Unread"');
    expect(html).toContain("Messenger");
    expect(html).toContain("Unassigned");
    expect(html).toContain("Amy Rowe");
  });

  it("shows the per-tab empty state when there is nothing to show", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[]}
        artists={[]}
        canConvert={false}
        viewerArtistId={null}
        showAssignedPill={false}
        emptyLabel="closed"
      />,
    );
    expect(html).toContain("No closed enquiries.");
  });
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/InboxFilters.test.tsx" "src/app/(staff)/enquiries/EnquiryMeta.test.tsx" "src/app/(staff)/enquiries/ReplyComposer.test.tsx" "src/app/(staff)/enquiries/EnquiryList.test.tsx"`
Expected: FAIL — `Failed to resolve import "./InboxFilters"` (and the other three).

- [ ] **Step 4: Create `inbox-shared.ts`**

```tsx
"use client";

/**
 * Shared vocabulary for the enquiry inbox islands: the row payload the server
 * page builds, the tab/badge constants, and the one toast-and-transition
 * wrapper every action button uses. Lives apart from the components so
 * EnquiryInbox → EnquiryList → EnquiryMeta can all import it without a cycle.
 */
import { useTransition } from "react";
import { toast } from "sonner";
import type {
  EnquiryChannel,
  EnquirySource,
  EnquiryStatus,
} from "@prisma/client";
import type { MoodboardData } from "@bnb/core/services/moodboard-data";
import type { ThreadItem } from "./EnquiryThread";

export interface EnquiryItem {
  id: string;
  contactName: string;
  contactEmail: string | null;
  subject: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  moodboardData: MoodboardData | null;
  status: EnquiryStatus;
  source: EnquirySource;
  channel: EnquiryChannel;
  preferredArtistId: string | null;
  /** Resolved name for the preferred artist, or null when unassigned. */
  preferredArtistName: string | null;
  createdAtISO: string;
  /** Newest message on the thread, or null when nothing has landed yet. */
  lastMessageAtISO: string | null;
  /** Customer traffic this viewer has not caught up on. */
  unread: boolean;
  /** The full message thread, oldest first. */
  thread: ThreadItem[];
}

export interface ArtistOption {
  id: string;
  name: string;
}

export const ALL = "__all__";

export const STATUS_ORDER: EnquiryStatus[] = [
  "new",
  "customer_replied",
  "replied",
  "converted",
  "closed",
];

/**
 * How a row badges the enquiry. The channel supersedes the older source for
 * display — an emailed lead still records source `web` — so the row shows the
 * channel while the dropdown filters on source.
 */
export const CHANNEL_BADGE: Record<EnquiryChannel, string> = {
  web: "Web",
  flash: "Flash",
  inkling: "Mood board",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};

export const SOURCE_FILTER_ITEMS = [
  { value: ALL, label: "All sources" },
  { value: "inkling", label: "Mood boards" },
  { value: "web", label: "Web" },
  { value: "flash", label: "Flash" },
];

/**
 * Run a server action inside a transition, toast whatever it says, and call
 * `onSuccess` only when it worked. Every action button in the inbox goes
 * through this so a failed action can never look like a success.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    opts: { onSuccess?: () => void } = {},
  ) => {
    start(async () => {
      const res = await fn();
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) opts.onSuccess?.();
    });
  };
  return { pending, run };
}
```

- [ ] **Step 5: Create `InboxFilters.tsx`**

```tsx
"use client";

/**
 * Inbox chrome: the five status tabs with their counts, and the artist / style
 * / source dropdowns. Stateless — the orchestrator owns the values.
 */
import { useMemo } from "react";
import type { EnquiryStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { enquiryStatusLabel } from "../_shared/labels";
import {
  ALL,
  SOURCE_FILTER_ITEMS,
  STATUS_ORDER,
  type ArtistOption,
} from "./inbox-shared";

export interface InboxFiltersProps {
  tab: EnquiryStatus;
  onTabChange: (tab: EnquiryStatus) => void;
  counts: Record<EnquiryStatus, number>;
  artists: ArtistOption[];
  styles: string[];
  artistFilter: string;
  styleFilter: string;
  sourceFilter: string;
  onArtistFilter: (value: string) => void;
  onStyleFilter: (value: string) => void;
  onSourceFilter: (value: string) => void;
}

export function InboxFilters({
  tab,
  onTabChange,
  counts,
  artists,
  styles,
  artistFilter,
  styleFilter,
  sourceFilter,
  onArtistFilter,
  onStyleFilter,
  onSourceFilter,
}: InboxFiltersProps) {
  // Let the closed filter triggers render labels, never the raw "__all__"
  // sentinel or an artist cuid.
  const artistFilterItems = useMemo(
    () => [
      { value: ALL, label: "All artists" },
      ...artists.map((a) => ({ value: a.id, label: a.name })),
    ],
    [artists],
  );
  const styleFilterItems = useMemo(
    () => [
      { value: ALL, label: "All styles" },
      ...styles.map((s) => ({ value: s, label: s })),
    ],
    [styles],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as EnquiryStatus)}>
        <TabsList>
          {STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s}>
              {enquiryStatusLabel(s)}
              <span className="ml-1.5 tabular-nums text-text-muted">
                {counts[s]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select
        items={artistFilterItems}
        value={artistFilter}
        onValueChange={(v) => onArtistFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by artist">
          <SelectValue placeholder="All artists" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All artists</SelectItem>
          {artists.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={styleFilterItems}
        value={styleFilter}
        onValueChange={(v) => onStyleFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by style">
          <SelectValue placeholder="All styles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All styles</SelectItem>
          {styles.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={SOURCE_FILTER_ITEMS}
        value={sourceFilter}
        onValueChange={(v) => onSourceFilter(v ?? ALL)}
      >
        <SelectTrigger className="w-40" aria-label="Filter by source">
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_FILTER_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 6: Create `EnquiryMeta.tsx`**

```tsx
"use client";

/**
 * The non-conversation half of the detail dialog: the brief, the mood board,
 * and the triage controls (take, assign, convert → booking, close). Owns its
 * own transition so a slow assign cannot block the composer next to it.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPence } from "@/components/admin/money";
import {
  MoodBoardBriefSection,
  MoodboardSection,
} from "./EnquiryDetailSections";
import { isUnassigned } from "./enquiry-helpers";
import { useAction, type ArtistOption, type EnquiryItem } from "./inbox-shared";
import {
  assignEnquiry,
  claimEnquiry,
  closeEnquiry,
  convertEnquiry,
} from "./actions";

export interface EnquiryMetaProps {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  /** The viewing artist's id, or null for owners. */
  viewerArtistId: string | null;
  /** Called after an action that finishes the job, so the dialog can close. */
  onDone: () => void;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="text-text-secondary">{value || "—"}</dd>
    </div>
  );
}

export function EnquiryMeta({
  item,
  artists,
  canConvert,
  viewerArtistId,
  onDone,
}: EnquiryMetaProps) {
  const { pending, run } = useAction();
  const [artistId, setArtistId] = useState(item.preferredArtistId ?? "");
  const [startISO, setStartISO] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  // Lets the closed assign-select trigger render the artist's name, not the cuid.
  const artistItems = useMemo(
    () => artists.map((a) => ({ value: a.id, label: a.name })),
    [artists],
  );

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Style" value={item.style} />
        <Field label="Placement" value={item.placement} />
        <Field label="Size" value={item.size} />
        <Field
          label="Budget"
          value={item.budgetPence != null ? formatPence(item.budgetPence) : null}
        />
      </dl>
      {item.description && (
        <p className="rounded-md border border-border-default bg-bg-base p-3 text-sm text-text-secondary">
          {item.description}
        </p>
      )}

      <MoodBoardBriefSection data={item.moodboardData} />
      <MoodboardSection urls={item.moodboard} data={item.moodboardData} />

      {viewerArtistId && isUnassigned(item) && (
        <Button
          disabled={pending}
          onClick={() => run(() => claimEnquiry(item.id), { onSuccess: onDone })}
        >
          Take this enquiry
        </Button>
      )}

      <section className="space-y-2">
        <Label>Assign artist</Label>
        <div className="flex gap-2">
          <Select
            items={artistItems}
            value={artistId}
            onValueChange={(v) => setArtistId(v ?? "")}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose artist" />
            </SelectTrigger>
            <SelectContent>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={pending || !artistId}
            onClick={() =>
              run(() => assignEnquiry(item.id, artistId), { onSuccess: onDone })
            }
          >
            Assign
          </Button>
        </div>
      </section>

      {canConvert && (
        <section className="space-y-2 rounded-md border border-border-default p-3">
          <Label>Convert → booking</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              aria-label="Start"
              onChange={(e) =>
                setStartISO(
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                )
              }
            />
            <Input
              type="number"
              aria-label="Duration (minutes)"
              value={durationMin}
              min={15}
              step={15}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
          <Button
            disabled={pending || !startISO || !artistId}
            onClick={() =>
              run(
                () =>
                  convertEnquiry(item.id, {
                    artistId,
                    startISO,
                    durationMin: Number(durationMin),
                    type: "consult",
                  }),
                { onSuccess: onDone },
              )
            }
          >
            Create consult
          </Button>
        </section>
      )}

      {item.status !== "closed" && (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => run(() => closeEnquiry(item.id), { onSuccess: onDone })}
        >
          Close enquiry
        </Button>
      )}
    </>
  );
}
```

- [ ] **Step 7: Create `ReplyComposer.tsx`**

Task 1's composer is a straight lift — same two textareas, same labels, same actions. Task 3 replaces the body of this file with the channel selector; keeping it identical here is what makes Task 1 reviewable as a no-op.

```tsx
"use client";

/**
 * The composer: a reply that goes to the customer, and an internal note that
 * never does. Replying is what marks an enquiry `replied` (and, for an artist
 * on an unassigned enquiry, claims it) — the server decides both.
 */
import { useState } from "react";
import type { EnquirySource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./inbox-shared";
import { addInternalNote, replyToEnquiry } from "./actions";

export interface ReplyComposerProps {
  enquiryId: string;
  /** Inkling boards say "Respond" rather than "Send reply". */
  source: EnquirySource;
  /** True when this viewer replying would also take the enquiry. */
  claimsOnReply: boolean;
  /** Called after a successful reply, so the dialog can close. */
  onSent: () => void;
}

export function ReplyComposer({
  enquiryId,
  source,
  claimsOnReply,
  onSent,
}: ReplyComposerProps) {
  const { pending, run } = useAction();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  return (
    <>
      <section className="space-y-2">
        <Label htmlFor={`reply-${enquiryId}`}>
          {claimsOnReply
            ? "Reply (emails customer — responding to an unassigned enquiry assigns it to you)"
            : "Reply (emails customer)"}
        </Label>
        <Textarea
          id={`reply-${enquiryId}`}
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Thanks for getting in touch…"
        />
        <Button
          disabled={pending || !reply.trim()}
          onClick={() =>
            run(() => replyToEnquiry(enquiryId, { message: reply }), {
              onSuccess: onSent,
            })
          }
        >
          {source === "inkling" ? "Respond" : "Send reply"}
        </Button>
      </section>

      <section className="space-y-2">
        <Label htmlFor={`note-${enquiryId}`}>
          Internal note (staff only — never sent)
        </Label>
        <Textarea
          id={`note-${enquiryId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context for whoever picks this up…"
        />
        <Button
          variant="outline"
          disabled={pending || !note.trim()}
          onClick={() =>
            // Several notes in a row is normal, so this one does NOT close the
            // dialog — it just clears the box.
            run(async () => {
              const res = await addInternalNote(enquiryId, { body: note });
              if (res.ok) setNote("");
              return res;
            })
          }
        >
          Add note
        </Button>
      </section>
    </>
  );
}
```

- [ ] **Step 8: Create `EnquiryList.tsx`**

```tsx
"use client";

/**
 * The list of leads and the detail dialog behind each row. A row carries the
 * unread dot, the channel badge, the assigned-artist pill (owners) or the
 * Unassigned flag (artists), and the newest activity time; opening it is what
 * marks the thread read.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPence } from "@/components/admin/money";
import { enquiryStatusLabel, formatDateTime } from "../_shared/labels";
import { isUnassigned } from "./enquiry-helpers";
import { EnquiryThread } from "./EnquiryThread";
import { EnquiryMeta } from "./EnquiryMeta";
import { ReplyComposer } from "./ReplyComposer";
import {
  CHANNEL_BADGE,
  type ArtistOption,
  type EnquiryItem,
} from "./inbox-shared";
import { markEnquiryRead } from "./actions";

export interface EnquiryListProps {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
  /** Lower-cased status label for the empty state ("new", "closed", …). */
  emptyLabel: string;
}

export function EnquiryList({
  items,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
  emptyLabel,
}: EnquiryListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
        No {emptyLabel} enquiries.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <EnquiryRow
            item={item}
            artists={artists}
            canConvert={canConvert}
            viewerArtistId={viewerArtistId}
            showAssignedPill={showAssignedPill}
          />
        </li>
      ))}
    </ul>
  );
}

function EnquiryRow({
  item,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
}: {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  showAssignedPill: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Opening the thread is what counts as reading it.
        if (next && item.unread) void markEnquiryRead(item.id);
      }}
    >
      <DialogTrigger className="w-full rounded-lg border border-border-default bg-bg-card px-5 py-4 text-left transition-colors hover:border-border-strong">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium text-text-primary">
            {item.unread && (
              <span
                className="size-2 shrink-0 rounded-full bg-bb-crimson"
                role="img"
                aria-label="Unread"
              />
            )}
            {item.contactName}
          </span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{CHANNEL_BADGE[item.channel]}</Badge>
            {showAssignedPill && (
              <Badge variant={item.preferredArtistName ? "secondary" : "default"}>
                {item.preferredArtistName ?? "Unassigned"}
              </Badge>
            )}
            {!showAssignedPill && isUnassigned(item) && <Badge>Unassigned</Badge>}
            <span className="text-xs text-text-muted">
              {formatDateTime(item.lastMessageAtISO ?? item.createdAtISO)}
            </span>
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-text-muted">
          {item.subject ??
            ([item.style, item.placement, item.size].filter(Boolean).join(" · ") ||
              "No brief")}
          {item.budgetPence != null
            ? ` · budget ${formatPence(item.budgetPence)}`
            : ""}
        </p>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {item.contactName}
          </DialogTitle>
          <DialogDescription>
            {item.contactEmail ?? "No email"} · {enquiryStatusLabel(item.status)}
          </DialogDescription>
        </DialogHeader>

        <EnquiryMeta
          item={item}
          artists={artists}
          canConvert={canConvert}
          viewerArtistId={viewerArtistId}
          onDone={() => setOpen(false)}
        />
        <EnquiryThread items={item.thread} />
        <ReplyComposer
          enquiryId={item.id}
          source={item.source}
          claimsOnReply={Boolean(viewerArtistId) && isUnassigned(item)}
          onSent={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

**Ordering note:** the original rendered brief → mood board → thread → take/assign → reply → note → convert → close. The split groups all triage controls in `EnquiryMeta` (so they sit above the thread) and both composers below it. `EnquiryInbox.test.tsx` asserts on presence, not order, so it stays green; the reading order is better (context, conversation, response).

- [ ] **Step 9: Rewrite `EnquiryInbox.tsx` as the orchestrator**

Replace the whole file with:

```tsx
"use client";

/**
 * Enquiry inbox (BACKOFHOUSE-IA E1/E2). Owns the filter state and composes the
 * pieces: InboxFilters (tabs + dropdowns), EnquiryList (rows + detail dialog),
 * and the toaster every action reports through. Every authorisation decision
 * belongs to the server actions, not to this island.
 */
import { useMemo, useState } from "react";
import type { EnquirySource, EnquiryStatus } from "@prisma/client";
import { Toaster } from "@/components/ui/sonner";
import { enquiryStatusLabel } from "../_shared/labels";
import {
  countByStatus,
  distinctStyles,
  filterEnquiries,
} from "./enquiry-helpers";
import { InboxFilters } from "./InboxFilters";
import { EnquiryList } from "./EnquiryList";
import { ALL, type ArtistOption, type EnquiryItem } from "./inbox-shared";

export type { ArtistOption, EnquiryItem } from "./inbox-shared";

export function EnquiryInbox({
  items,
  artists,
  canConvert,
  viewerArtistId,
  showAssignedPill,
}: {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
  viewerArtistId: string | null;
  /** Owners see who owns each lead; artists see only an Unassigned flag. */
  showAssignedPill: boolean;
}) {
  const [tab, setTab] = useState<EnquiryStatus>("new");
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const counts = useMemo(() => countByStatus(items), [items]);
  const styles = useMemo(() => distinctStyles(items), [items]);

  const visible = filterEnquiries(
    items.filter((i) => i.status === tab),
    {
      artistId: artistFilter === ALL ? null : artistFilter,
      style: styleFilter === ALL ? null : styleFilter,
      source: sourceFilter === ALL ? null : (sourceFilter as EnquirySource),
    },
  );

  return (
    <div className="space-y-5">
      <InboxFilters
        tab={tab}
        onTabChange={setTab}
        counts={counts}
        artists={artists}
        styles={styles}
        artistFilter={artistFilter}
        styleFilter={styleFilter}
        sourceFilter={sourceFilter}
        onArtistFilter={setArtistFilter}
        onStyleFilter={setStyleFilter}
        onSourceFilter={setSourceFilter}
      />
      <EnquiryList
        items={visible}
        artists={artists}
        canConvert={canConvert}
        viewerArtistId={viewerArtistId}
        showAssignedPill={showAssignedPill}
        emptyLabel={enquiryStatusLabel(tab).toLowerCase()}
      />
      <Toaster position="top-center" />
    </div>
  );
}
```

- [ ] **Step 10: Run the whole enquiries suite**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: PASS — the four new files **and** the untouched `EnquiryInbox.test.tsx`, `EnquiryThread.test.tsx`, `EnquiryDetailSections.test.tsx`, `enquiry-helpers.test.ts`, `actions.test.ts`, `page.test.tsx`.

- [ ] **Step 11: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean. (`EnquiryInbox.tsx` re-exports the moved types, so `page.tsx` still resolves `EnquiryItem` and `ArtistOption` from it.)

- [ ] **Step 12: Commit**

```bash
git add "apps/admin/src/app/(staff)/enquiries/inbox-shared.ts" "apps/admin/src/app/(staff)/enquiries/InboxFilters.tsx" "apps/admin/src/app/(staff)/enquiries/InboxFilters.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryMeta.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryMeta.test.tsx" "apps/admin/src/app/(staff)/enquiries/ReplyComposer.tsx" "apps/admin/src/app/(staff)/enquiries/ReplyComposer.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx"
git commit -m "refactor(enquiries): split EnquiryInbox into filters, list, meta and composer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 2: Reply-channel reachability + a server-validated `channel` override

The pure decision ("which channels can this thread be answered on, and why not?") plus `replyToEnquiry` accepting an override and re-deciding it server-side. No UI in this task — the composer arrives in Task 3.

**Files:**
- Modify: `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`, `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`, `apps/admin/src/app/(staff)/enquiries/actions.ts`, `apps/admin/src/app/(staff)/enquiries/actions.test.ts`

**Interfaces:**
- Consumes (Phase 2 + Phase 3, verbatim):
  ```ts
  // @bnb/core/services/channels/email  (barrel over email-outbound.ts)
  export const ENQUIRY_EMAIL_CONTEXT_SELECT: Prisma.EnquirySelect  // id, threadToken, customerId, contactName,
    // contactEmail, subject, lastInboundAt, preferredArtist{name}, customer{email},
    // messages: { where: { direction: "inbound" }, orderBy: [{createdAt:"desc"},{id:"desc"}], take: 1,
    //             select: { channel, subject, messageIdHeader, fromAddress, connectionId } }
  export interface EnquiryEmailContext {
    enquiryId: string; threadToken: string; customerId: string | null;
    contactName: string; contactEmail: string | null; subject: string | null;
    artistName: string | null; lastInboundChannel: MessageChannelKind | null;
    lastInboundMessageId: string | null; lastInboundSubject: string | null;
    lastInboundFromAddress: string | null; lastInboundConnectionId: string | null;
    lastInboundAt: Date | null;
  }
  export function toEnquiryEmailContext(enquiry: EnquiryEmailContextRow): EnquiryEmailContext
  export async function sendEnquiryEmail(input: { context: EnquiryEmailContext; body: string; authorUserId: string; authorDisplayName?: string | null }): Promise<SendEmailResult>

  // @bnb/core/services/channels/meta
  export const META_SEND_WINDOW_MS = 86_400_000;
  export class MetaWindowClosedError extends Error { readonly channel: MetaChannelKind }
  export type MetaChannelKind = "messenger" | "instagram";

  // @bnb/core/services/channels/meta-outbound
  export interface MetaReplyTarget { connection: MetaConnection; channel: MetaChannelKind; recipientId: string }
  export async function loadMetaReplyTarget(context: Pick<EnquiryEmailContext, "lastInboundChannel" | "lastInboundConnectionId" | "lastInboundFromAddress">): Promise<MetaReplyTarget | null>
  export async function sendEnquiryMetaMessage(input: { context: EnquiryEmailContext; target: MetaReplyTarget; body: string; authorUserId: string }): Promise<{ messageIds: string[] }>
  export function partsSentFrom(err: unknown): { sentParts: number; totalParts: number }

  // ./enquiry-helpers.ts (Phase 3)
  export type ReplyChannel = "email" | "messenger" | "instagram" | "none";
  export const REPLY_CHANNEL_LABEL: Record<Exclude<ReplyChannel, "none">, string>; // { email: "email", messenger: "Messenger", instagram: "Instagram" }
  export function chooseReplyChannel(input: { lastInboundChannel: MessageChannelKind | null; hasEmail: boolean; metaTargetReady: boolean }): ReplyChannel
  ```
- Produces:
  ```ts
  // ./enquiry-helpers.ts
  export type ComposerChannel = "email" | "messenger" | "instagram" | "note";
  export const COMPOSER_CHANNEL_LABEL: Record<ComposerChannel, string>;
  export interface ReplyReachability {
    contactEmail: string | null;
    metaChannel: "messenger" | "instagram" | null;
    metaTargetReady: boolean;
    /** ISO instant the Meta 24-hour window shuts, or null when there is none. */
    metaWindowClosesAtISO: string | null;
  }
  export interface ReplyChannelOption {
    channel: ComposerChannel;
    label: string;
    available: boolean;
    hint: string;
  }
  export function replyChannelOptions(reach: ReplyReachability, nowMs?: number): ReplyChannelOption[];
  export function defaultComposerChannel(reach: ReplyReachability, nowMs?: number): ComposerChannel;
  export type ComposerChannelChoice =
    | { ok: true; channel: ComposerChannel }
    | { ok: false; error: string };
  export function resolveComposerChannel(requested: string | null | undefined, reach: ReplyReachability, nowMs?: number): ComposerChannelChoice;

  // ./actions.ts
  export async function replyToEnquiry(enquiryId: string, input: { message: string; channel?: ComposerChannel }): Promise<ActionState>;
  ```

- [ ] **Step 1: Write the failing pure tests**

Append to `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`:

```ts
import {
  defaultComposerChannel,
  replyChannelOptions,
  resolveComposerChannel,
  type ReplyReachability,
} from "./enquiry-helpers";

const NOW = Date.parse("2026-09-08T12:00:00.000Z");
/** The customer wrote at 09:00, so the window shuts the next day at 09:00. */
const OPEN_UNTIL = "2026-09-09T09:00:00.000Z";
const SHUT_AT = "2026-09-07T09:00:00.000Z";

const EMAIL_ONLY: ReplyReachability = {
  contactEmail: "amy@example.test",
  metaChannel: null,
  metaTargetReady: false,
  metaWindowClosesAtISO: null,
};
const LIVE_MESSENGER: ReplyReachability = {
  contactEmail: "amy@example.test",
  metaChannel: "messenger",
  metaTargetReady: true,
  metaWindowClosesAtISO: OPEN_UNTIL,
};

function option(reach: ReplyReachability, channel: string) {
  return replyChannelOptions(reach, NOW).find((o) => o.channel === channel)!;
}

describe("replyChannelOptions", () => {
  it("always offers all four channels, in a stable order", () => {
    expect(replyChannelOptions(EMAIL_ONLY, NOW).map((o) => o.channel)).toEqual([
      "email",
      "messenger",
      "instagram",
      "note",
    ]);
  });

  it("names the address email will go to, and refuses when there is none", () => {
    expect(option(EMAIL_ONLY, "email")).toMatchObject({
      available: true,
      label: "Email",
    });
    expect(option(EMAIL_ONLY, "email").hint).toContain("amy@example.test");
    const noEmail = option({ ...EMAIL_ONLY, contactEmail: null }, "email");
    expect(noEmail.available).toBe(false);
    expect(noEmail.hint).toBe("No email address on file for this customer.");
  });

  it("offers only the Meta channel this thread actually arrived on", () => {
    expect(option(LIVE_MESSENGER, "messenger").available).toBe(true);
    const ig = option(LIVE_MESSENGER, "instagram");
    expect(ig.available).toBe(false);
    expect(ig.hint).toBe("No Instagram conversation on this thread.");
  });

  it("says when the Page behind a Meta thread is not connected", () => {
    const dead = option(
      { ...LIVE_MESSENGER, metaTargetReady: false },
      "messenger",
    );
    expect(dead.available).toBe(false);
    expect(dead.hint).toBe(
      "That Page is not connected — reconnect it in Studio › Channels.",
    );
  });

  it("shows the closing time of an open window and of a shut one", () => {
    expect(option(LIVE_MESSENGER, "messenger").hint).toMatch(/^Open until 09 Sep/);
    const shut = option(
      { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT },
      "messenger",
    );
    expect(shut.available).toBe(false);
    expect(shut.hint).toMatch(
      /^The 24-hour reply window closed at 07 Sep .* — reply by email instead\.$/,
    );
  });

  it("treats a Meta thread with no inbound timestamp as shut, not as open", () => {
    const none = option(
      { ...LIVE_MESSENGER, metaWindowClosesAtISO: null },
      "messenger",
    );
    expect(none.available).toBe(false);
    expect(none.hint).toBe(
      "The 24-hour reply window is closed — reply by email instead.",
    );
  });

  it("always offers the internal note", () => {
    const note = option(
      { contactEmail: null, metaChannel: null, metaTargetReady: false, metaWindowClosesAtISO: null },
      "note",
    );
    expect(note).toMatchObject({
      available: true,
      label: "Internal note",
      hint: "Saved on the thread for staff only — never sent.",
    });
  });
});

describe("defaultComposerChannel", () => {
  it("prefers the live Meta channel the customer last used", () => {
    expect(defaultComposerChannel(LIVE_MESSENGER, NOW)).toBe("messenger");
  });

  it("falls back to email when the Meta window has shut", () => {
    expect(
      defaultComposerChannel(
        { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT },
        NOW,
      ),
    ).toBe("email");
  });

  it("falls back to the internal note when nothing can be sent", () => {
    expect(
      defaultComposerChannel(
        { contactEmail: null, metaChannel: "instagram", metaTargetReady: false, metaWindowClosesAtISO: null },
        NOW,
      ),
    ).toBe("note");
  });
});

describe("resolveComposerChannel", () => {
  it("uses the default when the caller asked for nothing", () => {
    expect(resolveComposerChannel(null, LIVE_MESSENGER, NOW)).toEqual({
      ok: true,
      channel: "messenger",
    });
  });

  it("honours a reachable override", () => {
    expect(resolveComposerChannel("email", LIVE_MESSENGER, NOW)).toEqual({
      ok: true,
      channel: "email",
    });
  });

  it("refuses an unreachable override with that option's own reason", () => {
    const shut = { ...LIVE_MESSENGER, metaWindowClosesAtISO: SHUT_AT };
    const res = resolveComposerChannel("messenger", shut, NOW);
    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: option(shut, "messenger").hint });
  });

  it("refuses a value that is not a channel at all", () => {
    expect(resolveComposerChannel("carrier-pigeon", LIVE_MESSENGER, NOW)).toEqual({
      ok: false,
      error: "Choose a channel to reply on.",
    });
  });
});
```

- [ ] **Step 2: Run the pure tests to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/enquiry-helpers.test.ts"`
Expected: FAIL — `replyChannelOptions is not a function` / no exported member.

- [ ] **Step 3: Implement the channel model in `enquiry-helpers.ts`**

Append (keeping `chooseReplyChannel` and `REPLY_CHANNEL_LABEL` exactly as they are — the Meta send path and its messages still use them):

```ts
/** Everything the composer can select, including the one that never sends. */
export type ComposerChannel = "email" | "messenger" | "instagram" | "note";

export const COMPOSER_CHANNEL_LABEL: Record<ComposerChannel, string> = {
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
  note: "Internal note",
};

/** The four channels, in the order the selector lists them. */
const COMPOSER_CHANNELS: ComposerChannel[] = [
  "email",
  "messenger",
  "instagram",
  "note",
];

/**
 * What this thread can actually be answered on, as facts rather than verdicts.
 * Built once from `toEnquiryEmailContext` (+ `loadMetaReplyTarget`) so the page
 * and the server action ask the identical question of the identical data.
 */
export interface ReplyReachability {
  /** The address a reply would go to, after the context's own fallbacks. */
  contactEmail: string | null;
  /** The Meta channel of the last inbound message, if it was one. */
  metaChannel: "messenger" | "instagram" | null;
  /** An active Page with a readable token AND a recipient id to send to. */
  metaTargetReady: boolean;
  /** ISO instant the Meta 24-hour window shuts, or null when there is none. */
  metaWindowClosesAtISO: string | null;
}

export interface ReplyChannelOption {
  channel: ComposerChannel;
  label: string;
  available: boolean;
  /**
   * One sentence: what this channel will do, or why it cannot. Doubles as the
   * server's refusal message, so staff read the same words either way.
   */
  hint: string;
}

function metaOption(
  channel: "messenger" | "instagram",
  reach: ReplyReachability,
  nowMs: number,
): ReplyChannelOption {
  const label = COMPOSER_CHANNEL_LABEL[channel];
  const base = { channel, label } as const;
  if (reach.metaChannel !== channel) {
    return {
      ...base,
      available: false,
      hint: `No ${label} conversation on this thread.`,
    };
  }
  if (!reach.metaTargetReady) {
    return {
      ...base,
      available: false,
      hint: "That Page is not connected — reconnect it in Studio › Channels.",
    };
  }
  const closesAt = reach.metaWindowClosesAtISO;
  // No inbound timestamp means no window has ever opened. Meta's rule is
  // "within 24 hours of THEIR message", so the honest answer is "closed" —
  // treating unknown as open would send a policy violation.
  if (!closesAt) {
    return {
      ...base,
      available: false,
      hint: "The 24-hour reply window is closed — reply by email instead.",
    };
  }
  if (Date.parse(closesAt) <= nowMs) {
    return {
      ...base,
      available: false,
      hint: `The 24-hour reply window closed at ${formatDateTime(closesAt)} — reply by email instead.`,
    };
  }
  return { ...base, available: true, hint: `Open until ${formatDateTime(closesAt)}.` };
}

/**
 * Every channel the composer lists, each with whether it can be used and why.
 * Unavailable channels are still listed: "Instagram is greyed out because the
 * 24-hour window shut at 14:05" is information; a missing option is a mystery.
 */
export function replyChannelOptions(
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ReplyChannelOption[] {
  return COMPOSER_CHANNELS.map((channel) => {
    if (channel === "email") {
      return reach.contactEmail
        ? {
            channel,
            label: COMPOSER_CHANNEL_LABEL.email,
            available: true,
            hint: `Sends to ${reach.contactEmail}.`,
          }
        : {
            channel,
            label: COMPOSER_CHANNEL_LABEL.email,
            available: false,
            hint: "No email address on file for this customer.",
          };
    }
    if (channel === "note") {
      return {
        channel,
        label: COMPOSER_CHANNEL_LABEL.note,
        available: true,
        hint: "Saved on the thread for staff only — never sent.",
      };
    }
    return metaOption(channel, reach, nowMs);
  });
}

/**
 * The channel the composer opens on: `chooseReplyChannel`'s pick (the channel
 * the customer last used), unless that pick is unavailable — a live Page whose
 * 24-hour window has shut would otherwise open a composer that cannot send.
 * The fallback walks the option list, so it lands on email, then the note.
 */
export function defaultComposerChannel(
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ComposerChannel {
  const options = replyChannelOptions(reach, nowMs);
  const preferred = chooseReplyChannel({
    lastInboundChannel: reach.metaChannel,
    hasEmail: Boolean(reach.contactEmail),
    metaTargetReady: reach.metaTargetReady,
  });
  const pick = preferred === "none" ? "note" : preferred;
  if (options.find((o) => o.channel === pick)?.available) return pick;
  return options.find((o) => o.available)?.channel ?? "note";
}

export type ComposerChannelChoice =
  | { ok: true; channel: ComposerChannel }
  | { ok: false; error: string };

/**
 * Turn whatever the browser sent into a channel we are willing to use.
 * SECURITY: the client's selector is a convenience — this is the decision.
 * A refusal reuses the option's own hint so the sentence staff read under the
 * selector is the sentence they get back.
 */
export function resolveComposerChannel(
  requested: string | null | undefined,
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ComposerChannelChoice {
  if (!requested) {
    return { ok: true, channel: defaultComposerChannel(reach, nowMs) };
  }
  const option = replyChannelOptions(reach, nowMs).find(
    (o) => o.channel === requested,
  );
  if (!option) return { ok: false, error: "Choose a channel to reply on." };
  if (!option.available) return { ok: false, error: option.hint };
  return { ok: true, channel: option.channel };
}
```

Add the import at the top of the file:

```ts
import { formatDateTime } from "../_shared/labels";
```

- [ ] **Step 4: Run the pure tests to verify they pass**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/enquiry-helpers.test.ts"`
Expected: PASS.

- [ ] **Step 5: Write the failing action tests**

In `apps/admin/src/app/(staff)/enquiries/actions.test.ts`, first **fix the existing Meta block's clock**. `metaEnquiry()` pins `lastInboundAt` to `2026-09-08T09:00:00Z`; now that the action evaluates the 24-hour window itself, those cases must not depend on the wall clock. Add to `describe("replyToEnquiry on a Meta thread", …)`, as its first statements:

```ts
  // The window is now decided before the send, so these cases need a fixed
  // "now" — otherwise they pass today and fail the day after tomorrow.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
```

and extend the vitest import at the top of the file to `import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";`.

Then append a new block:

```ts
describe("replyToEnquiry channel override", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emails a live Messenger thread when staff explicitly choose email", async () => {
    metaEnquiry({
      contactEmail: "amy@example.test",
      customer: { email: "amy@example.test" },
    });
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);

    const res = await replyToEnquiry("e1", {
      message: "Sending this by email instead.",
      channel: "email",
    });

    expect(res.ok).toBe(true);
    expect(sendEnquiryEmail).toHaveBeenCalled();
    expect(sendEnquiryMetaMessage).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("refuses a Messenger override once the 24-hour window has shut, naming the time", async () => {
    metaEnquiry({ lastInboundAt: new Date("2026-09-06T09:00:00.000Z") });
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);

    const res = await replyToEnquiry("e1", {
      message: "Still there?",
      channel: "messenger",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/24-hour reply window closed at 07 Sep/);
    expect(sendEnquiryMetaMessage).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("refuses a channel this thread never used", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);

    const res = await replyToEnquiry("e1", {
      message: "Hello",
      channel: "instagram",
    });

    expect(res).toEqual({
      ok: false,
      message: "No Instagram conversation on this thread.",
    });
  });

  it("refuses a channel that is not a channel", async () => {
    const res = await replyToEnquiry("e1", {
      message: "Hello",
      channel: "carrier-pigeon" as never,
    });
    expect(res).toEqual({ ok: false, message: "Choose a channel to reply on." });
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });

  it("writes a plain internal note for an explicit note, without the not-sent suffix", async () => {
    const res = await replyToEnquiry("e1", {
      message: "Chased on the phone.",
      channel: "note",
    });

    expect(res).toEqual({
      ok: true,
      message: "Note added to the thread — nothing was sent.",
    });
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: "Chased on the phone.",
    });
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the action tests to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/actions.test.ts"`
Expected: FAIL — the override cases fall through to the email path (`channel` is ignored), and the note case reports "No reachable channel…".

- [ ] **Step 7: Teach `replyToEnquiry` the override**

In `apps/admin/src/app/(staff)/enquiries/actions.ts`, add to the imports:

```ts
import { META_SEND_WINDOW_MS } from "@bnb/core/services/channels/meta";
```
and extend the `./enquiry-helpers` import with `resolveComposerChannel`, `type ComposerChannel`, `type ReplyReachability`.

Add above `replyToEnquiry`:

```ts
/**
 * The one place reachability is computed from a loaded context. The page
 * builds the identical object for the selector; this is the copy that decides.
 */
function reachabilityOf(
  context: EnquiryEmailContext,
  metaTarget: { channel: "messenger" | "instagram" } | null,
): ReplyReachability {
  return {
    contactEmail: context.contactEmail,
    metaChannel: metaTarget?.channel ?? null,
    metaTargetReady: metaTarget != null,
    metaWindowClosesAtISO: context.lastInboundAt
      ? new Date(
          context.lastInboundAt.getTime() + META_SEND_WINDOW_MS,
        ).toISOString()
      : null,
  };
}
```
(`EnquiryEmailContext` comes from the existing `@bnb/core/services/channels/email` import — add it as a `type` member of that import.)

Replace the top of `replyToEnquiry` (everything from its signature down to and including the `const channel = chooseReplyChannel({...})` block) with:

```ts
export async function replyToEnquiry(
  enquiryId: string,
  input: { message: string; channel?: ComposerChannel },
): Promise<ActionState> {
  const { user, enquiry } = await loadEnquiryScoped(enquiryId);
  const valid = validateReply(input);
  if (!valid.ok) return { ok: false, message: valid.error };

  // The scoped read above already carries ENQUIRY_EMAIL_CONTEXT_SELECT, and
  // `findUniqueOrThrow` has already covered the "no longer exists" case.
  const context = toEnquiryEmailContext(enquiry);

  // Resolved first, because "can we reply on Meta?" is the question that
  // decides the channel — not a consequence of having picked it.
  const metaTarget = await loadMetaReplyTarget(context);
  const reach = reachabilityOf(context, metaTarget);
  // SECURITY: whatever the browser selected is re-decided here against rows
  // it cannot see. A stale composer (the window shut while it sat open) is
  // refused with the same sentence it would have shown.
  const choice = resolveComposerChannel(input.channel ?? null, reach);
  if (!choice.ok) return { ok: false, message: choice.error };
  const channel = choice.channel;

  if (channel === "note" && input.channel === "note") {
    // Staff chose the note deliberately: exactly `addInternalNote` semantics —
    // no claim, no status change, no "not sent" apology for something nobody
    // tried to send.
    await recordNote({
      enquiryId,
      authorUserId: user.id,
      bodyText: valid.message,
    });
    revalidatePath("/enquiries");
    return { ok: true, message: "Note added to the thread — nothing was sent." };
  }
```

Then change the existing derived-note branch's condition from `if (channel === "none")` to `if (channel === "note")` and **leave its body exactly as it is** — the `— Not sent: this customer has no reachable channel…` suffix, the claim, and the "No reachable channel — saved as an internal note (nothing was sent)." message are unchanged behaviour for the case where nothing was reachable.

The Meta branch's condition is unchanged (`if (metaTarget && (channel === "messenger" || channel === "instagram"))`), as is the whole of its body — including the partial-send message `Part of the reply was sent (${sentParts} of ${totalParts}) — the rest failed; send only the remainder.` and the `MetaWindowClosedError` catch, which now only fires on the race between resolve and send.

- [ ] **Step 8: Run the action tests to verify they pass**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/actions.test.ts"`
Expected: PASS — the five new cases and every pre-existing one, including "surfaces the 24-hour window as a composer error" (now a genuine race: the window is open at resolve time and the mocked send rejects).

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts" "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts" "apps/admin/src/app/(staff)/enquiries/actions.ts" "apps/admin/src/app/(staff)/enquiries/actions.test.ts"
git commit -m "feat(enquiries): reply-channel reachability and a server-validated channel override

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 3: The composer's channel selector

The UI half of ruling 2: one body box with an explicit **Email / Messenger / Instagram / Internal note** selector, unreachable channels disabled with their reason showing, so a shut Meta window is answered by email without leaving the dialog.

**Files:**
- Modify: `apps/admin/src/app/(staff)/enquiries/ReplyComposer.tsx`, `ReplyComposer.test.tsx`, `EnquiryList.tsx`, `inbox-shared.ts`, `EnquiryInbox.test.tsx`, `EnquiryList.test.tsx`, `EnquiryMeta.test.tsx`, `page.tsx`

**Interfaces:**
- Consumes: `replyChannelOptions`, `defaultComposerChannel`, `ComposerChannel`, `ReplyChannelOption`, `ReplyReachability` (T2); `ENQUIRY_EMAIL_CONTEXT_SELECT` / `toEnquiryEmailContext` / `META_SEND_WINDOW_MS` (quoted in T2); plus, verbatim:
  ```ts
  // @bnb/core/services/channel-connections
  export interface ChannelConnectionRow {
    id: string; channel: "messenger" | "instagram"; externalId: string; pageId: string;
    igAccountId: string | null; name: string; active: boolean;
    webhookSubscribedAt: Date | null; lastEventAt: Date | null; connectedAt: Date;
    tokenReadable: boolean;
  }
  export async function listChannelConnections(): Promise<ChannelConnectionRow[]>
  ```
- Produces:
  ```ts
  // inbox-shared.ts — EnquiryItem gains:
  replyOptions: ReplyChannelOption[];
  defaultReplyChannel: ComposerChannel;

  // ReplyComposer.tsx
  export interface ReplyComposerProps {
    enquiryId: string;
    source: EnquirySource;
    claimsOnReply: boolean;
    options: ReplyChannelOption[];
    defaultChannel: ComposerChannel;
    onSent: () => void;
  }
  ```

- [ ] **Step 1: Write the failing composer test**

Replace the body of `apps/admin/src/app/(staff)/enquiries/ReplyComposer.test.tsx` (keep the `vi.mock("./actions", …)` preamble) with:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

import { ReplyComposer } from "./ReplyComposer";
import type { ReplyChannelOption } from "./enquiry-helpers";

const OPTIONS: ReplyChannelOption[] = [
  {
    channel: "email",
    label: "Email",
    available: true,
    hint: "Sends to amy@example.test.",
  },
  {
    channel: "messenger",
    label: "Messenger",
    available: false,
    hint: "The 24-hour reply window closed at 07 Sep 2026, 10:00 — reply by email instead.",
  },
  {
    channel: "instagram",
    label: "Instagram",
    available: false,
    hint: "No Instagram conversation on this thread.",
  },
  {
    channel: "note",
    label: "Internal note",
    available: true,
    hint: "Saved on the thread for staff only — never sent.",
  },
];

describe("ReplyComposer", () => {
  it("opens on the default channel and shows that channel's hint", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(triggers).toContain("Email");
    expect(html).toContain("Sends to amy@example.test.");
    expect(html).toContain("Send reply");
  });

  it("disables an unreachable channel and still shows why", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    // The shut window is legible without opening the dropdown: that sentence
    // is the whole point of the selector.
    expect(html).toContain("24-hour reply window closed at 07 Sep 2026");
    expect(html).toContain("No Instagram conversation on this thread.");
  });

  it("labels the send button as a note when the note channel is the default", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="note"
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("Add note");
    expect(html).not.toContain("Send reply");
    expect(html).toContain("Saved on the thread for staff only — never sent.");
  });

  it("warns an artist that replying to an unassigned enquiry takes it", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="inkling"
        claimsOnReply
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("assigns it to you");
    expect(html).toContain("Respond");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/ReplyComposer.test.tsx"`
Expected: FAIL — `options` / `defaultChannel` are not props, and no hint text is rendered.

- [ ] **Step 3: Rewrite `ReplyComposer.tsx`**

```tsx
"use client";

/**
 * The composer. One body box, one explicit channel: Email, Messenger,
 * Instagram or an internal note. Channels this thread cannot use are listed
 * but disabled, with the reason in plain sight — a Meta 24-hour window that
 * shut at 14:05 is something staff need to READ, not something to hide, and
 * the answer ("email them instead") is one click away in the same control.
 *
 * The selector is a convenience: `replyToEnquiry` re-decides the channel
 * server-side from rows the browser cannot see.
 */
import { useState } from "react";
import type { EnquirySource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerChannel, ReplyChannelOption } from "./enquiry-helpers";
import { useAction } from "./inbox-shared";
import { addInternalNote, replyToEnquiry } from "./actions";

export interface ReplyComposerProps {
  enquiryId: string;
  /** Inkling boards say "Respond" rather than "Send reply". */
  source: EnquirySource;
  /** True when this viewer replying would also take the enquiry. */
  claimsOnReply: boolean;
  /** Every channel, reachable or not, with its reason. */
  options: ReplyChannelOption[];
  /** Where the selector starts — the customer's channel when it is usable. */
  defaultChannel: ComposerChannel;
  /** Called after a successful send, so the dialog can close. */
  onSent: () => void;
}

export function ReplyComposer({
  enquiryId,
  source,
  claimsOnReply,
  options,
  defaultChannel,
  onSent,
}: ReplyComposerProps) {
  const { pending, run } = useAction();
  const [channel, setChannel] = useState<ComposerChannel>(defaultChannel);
  const [body, setBody] = useState("");
  const selected = options.find((o) => o.channel === channel) ?? null;
  const isNote = channel === "note";
  const selectItems = options.map((o) => ({
    value: o.channel,
    label: o.available ? o.label : `${o.label} — unavailable`,
  }));

  const label = isNote
    ? "Internal note (staff only — never sent)"
    : claimsOnReply
      ? "Reply (responding to an unassigned enquiry assigns it to you)"
      : "Reply";

  return (
    <section className="space-y-2">
      <Label htmlFor={`reply-${enquiryId}`}>{label}</Label>
      <Select
        items={selectItems}
        value={channel}
        onValueChange={(v) => setChannel((v as ComposerChannel) ?? defaultChannel)}
      >
        <SelectTrigger className="w-56" aria-label="Reply channel">
          <SelectValue placeholder="Choose a channel" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.channel} value={o.channel} disabled={!o.available}>
              {o.available ? o.label : `${o.label} — unavailable`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <p
          className={
            selected.available
              ? "text-xs text-text-muted"
              : "text-xs text-bb-gold"
          }
        >
          {selected.hint}
        </p>
      )}
      {/*
        Every unavailable reason, always visible. The selected channel's hint
        above answers "what will this do?"; this list answers "why can't I use
        the one I wanted?" without making staff open the dropdown to find out.
      */}
      <ul className="space-y-0.5">
        {options
          .filter((o) => !o.available && o.channel !== channel)
          .map((o) => (
            <li key={o.channel} className="text-xs text-text-muted">
              {o.label}: {o.hint}
            </li>
          ))}
      </ul>
      <Textarea
        id={`reply-${enquiryId}`}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isNote
            ? "Context for whoever picks this up…"
            : "Thanks for getting in touch…"
        }
      />
      <Button
        disabled={pending || !body.trim() || !selected?.available}
        onClick={() =>
          isNote
            ? // A note is not a reply: no claim, no status change, and the
              // dialog stays open because several notes in a row is normal.
              run(async () => {
                const res = await addInternalNote(enquiryId, { body });
                if (res.ok) setBody("");
                return res;
              })
            : run(() => replyToEnquiry(enquiryId, { message: body, channel }), {
                onSuccess: onSent,
              })
        }
      >
        {isNote ? "Add note" : source === "inkling" ? "Respond" : "Send reply"}
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: Carry the options through the item payload**

In `inbox-shared.ts`, add to `EnquiryItem` (and the import line `import type { ComposerChannel, ReplyChannelOption } from "./enquiry-helpers";`):

```ts
  /** Every reply channel with its availability, computed server-side. */
  replyOptions: ReplyChannelOption[];
  /** Which one the composer opens on. */
  defaultReplyChannel: ComposerChannel;
```

In `EnquiryList.tsx`, pass them down:

```tsx
        <ReplyComposer
          enquiryId={item.id}
          source={item.source}
          claimsOnReply={Boolean(viewerArtistId) && isUnassigned(item)}
          options={item.replyOptions}
          defaultChannel={item.defaultReplyChannel}
          onSent={() => setOpen(false)}
        />
```

- [ ] **Step 5: Compute reachability in `page.tsx`**

Replace the enquiry query and add the mapping. The `findMany` gains an explicit select that spreads the reply context — this is what lets the page use the *same* `toEnquiryEmailContext` the action uses instead of re-deriving "last inbound" from thread rows:

```tsx
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  toEnquiryEmailContext,
} from "@bnb/core/services/channels/email";
import { META_SEND_WINDOW_MS } from "@bnb/core/services/channels/meta";
import { listChannelConnections } from "@bnb/core/services/channel-connections";
import {
  defaultComposerChannel,
  replyChannelOptions,
  type ReplyReachability,
} from "./enquiry-helpers";
```

```tsx
  const [enquiries, artists, unread, connections] = await Promise.all([
    prisma.enquiry.findMany({
      where: owner ? {} : artistInboxWhere(user.artistId ?? null),
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        // The reply context (contact email fallbacks, last inbound channel,
        // connection and timestamp) plus everything a row renders.
        ...ENQUIRY_EMAIL_CONTEXT_SELECT,
        style: true,
        placement: true,
        size: true,
        budgetPence: true,
        description: true,
        moodboard: true,
        moodboardData: true,
        status: true,
        source: true,
        channel: true,
        preferredArtistId: true,
        createdAt: true,
        lastMessageAt: true,
      },
    }),
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    unreadCountsFor(viewer),
    listChannelConnections(),
  ]);

  // A Meta reply needs a live Page behind the last inbound message. Reading
  // every connection once (a handful of rows) answers that for all 300
  // enquiries without a per-row query.
  const connectionById = new Map(connections.map((c) => [c.id, c]));
  const now = Date.now();

  function reachabilityFor(
    context: ReturnType<typeof toEnquiryEmailContext>,
  ): ReplyReachability {
    const channel = context.lastInboundChannel;
    const metaChannel =
      channel === "messenger" || channel === "instagram" ? channel : null;
    const connection = context.lastInboundConnectionId
      ? (connectionById.get(context.lastInboundConnectionId) ?? null)
      : null;
    return {
      contactEmail: context.contactEmail,
      metaChannel,
      // Mirrors loadMetaReplyTarget: a live connection AND someone to send to.
      metaTargetReady: Boolean(
        metaChannel &&
          connection?.active &&
          connection.tokenReadable &&
          context.lastInboundFromAddress,
      ),
      metaWindowClosesAtISO: context.lastInboundAt
        ? new Date(context.lastInboundAt.getTime() + META_SEND_WINDOW_MS).toISOString()
        : null,
    };
  }
```

and the `items` mapping becomes (every existing field kept, two added):

```tsx
  const items: EnquiryItem[] = enquiries.map((e) => {
    const reach = reachabilityFor(toEnquiryEmailContext(e));
    return {
      id: e.id,
      contactName: e.contactName,
      contactEmail: e.contactEmail,
      subject: e.subject,
      style: e.style,
      placement: e.placement,
      size: e.size,
      budgetPence: e.budgetPence,
      description: e.description,
      moodboard: e.moodboard,
      moodboardData: parseMoodboardData(e.moodboardData),
      status: e.status,
      source: e.source,
      channel: e.channel,
      preferredArtistId: e.preferredArtistId,
      preferredArtistName: e.preferredArtistId
        ? (artistName.get(e.preferredArtistId) ?? null)
        : null,
      createdAtISO: e.createdAt.toISOString(),
      lastMessageAtISO: e.lastMessageAt?.toISOString() ?? null,
      unread: unreadIds.has(e.id),
      thread: toThreadItems(e.id),
      replyOptions: replyChannelOptions(reach, now),
      defaultReplyChannel: defaultComposerChannel(reach, now),
    };
  });
```

**Staleness:** these options are computed at render. A window that shuts while the dialog sits open is caught twice — the layout's 60 s `router.refresh()` redraws them, and `replyToEnquiry` re-decides before sending.

- [ ] **Step 6: Update the fixtures the split tests share**

`EnquiryItem` gained two required fields, so the `ITEM`/`items` fixtures in `EnquiryList.test.tsx`, `EnquiryMeta.test.tsx` and `EnquiryInbox.test.tsx` each gain:

```ts
  replyOptions: [
    { channel: "email", label: "Email", available: true, hint: "Sends to amy@example.test." },
    { channel: "messenger", label: "Messenger", available: false, hint: "No Messenger conversation on this thread." },
    { channel: "instagram", label: "Instagram", available: false, hint: "No Instagram conversation on this thread." },
    { channel: "note", label: "Internal note", available: true, hint: "Saved on the thread for staff only — never sent." },
  ],
  defaultReplyChannel: "email" as const,
```

In `EnquiryInbox.test.tsx`, change the one assertion that named the old label:

```ts
    expect(html).toContain("Internal note (staff only — never sent)");
```
becomes
```ts
    // The note is now a channel on the single composer, not a second box.
    expect(html).toContain("Internal note");
```

- [ ] **Step 7: Run the enquiries suite**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add "apps/admin/src/app/(staff)/enquiries/ReplyComposer.tsx" "apps/admin/src/app/(staff)/enquiries/ReplyComposer.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryMeta.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx" "apps/admin/src/app/(staff)/enquiries/inbox-shared.ts" "apps/admin/src/app/(staff)/enquiries/page.tsx"
git commit -m "feat(enquiries): composer channel selector with per-channel reachability

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 4: Visibility-scoped tab counts, a row-level Take this, and a badge poll that sleeps

Everything about *signalling*: how many enquiries each tab really holds for this viewer, the one-click take on an unassigned row, and stopping the 60 s refresh while nobody is looking.

**Files:**
- Create: `apps/admin/src/lib/refresh-poll.ts`, `apps/admin/src/lib/refresh-poll.test.ts`
- Modify: `packages/core/src/services/enquiry-messages.ts`, `packages/core/src/services/enquiry-messages.test.ts`, `apps/admin/src/components/admin/AppShell.tsx`, `apps/admin/src/app/(staff)/enquiries/page.tsx`, `EnquiryInbox.tsx`, `EnquiryInbox.test.tsx`, `EnquiryList.tsx`, `EnquiryList.test.tsx`

**Interfaces:**
- Consumes (Phase 1, verbatim):
  ```ts
  // packages/core/src/services/enquiry-messages.ts
  export interface InboxViewer { userId: string; role: "OWNER" | "ARTIST"; artistId: string | null }
  export function visibleEnquiryWhere(viewer: InboxViewer): Prisma.EnquiryWhereInput
  export async function unreadCountsFor(viewer: InboxViewer): Promise<{ total: number; enquiryIds: string[] }>
  // apps/admin/src/app/(staff)/enquiries/actions.ts
  export async function claimEnquiry(enquiryId: string): Promise<ActionState>
  ```
- Produces:
  ```ts
  // packages/core/src/services/enquiry-messages.ts
  export type EnquiryStatusCounts = Record<EnquiryStatus, number>;
  export async function statusCountsFor(viewer: InboxViewer): Promise<EnquiryStatusCounts>;

  // apps/admin/src/lib/refresh-poll.ts
  export const UNREAD_POLL_MS = 60_000;
  export function shouldRefreshNow(visibilityState: string | undefined): boolean;

  // EnquiryInbox.tsx props gain: counts: Record<EnquiryStatus, number>; truncated: boolean;
  //   (typed structurally, NOT as the core EnquiryStatusCounts — a client
  //    component must not reference a module that imports the Prisma client.)
  // EnquiryList.tsx props gain: truncated: boolean;
  ```

- [ ] **Step 1: Write the failing count test**

Append to `packages/core/src/services/enquiry-messages.test.ts` (inside the existing `describe("enquiry messages (DB)")`, which already owns the `customers` / `enquiries` cleanup arrays):

```ts
  it("tallies visible enquiries per status", async () => {
    if (!(await dbReachable())) return;
    // Artist.userId is required and unique, so the fixture creates its user
    // inline — the same shape reports.test.ts uses.
    const tag = uid();
    const artist = await db().artist.create({
      data: {
        slug: `tally-${tag}`,
        name: `Tally ${tag}`,
        user: {
          create: {
            email: `tally-${tag}@example.test`,
            displayName: `Tally ${tag}`,
          },
        },
      },
    });
    const viewer = {
      userId: artist.userId,
      role: "ARTIST" as const,
      artistId: artist.id,
    };
    // Deltas, not absolutes: an artist also sees every UNASSIGNED enquiry in
    // the shared dev database, so only the change this test causes is stable.
    const before = await statusCountsFor(viewer);
    for (const status of ["new", "new", "closed"] as const) {
      const e = await db().enquiry.create({
        data: {
          contactName: `Tally ${uid()}`,
          preferredArtistId: artist.id,
          status,
        },
      });
      enquiries.push(e.id);
    }
    const after = await statusCountsFor(viewer);
    expect(after.new - before.new).toBe(2);
    expect(after.closed - before.closed).toBe(1);
    expect(after.converted - before.converted).toBe(0);
    // Enquiries are cleaned up by the suite's afterAll; the artist and its
    // user are this test's own and go now (enquiry.preferredArtistId is
    // SetNull, so deleting the artist does not take the rows with it).
    await db().artist.delete({ where: { id: artist.id } });
    await db().user.delete({ where: { id: artist.userId } });
  });

  it("counts nothing for an artist user with no artist record", async () => {
    if (!(await dbReachable())) return;
    expect(
      await statusCountsFor({ userId: uid("u"), role: "ARTIST", artistId: null }),
    ).toEqual({
      new: 0,
      replied: 0,
      customer_replied: 0,
      converted: 0,
      closed: 0,
    });
  });
```

Add `statusCountsFor` to the import list at the top of that file.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts`
Expected: FAIL — `statusCountsFor is not a function`.

- [ ] **Step 3: Implement `statusCountsFor`**

Append to `packages/core/src/services/enquiry-messages.ts` (it belongs beside `visibleEnquiryWhere`, which defines what "visible" means):

```ts
export type EnquiryStatusCounts = Record<EnquiryStatus, number>;

const ZERO_COUNTS: EnquiryStatusCounts = {
  new: 0,
  replied: 0,
  customer_replied: 0,
  converted: 0,
  closed: 0,
};

/**
 * How many enquiries this viewer can see, per status — the numbers on the
 * inbox tabs.
 *
 * A `groupBy` rather than a tally of the rows the page loaded: the inbox
 * fetches the 300 most recent, and counting those would quietly under-report
 * a busy studio's Closed tab. Scoped by the same `visibleEnquiryWhere` as the
 * unread badge, so a tab can never promise an enquiry the viewer may not open.
 */
export async function statusCountsFor(
  viewer: InboxViewer,
): Promise<EnquiryStatusCounts> {
  const rows = await prisma.enquiry.groupBy({
    by: ["status"],
    where: visibleEnquiryWhere(viewer),
    _count: { _all: true },
  });
  const counts: EnquiryStatusCounts = { ...ZERO_COUNTS };
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}
```

Add `EnquiryStatus` to the `@prisma/client` type import at the top of the file.

- [ ] **Step 4: Run the core test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts`
Expected: PASS (skips cleanly when Postgres is not running).

- [ ] **Step 5: Write the failing poll + row tests**

Create `apps/admin/src/lib/refresh-poll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldRefreshNow, UNREAD_POLL_MS } from "./refresh-poll";

describe("shouldRefreshNow", () => {
  it("polls a visible tab", () => {
    expect(shouldRefreshNow("visible")).toBe(true);
  });

  it("does not poll a hidden tab", () => {
    // A backgrounded PWA on a phone would otherwise re-render the whole staff
    // tree every minute, all day, for counts nobody is looking at.
    expect(shouldRefreshNow("hidden")).toBe(false);
  });

  it("polls when the browser tells us nothing", () => {
    expect(shouldRefreshNow(undefined)).toBe(true);
    expect(shouldRefreshNow("prerender")).toBe(true);
  });

  it("keeps the kiosk-style one-minute cadence", () => {
    expect(UNREAD_POLL_MS).toBe(60_000);
  });
});
```

Append to `apps/admin/src/app/(staff)/enquiries/EnquiryList.test.tsx`:

```tsx
  it("offers an artist Take this on an unassigned row", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId="a1"
        showAssignedPill={false}
        truncated={false}
        emptyLabel="new"
      />,
    );
    expect(html).toContain("Unassigned");
    expect(html).toContain("Take this");
  });

  it("says so when the list is only the most recent page", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated
        emptyLabel="new"
      />,
    );
    // Otherwise a tab reading "412" above three rows looks like a bug.
    expect(html).toContain("Showing the 300 most recent");
  });
```

(and add `truncated={false}` to the two existing `EnquiryList` cases).

- [ ] **Step 6: Run them to verify they fail**

Run: `npm test -w @bnb/admin -- "src/lib/refresh-poll.test.ts" "src/app/(staff)/enquiries/EnquiryList.test.tsx"`
Expected: FAIL — `Failed to resolve import "./refresh-poll"`, and `truncated` / "Take this" are not rendered.

- [ ] **Step 7: Create `apps/admin/src/lib/refresh-poll.ts`**

```ts
/**
 * The staff shell keeps its unread badge honest without a socket: the same
 * `router.refresh()` polling the kiosk board uses. This module is the part
 * worth testing — the effect itself is three lines of wiring in AppShell.
 */

/** One minute, matching the kiosk board's live-refresh cadence. */
export const UNREAD_POLL_MS = 60_000;

/**
 * Whether a scheduled refresh should actually run. A hidden tab (backgrounded
 * PWA, another window) re-renders the entire staff tree for counts nobody can
 * see — and on a phone that is a minute-by-minute battery cost for nothing.
 * Anything other than an explicit "hidden" polls: an unknown state must not
 * silently freeze the badge.
 */
export function shouldRefreshNow(visibilityState: string | undefined): boolean {
  return visibilityState !== "hidden";
}
```

- [ ] **Step 8: Use it in `AppShell.tsx`**

Replace the existing poll effect:

```tsx
  // Keep the unread badge honest without a socket: the same 60 s refresh the
  // kiosk board uses, asleep while the tab is hidden. force-dynamic pages
  // re-render server-side on refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!shouldRefreshNow(document.visibilityState)) return;
      router.refresh();
    }, UNREAD_POLL_MS);
    // Coming back to the tab should not mean staring at a stale badge for the
    // rest of the interval.
    const onVisibility = () => {
      if (shouldRefreshNow(document.visibilityState)) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
```

with the import `import { shouldRefreshNow, UNREAD_POLL_MS } from "@/lib/refresh-poll";`.

- [ ] **Step 9: Add the row-level Take this and the truncation line to `EnquiryList.tsx`**

Props and imports:

```tsx
import { Button } from "@/components/ui/button";
import { useAction, /* …existing… */ } from "./inbox-shared";
import { claimEnquiry, markEnquiryRead } from "./actions";
```
```tsx
  /** True when the page loaded its cap and older enquiries exist. */
  truncated: boolean;
```

In `EnquiryList`, after the `<ul>`:

```tsx
      {truncated && (
        <p className="pt-1 text-center text-xs text-text-muted">
          Showing the 300 most recent — narrow the filters to reach older
          enquiries.
        </p>
      )}
```
(wrap the `<ul>` and this line in a `<div className="space-y-3">`; keep the empty-state early return as it is, and pass `truncated` down from `EnquiryInbox`.)

In `EnquiryRow`, add `const { pending, run } = useAction();` and, immediately after `</DialogTrigger>`:

```tsx
      {/*
        A sibling of the trigger, never inside it: the trigger is a <button>,
        and nesting a button inside a button is invalid HTML that browsers
        silently un-nest, breaking both controls.
      */}
      {viewerArtistId && isUnassigned(item) && (
        <div className="mt-1 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => claimEnquiry(item.id))}
          >
            Take this
          </Button>
        </div>
      )}
```

- [ ] **Step 10: Feed real counts through `page.tsx` and `EnquiryInbox.tsx`**

In `page.tsx`, add `statusCountsFor` to the `@bnb/core/services/enquiry-messages` import, extract the cap, and pass both new props:

```tsx
/** How many enquiries one inbox render pulls. Counts are NOT capped by it. */
const INBOX_PAGE_SIZE = 300;
```
```tsx
  const [enquiries, artists, unread, connections, counts] = await Promise.all([
    // …existing four, with `take: INBOX_PAGE_SIZE`…
    statusCountsFor(viewer),
  ]);
```
```tsx
        <EnquiryInbox
          items={items}
          artists={artistOptions}
          counts={counts}
          truncated={enquiries.length >= INBOX_PAGE_SIZE}
          canConvert={owner || Boolean(user.artistId)}
          viewerArtistId={owner ? null : (user.artistId ?? null)}
          showAssignedPill={owner}
        />
```

In `EnquiryInbox.tsx`, take `counts` and `truncated` as props and drop the local tally. Type the prop structurally rather than importing `EnquiryStatusCounts` — `enquiry-messages.ts` imports the Prisma client, and a client component should not reference that module at all, even in a type position:

```tsx
  counts: Record<EnquiryStatus, number>;
  /** The page hit its cap — the list says so under the rows. */
  truncated: boolean;
```
Delete `const counts = useMemo(() => countByStatus(items), [items]);` and the now-unused `countByStatus` import, and pass `truncated={truncated}` to `EnquiryList`. **Keep `countByStatus` exported from `enquiry-helpers.ts`** — its own tests in `EnquiryInbox.test.tsx` and `page.test.tsx` still assert it, and it stays the pure reference for the tally rule.

In `EnquiryInbox.test.tsx`, every `<EnquiryInbox …>` gains:

```tsx
        counts={{ new: 1, customer_replied: 0, replied: 0, converted: 1, closed: 0 }}
        truncated={false}
```

- [ ] **Step 11: Run everything touched**

Run: `npm test -w @bnb/core -- src/services/enquiry-messages.test.ts` then `npm test -w @bnb/admin -- "src/lib/refresh-poll.test.ts" "src/components/admin/AppShell.test.tsx" "src/app/(staff)/enquiries"`
Expected: PASS.

- [ ] **Step 12: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add packages/core/src/services/enquiry-messages.ts packages/core/src/services/enquiry-messages.test.ts apps/admin/src/lib/refresh-poll.ts apps/admin/src/lib/refresh-poll.test.ts apps/admin/src/components/admin/AppShell.tsx "apps/admin/src/app/(staff)/enquiries/page.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.test.tsx"
git commit -m "feat(enquiries): scoped tab counts, row-level take, and a badge poll that sleeps when hidden

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 5: `/enquiries?open=<id>` deep links

One link opens one thread — on the right tab, marked read, even when it is older than the 300 rows the page loads. An id that is junk, unknown, or another artist's produces the same quiet notice: never a 404, never a 500, and never a way to learn which enquiries exist.

**Files:**
- Modify: `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts`, `enquiry-helpers.test.ts`, `page.tsx`, `page.test.tsx`, `EnquiryInbox.tsx`, `EnquiryInbox.test.tsx`, `EnquiryList.tsx`

**Interfaces:**
- Consumes: `artistInboxWhere`, `markEnquiryRead` (Phase 1, quoted in Task 1); the Next 15 `searchParams` shape already used by `apps/admin/src/app/(staff)/studio/channels/page.tsx`:
  ```tsx
  export default async function ChannelsPage({
    searchParams = Promise.resolve({}),
  }: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  })
  ```
- Produces:
  ```ts
  // enquiry-helpers.ts
  export const OPEN_NOT_FOUND_NOTICE: string;
  export function resolveOpenParam(value: string | string[] | undefined): string | null;
  export interface OpenState { openId: string | null; tab: EnquiryStatus | null; notice: string | null }
  export function pickOpenState(items: { id: string; status: EnquiryStatus }[], requestedId: string | null): OpenState;

  // EnquiryInbox.tsx props gain: openEnquiryId: string | null; openTab: EnquiryStatus | null; notice: string | null;
  // EnquiryList.tsx props gain: openEnquiryId?: string | null;   // optional: no deep link is the norm
  // EnquiryRow (private to EnquiryList) gains: defaultOpen: boolean;
  ```

- [ ] **Step 1: Write the failing pure tests**

Append to `apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts`:

```ts
import {
  OPEN_NOT_FOUND_NOTICE,
  pickOpenState,
  resolveOpenParam,
} from "./enquiry-helpers";

describe("resolveOpenParam", () => {
  it("takes a plain id", () => {
    expect(resolveOpenParam("cln4enq1aaaabbbb")).toBe("cln4enq1aaaabbbb");
  });

  it("takes the first of a repeated param", () => {
    expect(resolveOpenParam(["cln4enq1aaaabbbb", "other"])).toBe(
      "cln4enq1aaaabbbb",
    );
  });

  it("is null for nothing, blanks and anything not shaped like an id", () => {
    expect(resolveOpenParam(undefined)).toBeNull();
    expect(resolveOpenParam("")).toBeNull();
    expect(resolveOpenParam("   ")).toBeNull();
    // Never reaches the database, so it cannot be an injection or a probe.
    expect(resolveOpenParam("../../etc/passwd")).toBeNull();
    expect(resolveOpenParam("' OR 1=1 --")).toBeNull();
    expect(resolveOpenParam("x".repeat(200))).toBeNull();
  });
});

describe("pickOpenState", () => {
  const items = [
    { id: "e1", status: "new" as const },
    { id: "e2", status: "closed" as const },
  ];

  it("is inert when nothing was asked for", () => {
    expect(pickOpenState(items, null)).toEqual({
      openId: null,
      tab: null,
      notice: null,
    });
  });

  it("opens the enquiry on its own tab", () => {
    expect(pickOpenState(items, "e2")).toEqual({
      openId: "e2",
      tab: "closed",
      notice: null,
    });
  });

  it("gives one quiet notice for anything it cannot show", () => {
    // Unknown, closed-away or another artist's all land here — deliberately
    // indistinguishable, so a link cannot be used to probe the inbox.
    expect(pickOpenState(items, "e404")).toEqual({
      openId: null,
      tab: null,
      notice: OPEN_NOT_FOUND_NOTICE,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/enquiry-helpers.test.ts"`
Expected: FAIL — `resolveOpenParam is not a function`.

- [ ] **Step 3: Implement the deep-link helpers**

Append to `enquiry-helpers.ts`:

```ts
export const OPEN_NOT_FOUND_NOTICE =
  "That enquiry is not in your inbox — it may have been assigned to another artist.";

/**
 * The `?open=` value, or null. Anything not shaped like an id we could have
 * issued is rejected here so it never becomes a query: a deep link is a URL
 * strangers can craft, and the cheapest defence is not asking the database
 * about "' OR 1=1 --" in the first place.
 */
export function resolveOpenParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = raw?.trim();
  if (!id) return null;
  return /^[A-Za-z0-9_-]{6,40}$/.test(id) ? id : null;
}

export interface OpenState {
  /** The enquiry to open, once we know the viewer may actually see it. */
  openId: string | null;
  /** The tab it lives on, so the link does not land on an empty New tab. */
  tab: EnquiryStatus | null;
  /** Shown instead, when it cannot be opened. */
  notice: string | null;
}

/**
 * Decide what a `?open=` link does, given the enquiries this viewer can see.
 * The caller is responsible for having fetched the requested enquiry through
 * a VISIBILITY-SCOPED query — absent from `items` means "not yours or not
 * there", and both get the identical notice rather than a 404 that would
 * confirm the id exists.
 */
export function pickOpenState(
  items: { id: string; status: EnquiryStatus }[],
  requestedId: string | null,
): OpenState {
  if (!requestedId) return { openId: null, tab: null, notice: null };
  const found = items.find((i) => i.id === requestedId);
  if (!found) return { openId: null, tab: null, notice: OPEN_NOT_FOUND_NOTICE };
  return { openId: found.id, tab: found.status, notice: null };
}
```

- [ ] **Step 4: Run the pure tests**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/enquiry-helpers.test.ts"`
Expected: PASS.

- [ ] **Step 5: Write the failing inbox render test**

Append to `apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx`:

```tsx
describe("EnquiryInbox deep link", () => {
  it("starts on the deep-linked enquiry's tab", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={items}
        artists={[]}
        counts={{ new: 1, customer_replied: 0, replied: 0, converted: 1, closed: 0 }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId="2"
        openTab="converted"
        notice={null}
      />,
    );
    // items[1] ("Bob") is the converted one; landing on New would show
    // "Amy" and hide the very enquiry the link pointed at.
    expect(html).toContain("Bob");
    expect(html).not.toContain("No converted enquiries.");
  });

  it("shows a quiet notice for a link it cannot open", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={items}
        artists={[]}
        counts={{ new: 1, customer_replied: 0, replied: 0, converted: 1, closed: 0 }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId={null}
        openTab={null}
        notice="That enquiry is not in your inbox — it may have been assigned to another artist."
      />,
    );
    expect(html).toContain("not in your inbox");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries/EnquiryInbox.test.tsx"`
Expected: FAIL — unknown props; the New tab renders and "Bob" is absent.

- [ ] **Step 7: Wire the state through `EnquiryInbox.tsx` and `EnquiryList.tsx`**

`EnquiryInbox` props and initial state:

```tsx
  openEnquiryId: string | null;
  /** The tab that enquiry lives on, so the link lands where it can be seen. */
  openTab: EnquiryStatus | null;
  /** Quiet explanation when the link could not be honoured. */
  notice: string | null;
```
```tsx
  const [tab, setTab] = useState<EnquiryStatus>(openTab ?? "new");
```
```tsx
      {notice && (
        <p className="rounded-md border border-border-default bg-bg-base px-4 py-3 text-sm text-text-muted">
          {notice}
        </p>
      )}
```
(rendered above `<InboxFilters …>`), and `openEnquiryId={openEnquiryId}` passed to `EnquiryList`.

`EnquiryList` takes it **optionally** — `openEnquiryId?: string | null` — so the suites written in Tasks 1 and 4 keep compiling untouched, and forwards `defaultOpen={item.id === openEnquiryId}` to each row. `EnquiryRow` gains a required `defaultOpen: boolean` and becomes:

```tsx
  // `useEffect` joins the existing `import { useState } from "react";`
  const [open, setOpen] = useState(defaultOpen);

  // A deep link opens the thread without a click, so nothing would otherwise
  // clear its unread flag. Mount-only on purpose: every later open goes
  // through onOpenChange below.
  useEffect(() => {
    if (defaultOpen && item.unread) void markEnquiryRead(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 8: Resolve the link in `page.tsx`**

Give the page the `searchParams` shape the channels page already uses (this exact form is what satisfies Next 15's generated `PageProps` — see commit `6dc1828`), hoist the select into a constant so the extra fetch cannot drift from the list query, and fetch the deep-linked enquiry when it fell outside the page:

```tsx
const INBOX_SELECT = {
  ...ENQUIRY_EMAIL_CONTEXT_SELECT,
  style: true,
  placement: true,
  size: true,
  budgetPence: true,
  description: true,
  moodboard: true,
  moodboardData: true,
  status: true,
  source: true,
  channel: true,
  preferredArtistId: true,
  createdAt: true,
  lastMessageAt: true,
} satisfies Prisma.EnquirySelect;

export default async function EnquiriesPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const scope = owner ? {} : artistInboxWhere(user.artistId ?? null);
  const requestedOpenId = resolveOpenParam((await searchParams).open);
  // …existing viewer + Promise.all, using `where: scope` and `select: INBOX_SELECT`…

  // The link may point at an enquiry older than this page of rows. One extra
  // read, through the SAME visibility scope — an id the viewer may not see
  // simply does not come back, and pickOpenState turns that into the notice.
  if (requestedOpenId && !enquiries.some((e) => e.id === requestedOpenId)) {
    const extra = await prisma.enquiry.findFirst({
      where: { id: requestedOpenId, ...scope },
      select: INBOX_SELECT,
    });
    if (extra) enquiries.unshift(extra);
  }
```

then, after `items` is built:

```tsx
  const open = pickOpenState(items, requestedOpenId);
```
```tsx
        <EnquiryInbox
          items={items}
          artists={artistOptions}
          counts={counts}
          truncated={enquiries.length >= INBOX_PAGE_SIZE}
          canConvert={owner || Boolean(user.artistId)}
          viewerArtistId={owner ? null : (user.artistId ?? null)}
          showAssignedPill={owner}
          openEnquiryId={open.openId}
          openTab={open.tab}
          notice={open.notice}
        />
```

Note the threads lookup already runs off `enquiries.map((e) => e.id)`, so the prepended enquiry gets its thread like any other. `enquiries` must be declared with `let`/a mutable local for the `unshift`; keep `Prisma` imported as a type from `@prisma/client`.

**No URL rewriting:** the `?open=` param is left in place. Refreshing re-opens the same thread, which is what a bookmarked or shared link should do; stripping it with `router.replace` would fight the 60 s refresh.

- [ ] **Step 9: Add the page-level contract test**

Append to `apps/admin/src/app/(staff)/enquiries/page.test.tsx`:

```ts
import { OPEN_NOT_FOUND_NOTICE, pickOpenState, resolveOpenParam } from "./enquiry-helpers";

/**
 * The page itself is an async Server Component (DB + server-only). Its
 * deep-link decision is these two pure helpers, asserted end to end here.
 */
describe("EnquiriesPage ?open= handling", () => {
  it("turns an inaccessible id into a notice rather than an error", () => {
    const id = resolveOpenParam("cln4missing0000");
    expect(id).toBe("cln4missing0000");
    // The scoped query returned nothing, so `items` does not contain it.
    expect(pickOpenState([{ id: "e1", status: "new" }], id)).toEqual({
      openId: null,
      tab: null,
      notice: OPEN_NOT_FOUND_NOTICE,
    });
  });

  it("never queries a malformed id at all", () => {
    expect(resolveOpenParam("<script>")).toBeNull();
  });
});
```

- [ ] **Step 10: Run the suite**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/enquiries"`
Expected: PASS.

- [ ] **Step 11: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.ts" "apps/admin/src/app/(staff)/enquiries/enquiry-helpers.test.ts" "apps/admin/src/app/(staff)/enquiries/page.tsx" "apps/admin/src/app/(staff)/enquiries/page.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryInbox.test.tsx" "apps/admin/src/app/(staff)/enquiries/EnquiryList.tsx"
git commit -m "feat(enquiries): ?open= deep links open and read one thread, quietly

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 6: Customer page — messages on the timeline, identity chips, deep-linked enquiries

The customer record stops being email-only history. Every inbound and outbound thread message joins the timeline with its channel, direction, preview and time; enquiry and message entries link into `/enquiries?open=<id>`; and the header shows which handles reach this person.

**Files:**
- Create: `apps/admin/src/app/(staff)/customers/[id]/IdentityChips.tsx`, `IdentityChips.test.tsx`
- Modify: `apps/admin/src/components/admin/CustomerTimeline.tsx`, `CustomerTimeline.test.tsx`, `apps/admin/src/app/(staff)/customers/[id]/timeline-builder.ts`, `timeline-builder.test.ts`, `apps/admin/src/app/(staff)/customers/[id]/page.tsx`

**Interfaces:**
- Consumes (verbatim):
  ```ts
  // apps/admin/src/components/admin/CustomerTimeline.tsx
  export interface TimelineEntry { id: string; kind: "enquiry" | "booking" | "session" | "email" | "note" | "loyalty"; at: string; title: string; detail?: string; status?: string }
  export interface CustomerTimelineProps { customerId: string; entries: TimelineEntry[] }
  export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[]
  // Prisma relations already on Customer: identities CustomerIdentity[], enquiryMessages EnquiryMessage[]
  // CustomerIdentity: { id, customerId, channel: MessageChannelKind, externalId, displayName: string | null, createdAt }
  // EnquiryMessage: { id, enquiryId, direction: "inbound"|"outbound"|"internal", channel: "web"|"email"|"messenger"|"instagram"|"note", bodyText, createdAt }
  ```
- Produces:
  ```ts
  // CustomerTimeline.tsx — TimelineEntry gains:
  kind: … | "message";
  href?: string;
  /** Message entries: which channel drew the icon. */
  channel?: "web" | "email" | "messenger" | "instagram";

  // timeline-builder.ts
  export function messagePreview(body: string, max?: number): string;
  export function enquiryHref(enquiryId: string): string;
  // TimelineSources gains (OPTIONAL, so the file's existing fixtures still compile):
  threadMessages?: { id: string; enquiryId: string; createdAt: string; direction: "inbound" | "outbound" | "internal"; channel: "web" | "email" | "messenger" | "instagram" | "note"; bodyText: string }[];

  // IdentityChips.tsx
  export interface IdentityChip { kind: "email" | "phone" | "messenger" | "instagram"; label: string }
  export function buildIdentityChips(input: { email: string | null; phone: string | null; identities: { channel: string; displayName: string | null }[] }): IdentityChip[];
  export function IdentityChips({ chips }: { chips: IdentityChip[] }): JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing builder + chip tests**

Append to `apps/admin/src/app/(staff)/customers/[id]/timeline-builder.test.ts`:

```ts
import { buildTimeline, messagePreview } from "./timeline-builder";

const EMPTY = {
  enquiries: [],
  bookings: [],
  sessions: [],
  messages: [],
  threadMessages: [],
  loyalty: { stamps: 0, tier: 0 },
};

describe("messagePreview", () => {
  it("collapses whitespace and truncates long bodies", () => {
    expect(messagePreview("  hello\n\n  there  ")).toBe("hello there");
    expect(messagePreview("x".repeat(200))).toHaveLength(121); // 120 + ellipsis
    expect(messagePreview("x".repeat(200)).endsWith("…")).toBe(true);
  });

  it("survives an empty body", () => {
    expect(messagePreview("")).toBe("");
  });
});

describe("buildTimeline thread messages", () => {
  it("adds inbound and outbound messages with channel, direction and a deep link", () => {
    const entries = buildTimeline({
      ...EMPTY,
      threadMessages: [
        {
          id: "m1",
          enquiryId: "e1",
          createdAt: "2026-09-05T09:00:00.000Z",
          direction: "inbound",
          channel: "instagram",
          bodyText: "Is Tuesday free?",
        },
        {
          id: "m2",
          enquiryId: "e1",
          createdAt: "2026-09-05T10:00:00.000Z",
          direction: "outbound",
          channel: "email",
          bodyText: "Tuesday works!",
        },
      ],
    });
    expect(entries.map((e) => e.id)).toEqual(["message-m2", "message-m1"]);
    expect(entries[1]).toMatchObject({
      kind: "message",
      channel: "instagram",
      title: "Instagram · Received",
      detail: "Is Tuesday free?",
      href: "/enquiries?open=e1",
    });
    expect(entries[0].title).toBe("Email · Sent");
  });

  it("never puts internal staff notes on the customer's own record", () => {
    const entries = buildTimeline({
      ...EMPTY,
      threadMessages: [
        {
          id: "m3",
          enquiryId: "e1",
          createdAt: "2026-09-05T09:00:00.000Z",
          direction: "internal",
          channel: "note",
          bodyText: "Difficult on the phone",
        },
      ],
    });
    expect(entries).toEqual([]);
  });

  it("links enquiry entries into the inbox", () => {
    const entries = buildTimeline({
      ...EMPTY,
      enquiries: [
        {
          id: "e9",
          createdAt: "2026-09-01T09:00:00.000Z",
          style: "fine line",
          status: "new",
        },
      ],
    });
    expect(entries[0].href).toBe("/enquiries?open=e9");
  });
});
```

Create `apps/admin/src/app/(staff)/customers/[id]/IdentityChips.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIdentityChips, IdentityChips } from "./IdentityChips";

describe("buildIdentityChips", () => {
  it("lists contact details then channel handles", () => {
    expect(
      buildIdentityChips({
        email: "amy@example.test",
        phone: "+447700900123",
        identities: [
          { channel: "instagram", displayName: "amy.ink" },
          { channel: "messenger", displayName: null },
        ],
      }),
    ).toEqual([
      { kind: "email", label: "amy@example.test" },
      { kind: "phone", label: "+447700900123" },
      { kind: "instagram", label: "amy.ink" },
      { kind: "messenger", label: "Linked account" },
    ]);
  });

  it("omits what the customer does not have", () => {
    expect(
      buildIdentityChips({ email: null, phone: null, identities: [] }),
    ).toEqual([]);
  });

  it("ignores a channel that is not a messaging handle", () => {
    // Defensive: MessageChannelKind also has web/email/note values, which are
    // never valid CustomerIdentity channels and must not become chips.
    expect(
      buildIdentityChips({
        email: null,
        phone: null,
        identities: [{ channel: "note", displayName: "nope" }],
      }),
    ).toEqual([]);
  });
});

describe("IdentityChips", () => {
  it("renders a chip per identity and nothing at all when empty", () => {
    const html = renderToStaticMarkup(
      <IdentityChips
        chips={[
          { kind: "email", label: "amy@example.test" },
          { kind: "instagram", label: "amy.ink" },
        ]}
      />,
    );
    expect(html).toContain("amy@example.test");
    expect(html).toContain("amy.ink");
    expect(renderToStaticMarkup(<IdentityChips chips={[]} />)).toBe("");
  });
});
```

Append to `apps/admin/src/components/admin/CustomerTimeline.test.tsx`:

```tsx
  it("renders a message entry as a link with its channel", () => {
    const html = renderToStaticMarkup(
      <CustomerTimeline
        customerId="c1"
        entries={[
          {
            id: "message-m1",
            kind: "message",
            channel: "messenger",
            at: "2026-09-05T09:00:00.000Z",
            title: "Messenger · Received",
            detail: "Is Tuesday free?",
            href: "/enquiries?open=e1",
          },
        ]}
      />,
    );
    expect(html).toContain('href="/enquiries?open=e1"');
    expect(html).toContain("Messenger · Received");
    expect(html).toContain("Is Tuesday free?");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/customers/[id]/timeline-builder.test.ts" "src/app/(staff)/customers/[id]/IdentityChips.test.tsx" "src/components/admin/CustomerTimeline.test.tsx"`
Expected: FAIL — `messagePreview` is not exported, `./IdentityChips` does not resolve, and no `href` is rendered.

- [ ] **Step 3: Extend `CustomerTimeline.tsx`**

```tsx
import {
  CalendarCheck,
  Camera,
  Globe,
  Inbox,
  Mail,
  MessageCircle,
  ReceiptText,
  StarIcon,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
```
```ts
export interface TimelineEntry {
  id: string;
  kind:
    | "enquiry"
    | "booking"
    | "session"
    | "email"
    | "note"
    | "loyalty"
    | "message";
  /** ISO timestamp. */
  at: string;
  title: string;
  detail?: string;
  /** e.g. email delivery status. */
  status?: string;
  /** Where this entry lives — usually /enquiries?open=<id>. */
  href?: string;
  /** Message entries: which channel drew the icon. */
  channel?: "web" | "email" | "messenger" | "instagram";
}
```
```ts
const KIND_META: Record<
  TimelineEntry["kind"],
  { icon: LucideIcon; label: string; color: string }
> = {
  enquiry: { icon: Inbox, label: "Enquiry", color: "text-bb-teal" },
  booking: { icon: CalendarCheck, label: "Booking", color: "text-bb-gold" },
  session: { icon: ReceiptText, label: "Session", color: "text-bb-crimson" },
  email: { icon: Mail, label: "Email", color: "text-text-muted" },
  note: { icon: StickyNote, label: "Note", color: "text-text-muted" },
  loyalty: { icon: StarIcon, label: "Loyalty", color: "text-bb-gold" },
  message: { icon: MessageCircle, label: "Message", color: "text-bb-teal" },
};

// Same convention as the enquiry thread: lucide-react carries no Facebook or
// Instagram glyph, so Messenger is a chat bubble and Instagram a camera.
const CHANNEL_ICON: Record<
  NonNullable<TimelineEntry["channel"]>,
  LucideIcon
> = {
  web: Globe,
  email: Mail,
  messenger: MessageCircle,
  instagram: Camera,
};
```

In the map, pick the icon and wrap the title when there is an `href`:

```tsx
        const meta = KIND_META[entry.kind];
        const Icon = entry.channel ? CHANNEL_ICON[entry.channel] : meta.icon;
```
```tsx
                <p className="text-sm font-medium text-text-primary">
                  <span className="sr-only">{meta.label}: </span>
                  {entry.href ? (
                    <a href={entry.href} className="hover:text-bb-teal">
                      {entry.title}
                    </a>
                  ) : (
                    entry.title
                  )}
                </p>
```

- [ ] **Step 4: Extend `timeline-builder.ts`**

```ts
const CHANNEL_TITLE: Record<string, string> = {
  web: "Web form",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};

/** The inbox link for one enquiry — the single definition of that URL. */
export function enquiryHref(enquiryId: string): string {
  return `/enquiries?open=${encodeURIComponent(enquiryId)}`;
}

/**
 * One line of a message, for a timeline row. Newlines and runs of spaces
 * collapse (a quoted email reply would otherwise blow the row open) and long
 * bodies are cut with an ellipsis.
 */
export function messagePreview(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
```

`TimelineSources` gains the field as **optional**, so every existing fixture in `timeline-builder.test.ts` and the customer page keeps compiling:

```ts
  threadMessages?: {
    id: string;
    enquiryId: string;
    createdAt: string;
    direction: "inbound" | "outbound" | "internal";
    channel: "web" | "email" | "messenger" | "instagram" | "note";
    bodyText: string;
  }[];
```

and `buildTimeline` gains, before the sort:

```ts
  for (const m of sources.threadMessages ?? []) {
    // Internal notes are staff-to-staff. They belong on the enquiry thread,
    // not on the customer's own record, which is read (and read out) far more
    // widely — including with the customer in the room.
    if (m.direction === "internal" || m.channel === "note") continue;
    entries.push({
      id: `message-${m.id}`,
      kind: "message",
      channel: m.channel,
      at: m.createdAt,
      title: `${CHANNEL_TITLE[m.channel] ?? "Message"} · ${
        m.direction === "inbound" ? "Received" : "Sent"
      }`,
      detail: messagePreview(m.bodyText) || undefined,
      href: enquiryHref(m.enquiryId),
    });
  }
```

and the existing enquiry loop gains `href: enquiryHref(e.id),`.

- [ ] **Step 5: Create `IdentityChips.tsx`**

```tsx
/**
 * Which handles reach this person: their email and phone, plus every Meta
 * account linked to the record. Presentational + a pure builder, so it tests
 * in node without the page.
 *
 * The PSID/IGSID is deliberately NOT rendered — it is an opaque number that
 * means nothing to staff and only makes the header noisier.
 */
import { AtSign, Camera, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IdentityChip {
  kind: "email" | "phone" | "messenger" | "instagram";
  label: string;
}

const CHIP_ICON: Record<IdentityChip["kind"], LucideIcon> = {
  email: AtSign,
  phone: Phone,
  messenger: MessageCircle,
  instagram: Camera,
};

const CHIP_LABEL: Record<IdentityChip["kind"], string> = {
  email: "Email",
  phone: "Phone",
  messenger: "Messenger",
  instagram: "Instagram",
};

export function buildIdentityChips(input: {
  email: string | null;
  phone: string | null;
  identities: { channel: string; displayName: string | null }[];
}): IdentityChip[] {
  const chips: IdentityChip[] = [];
  if (input.email) chips.push({ kind: "email", label: input.email });
  if (input.phone) chips.push({ kind: "phone", label: input.phone });
  for (const identity of input.identities) {
    // CustomerIdentity.channel is typed as the whole MessageChannelKind enum;
    // only these two are ever written to it, and only these two are chips.
    if (identity.channel !== "messenger" && identity.channel !== "instagram") {
      continue;
    }
    chips.push({
      kind: identity.channel,
      label: identity.displayName?.trim() || "Linked account",
    });
  }
  return chips;
}

export function IdentityChips({ chips }: { chips: IdentityChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => {
        const Icon = CHIP_ICON[chip.kind];
        return (
          <li
            key={`${chip.kind}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-card px-2.5 py-1 text-xs text-text-secondary"
          >
            <Icon className="size-3.5 text-text-muted" aria-hidden />
            <span className="sr-only">{CHIP_LABEL[chip.kind]}: </span>
            {chip.label}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 6: Wire the customer page**

In `apps/admin/src/app/(staff)/customers/[id]/page.tsx`, extend the `include`:

```tsx
      identities: { orderBy: { createdAt: "asc" } },
      enquiryMessages: {
        orderBy: { createdAt: "desc" },
        // A long-running customer can have hundreds of messages; the timeline
        // is a summary, not an archive — the thread itself is one click away.
        take: 100,
        select: {
          id: true,
          enquiryId: true,
          createdAt: true,
          direction: true,
          channel: true,
          bodyText: true,
        },
      },
```

feed the builder:

```tsx
    threadMessages: customer.enquiryMessages.map((m) => ({
      id: m.id,
      enquiryId: m.enquiryId,
      createdAt: m.createdAt.toISOString(),
      direction: m.direction,
      channel: m.channel,
      bodyText: m.bodyText,
    })),
```

and replace the contact line in the header with the chips:

```tsx
          <IdentityChips
            chips={buildIdentityChips({
              email: customer.email,
              phone: customer.phone,
              identities: customer.identities,
            })}
          />
```
keeping the existing `<p>` as the fallback for a customer with nothing at all:

```tsx
          {customer.email || customer.phone || customer.identities.length ? null : (
            <p className="mt-1 text-sm text-text-muted">No contact details</p>
          )}
```

- [ ] **Step 7: Run the customer suites**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/customers" "src/components/admin/CustomerTimeline.test.tsx"`
Expected: PASS. `page.test.tsx` may need `threadMessages: []` / `identities: []` added to any fixture it builds — add them if it fails.

- [ ] **Step 8: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add apps/admin/src/components/admin/CustomerTimeline.tsx apps/admin/src/components/admin/CustomerTimeline.test.tsx "apps/admin/src/app/(staff)/customers/[id]/timeline-builder.ts" "apps/admin/src/app/(staff)/customers/[id]/timeline-builder.test.ts" "apps/admin/src/app/(staff)/customers/[id]/IdentityChips.tsx" "apps/admin/src/app/(staff)/customers/[id]/IdentityChips.test.tsx" "apps/admin/src/app/(staff)/customers/[id]/page.tsx"
git commit -m "feat(customers): thread messages and identity chips on the customer record

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 7: Link a Messenger/Instagram handle to a customer (owner-only), merging the stub away

The Phase-3 follow-up. An email-known customer who DMs on Instagram became a second, contact-less record; this is the repair. The owner picks the orphan handle and links it, and the stub's enquiries and messages come with it.

**Files:**
- Create: `packages/core/src/services/identity-linking.ts`, `identity-linking.test.ts`, `apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.tsx`, `LinkIdentityCard.test.tsx`
- Modify: `packages/core/src/services/index.ts`, `apps/admin/src/app/(staff)/customers/[id]/actions.ts`, `actions.test.ts`, `page.tsx`

**Interfaces:**
- Consumes (Phase 1, verbatim — the FK set this merge must re-point is exactly the one the duplicate-customer merge re-points):
  ```ts
  // packages/core/src/services/customer-merge.ts
  export async function applyMergeGroup({ keep, dupes, fields }: PlannedMerge): Promise<void>
  //   moves: enquiry, booking, messageLog, enquiryMessage, review,
  //          customerPasswordToken, customerIdentity — then deletes the dupes.
  // packages/core/src/services/contact-identity.ts
  export async function linkIdentity(customerId: string, channel: IdentityChannel, externalId: string, displayName?: string | null): Promise<CustomerIdentity>
  export type IdentityChannel = "messenger" | "instagram";
  ```
- Produces:
  ```ts
  // packages/core/src/services/identity-linking.ts
  export interface LinkableIdentity { id: string; channel: IdentityChannel; displayName: string | null; customerId: string; customerName: string; createdAt: Date }
  export async function listLinkableIdentities(limit?: number): Promise<LinkableIdentity[]>;
  export type LinkIdentityResult =
    | { ok: true; merged: boolean; movedEnquiries: number; movedMessages: number }
    | { ok: false; reason: "identity_missing" | "customer_missing" | "in_use"; message: string };
  export async function linkIdentityToCustomer(input: { identityId: string; customerId: string }): Promise<LinkIdentityResult>;

  // apps/admin/src/app/(staff)/customers/[id]/actions.ts
  export async function linkIdentityAction(customerId: string, identityId: string): Promise<ActionState>;
  ```

- [ ] **Step 1: Write the failing service test**

Create `packages/core/src/services/identity-linking.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  linkIdentityToCustomer,
  listLinkableIdentities,
} from "./identity-linking";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("identity linking (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];
  const artists: string[] = [];
  const users: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      // Enquiry.customerId is SetNull, so deleting customers would leave the
      // enquiries (and, cascading from them, their messages) behind. Delete
      // enquiries first; bookings DO cascade from the customer.
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
      if (artists.length)
        await db().artist.deleteMany({ where: { id: { in: artists } } });
      if (users.length)
        await db().user.deleteMany({ where: { id: { in: users } } });
    }
    await closeTestDb();
  });

  /** A real record: has an email, so it is never a merge victim. */
  async function realCustomer(tag: string) {
    const c = await db().customer.create({
      data: { name: `Amy ${tag}`, email: `amy-${tag}@example.test` },
    });
    customers.push(c.id);
    return c;
  }

  /** The record a first DM creates: a name, a handle, and nothing else. */
  async function stubWithIdentity(tag: string, over: object = {}) {
    const c = await db().customer.create({
      data: { name: `amy.ink ${tag}`, ...over },
    });
    customers.push(c.id);
    const identity = await db().customerIdentity.create({
      data: {
        customerId: c.id,
        channel: "instagram",
        externalId: `1784140${tag}`,
        displayName: "amy.ink",
      },
    });
    const enquiry = await db().enquiry.create({
      data: {
        contactName: c.name,
        customerId: c.id,
        channel: "instagram",
        status: "new",
      },
    });
    enquiries.push(enquiry.id);
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        customerId: c.id,
        direction: "inbound",
        channel: "instagram",
        bodyText: "Hey, do you do fine line?",
      },
    });
    return { customer: c, identity, enquiry, message };
  }

  it("lists handles that sit on stub customers", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s1");
    const stub = await stubWithIdentity(tag);
    const real = await realCustomer(tag);
    await db().customerIdentity.create({
      data: {
        customerId: real.id,
        channel: "messenger",
        externalId: `7213456${tag}`,
        displayName: "Amy Rowe",
      },
    });

    const ids = (await listLinkableIdentities()).map((i) => i.id);
    expect(ids).toContain(stub.identity.id);
    // The one already on a real record is not on offer: linking it elsewhere
    // would be stealing a handle, not repairing a duplicate.
    const onReal = await db().customerIdentity.findFirst({
      where: { customerId: real.id },
    });
    expect(ids).not.toContain(onReal!.id);
  });

  it("moves the handle, its enquiries and its messages, then deletes the stub", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s2");
    const { customer: stub, identity, enquiry, message } =
      await stubWithIdentity(tag);
    const real = await realCustomer(tag);

    const res = await linkIdentityToCustomer({
      identityId: identity.id,
      customerId: real.id,
    });

    expect(res).toEqual({
      ok: true,
      merged: true,
      movedEnquiries: 1,
      movedMessages: 1,
    });
    expect(
      (await db().customerIdentity.findUniqueOrThrow({ where: { id: identity.id } }))
        .customerId,
    ).toBe(real.id);
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } })).customerId,
    ).toBe(real.id);
    expect(
      (await db().enquiryMessage.findUniqueOrThrow({ where: { id: message.id } }))
        .customerId,
    ).toBe(real.id);
    expect(await db().customer.findUnique({ where: { id: stub.id } })).toBeNull();
  });

  it("is a no-op when the handle is already on this customer", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s3");
    const { customer, identity } = await stubWithIdentity(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: identity.id,
        customerId: customer.id,
      }),
    ).toEqual({ ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 });
  });

  it("refuses a handle whose owner has contact details or bookings", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s4");
    const target = await realCustomer(`${tag}-target`);

    // (a) an email makes the owner a real record
    const withEmail = await stubWithIdentity(`${tag}a`, {
      email: `other-${tag}@example.test`,
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withEmail.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });

    // (b) so does a phone number
    const withPhone = await stubWithIdentity(`${tag}b`, {
      phone: `+4477009${tag.slice(-5)}`,
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withPhone.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });

    // (c) and so does a booking, even with no contact details at all
    const artist = await db().artist.create({
      data: {
        slug: `link-${tag}`,
        name: `Link ${tag}`,
        user: {
          create: {
            email: `link-${tag}@example.test`,
            displayName: `Link ${tag}`,
          },
        },
      },
    });
    artists.push(artist.id);
    users.push(artist.userId);
    const withBooking = await stubWithIdentity(`${tag}c`);
    await db().booking.create({
      data: {
        customerId: withBooking.customer.id,
        artistId: artist.id,
        type: "consult",
        start: new Date("2099-01-01T10:00:00.000Z"),
        end: new Date("2099-01-01T11:00:00.000Z"),
        durationMin: 60,
      },
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withBooking.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });
  });

  it("reports a missing handle or customer rather than throwing", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s5");
    const real = await realCustomer(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: "no-such-identity",
        customerId: real.id,
      }),
    ).toMatchObject({ ok: false, reason: "identity_missing" });
    const { identity } = await stubWithIdentity(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: identity.id,
        customerId: "no-such-customer",
      }),
    ).toMatchObject({ ok: false, reason: "customer_missing" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @bnb/core -- src/services/identity-linking.test.ts`
Expected: FAIL — `Failed to resolve import "./identity-linking"`.

- [ ] **Step 3: Implement `identity-linking.ts`**

```ts
import { prisma } from "@bnb/core/db";
import type { IdentityChannel } from "./contact-identity";

/**
 * Attach a Messenger/Instagram handle to an existing customer, folding away
 * the stub record the handle's first message created.
 *
 * The failure this repairs: a customer we already know by email sends an
 * Instagram DM. The DM carries no email and no phone, so `findOrCreateCustomer`
 * has nothing to match on and correctly creates a second record — correctly,
 * because guessing would let a stranger claim someone else's history. Only a
 * human can say "these are the same person", and this is where they say it.
 *
 * A stub is a record with no email, no phone, no password and no bookings:
 * everything it holds arrived through the handle itself, so moving it moves
 * nothing that was ever verified against another person.
 */

/** No email, no phone, no login, no bookings — nothing but the handle. */
const STUB_CUSTOMER = {
  email: null,
  phone: null,
  passwordHash: null,
  bookings: { none: {} },
} as const;

export interface LinkableIdentity {
  id: string;
  channel: IdentityChannel;
  displayName: string | null;
  customerId: string;
  customerName: string;
  createdAt: Date;
}

/**
 * Handles that could be linked elsewhere: the ones sitting on stub records.
 * A handle on a real customer is never offered — moving it would be taking a
 * verified account away from the person it belongs to.
 */
export async function listLinkableIdentities(
  limit = 50,
): Promise<LinkableIdentity[]> {
  const rows = await prisma.customerIdentity.findMany({
    where: { customer: STUB_CUSTOMER },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      displayName: true,
      customerId: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    channel: row.channel as IdentityChannel,
    displayName: row.displayName,
    customerId: row.customerId,
    customerName: row.customer.name,
    createdAt: row.createdAt,
  }));
}

export type LinkIdentityResult =
  | { ok: true; merged: boolean; movedEnquiries: number; movedMessages: number }
  | {
      ok: false;
      reason: "identity_missing" | "customer_missing" | "in_use";
      message: string;
    };

export async function linkIdentityToCustomer(input: {
  identityId: string;
  customerId: string;
}): Promise<LinkIdentityResult> {
  const identity = await prisma.customerIdentity.findUnique({
    where: { id: input.identityId },
    select: { id: true, customerId: true, displayName: true },
  });
  if (!identity) {
    return {
      ok: false,
      reason: "identity_missing",
      message: "That handle no longer exists — refresh and try again.",
    };
  }
  const target = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, notes: true },
  });
  if (!target) {
    return {
      ok: false,
      reason: "customer_missing",
      message: "That customer no longer exists.",
    };
  }
  if (identity.customerId === target.id) {
    // Idempotent: two clicks, or two people clicking, is not an error.
    return { ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 };
  }

  // Re-read the current owner THROUGH the stub predicate: the check and the
  // decision are then the same query, so a booking taken between them cannot
  // slip a real customer into the merge.
  const stub = await prisma.customer.findFirst({
    where: { id: identity.customerId, ...STUB_CUSTOMER },
    select: { id: true, name: true, notes: true },
  });
  if (!stub) {
    return {
      ok: false,
      reason: "in_use",
      message:
        "That handle already belongs to a customer with their own contact details or bookings — merge those records instead.",
    };
  }

  const move = {
    where: { customerId: stub.id },
    data: { customerId: target.id },
  };
  // Same FK set as customer-merge's applyMergeGroup, in one transaction: the
  // stub must not be deleted while anything still points at it, and a half
  // done move would strand a thread on a record that no longer exists.
  const [enquiries, messages] = await prisma.$transaction([
    prisma.enquiry.updateMany(move),
    prisma.enquiryMessage.updateMany(move),
    prisma.messageLog.updateMany(move),
    prisma.review.updateMany(move),
    prisma.customerPasswordToken.updateMany(move),
    prisma.customerIdentity.updateMany(move),
    prisma.customer.update({
      where: { id: target.id },
      data: {
        // Whatever an owner typed on the stub is the only thing on it that a
        // human wrote; keep it rather than deleting it with the row.
        notes: [target.notes?.trim(), stub.notes?.trim()]
          .filter(Boolean)
          .join("\n") || null,
      },
    }),
    prisma.customer.delete({ where: { id: stub.id } }),
  ]);

  return {
    ok: true,
    merged: true,
    movedEnquiries: enquiries.count,
    movedMessages: messages.count,
  };
}
```

Add to `packages/core/src/services/index.ts`:

```ts
export * from "./identity-linking";
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `npm test -w @bnb/core -- src/services/identity-linking.test.ts`
Expected: PASS (skips cleanly with no Postgres).

- [ ] **Step 5: Write the failing action + card tests**

In `apps/admin/src/app/(staff)/customers/[id]/actions.test.ts`, add to the mock preamble (beside the existing `vi.mock("@bnb/core/email", …)`):

```ts
vi.mock("@bnb/core/services/identity-linking", () => ({
  linkIdentityToCustomer: vi.fn(),
}));
```

and to the dynamic-import block (beside `const { sendManualEmail } = await import("./actions");`):

```ts
const { linkIdentityToCustomer } = await import(
  "@bnb/core/services/identity-linking"
);
const { linkIdentityAction } = await import("./actions");
```

then append (the file's `OWNER` fixture and `requireRole` mock are already in place):

```ts
describe("linkIdentityAction", () => {
  it("is owner-only", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    await expect(linkIdentityAction("c1", "i1")).rejects.toThrow(/forbidden/i);
    expect(linkIdentityToCustomer).not.toHaveBeenCalled();
    // requireRole("OWNER") is the guard — an artist must not be able to fold
    // one customer record into another.
    expect(requireRole).toHaveBeenCalledWith("OWNER");
  });

  it("reports what the merge moved", async () => {
    vi.mocked(requireRole).mockResolvedValue(OWNER as never);
    vi.mocked(linkIdentityToCustomer).mockResolvedValue({
      ok: true,
      merged: true,
      movedEnquiries: 2,
      movedMessages: 7,
    });
    const res = await linkIdentityAction("c1", "i1");
    expect(res.ok).toBe(true);
    expect(res.message).toBe(
      "Handle linked — 2 enquiries and 7 messages moved onto this customer.",
    );
  });

  it("passes a refusal straight through", async () => {
    vi.mocked(requireRole).mockResolvedValue(OWNER as never);
    vi.mocked(linkIdentityToCustomer).mockResolvedValue({
      ok: false,
      reason: "in_use",
      message: "That handle already belongs to a customer…",
    });
    const res = await linkIdentityAction("c1", "i1");
    expect(res).toEqual({
      ok: false,
      message: "That handle already belongs to a customer…",
    });
  });
});
```

Create `apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({ linkIdentityAction: vi.fn() }));

import { LinkIdentityCard } from "./LinkIdentityCard";

describe("LinkIdentityCard", () => {
  it("lists the handles by name and channel", () => {
    const html = renderToStaticMarkup(
      <LinkIdentityCard
        customerId="c1"
        identities={[
          { id: "i1", channel: "instagram", label: "amy.ink · Instagram" },
        ]}
      />,
    );
    expect(html).toContain("amy.ink · Instagram");
    expect(html).toContain("Link handle");
  });

  it("explains itself when there is nothing to link", () => {
    const html = renderToStaticMarkup(
      <LinkIdentityCard customerId="c1" identities={[]} />,
    );
    expect(html).toContain("No unlinked Messenger or Instagram handles");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -w @bnb/admin -- "src/app/(staff)/customers/[id]"`
Expected: FAIL — `linkIdentityAction` is not exported and `./LinkIdentityCard` does not resolve.

- [ ] **Step 7: Implement the action and the card**

Append to `apps/admin/src/app/(staff)/customers/[id]/actions.ts`:

```ts
import { linkIdentityToCustomer } from "@bnb/core/services/identity-linking";

/**
 * Link a Messenger/Instagram handle to this customer, folding away the stub
 * record it currently sits on. OWNER only: this deletes a customer row, and
 * the judgement "these are the same person" is not one to spread around.
 */
export async function linkIdentityAction(
  customerId: string,
  identityId: string,
): Promise<ActionState> {
  await requireRole("OWNER");
  const res = await linkIdentityToCustomer({ identityId, customerId });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/enquiries");
  if (!res.merged) {
    return { ok: true, message: "That handle is already on this customer." };
  }
  return {
    ok: true,
    message: `Handle linked — ${res.movedEnquiries} enquiries and ${res.movedMessages} messages moved onto this customer.`,
  };
}
```

Create `apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.tsx`:

```tsx
"use client";

/**
 * Owner-only repair for the one duplicate the CRM cannot resolve on its own: a
 * customer we know by email sends an Instagram DM, which carries no contact
 * details, so it lands on a fresh stub record. Pick the handle, link it, and
 * the stub's enquiries and messages come across.
 *
 * A list, not a text box: a PSID/IGSID is an opaque number nobody can type,
 * and only handles on stub records are offered.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkIdentityAction } from "./actions";

export interface LinkableIdentityOption {
  id: string;
  channel: "messenger" | "instagram";
  /** e.g. "amy.ink · Instagram (from Amy Rowe)". */
  label: string;
}

export function LinkIdentityCard({
  customerId,
  identities,
}: {
  customerId: string;
  identities: LinkableIdentityOption[];
}) {
  const [pending, start] = useTransition();
  const [identityId, setIdentityId] = useState("");
  const items = identities.map((i) => ({ value: i.id, label: i.label }));

  return (
    <section className="mt-6 space-y-2 rounded-lg border border-border-default bg-bg-card p-4">
      <Label>Link a Messenger / Instagram handle</Label>
      {identities.length === 0 ? (
        <p className="text-sm text-text-muted">
          No unlinked Messenger or Instagram handles — every handle already
          belongs to a customer with contact details or bookings.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            Moves the handle, and everything it has sent, onto this customer.
            The empty record it came from is deleted.
          </p>
          <Select
            items={items}
            value={identityId}
            onValueChange={(v) => setIdentityId(v ?? "")}
          >
            <SelectTrigger className="w-full" aria-label="Handle to link">
              <SelectValue placeholder="Choose a handle" />
            </SelectTrigger>
            <SelectContent>
              {identities.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={pending || !identityId}
            onClick={() =>
              start(async () => {
                const res = await linkIdentityAction(customerId, identityId);
                toast[res.ok ? "success" : "error"](res.message ?? "");
                if (res.ok) setIdentityId("");
              })
            }
          >
            Link handle
          </Button>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Show the card to owners on the customer page**

In `apps/admin/src/app/(staff)/customers/[id]/page.tsx`:

```tsx
import { listLinkableIdentities } from "@bnb/core/services/identity-linking";
import { LinkIdentityCard, type LinkableIdentityOption } from "./LinkIdentityCard";
```
```tsx
  // Owner-only, and only fetched for owners: an artist never sees the list.
  const linkable: LinkableIdentityOption[] = owner
    ? (await listLinkableIdentities()).map((i) => ({
        id: i.id,
        channel: i.channel,
        label: `${i.displayName ?? "Unnamed"} · ${
          i.channel === "instagram" ? "Instagram" : "Messenger"
        } (from ${i.customerName})`,
      }))
    : [];
```
and inside the `<aside>`, after `<CustomerActions … />`:

```tsx
          {owner && (
            <LinkIdentityCard customerId={customer.id} identities={linkable} />
          )}
```

- [ ] **Step 9: Run the suites**

Run: `npm test -w @bnb/core -- src/services/identity-linking.test.ts` then `npm test -w @bnb/admin -- "src/app/(staff)/customers"`
Expected: PASS.

- [ ] **Step 10: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`

```bash
git add packages/core/src/services/identity-linking.ts packages/core/src/services/identity-linking.test.ts packages/core/src/services/index.ts "apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.tsx" "apps/admin/src/app/(staff)/customers/[id]/LinkIdentityCard.test.tsx" "apps/admin/src/app/(staff)/customers/[id]/actions.ts" "apps/admin/src/app/(staff)/customers/[id]/actions.test.ts" "apps/admin/src/app/(staff)/customers/[id]/page.tsx"
git commit -m "feat(customers): owner-only handle linking that merges the stub record away

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```

---

### Task 8: Channels panel — "Reconnect recommended" after 30 quiet days

The last Phase-3 follow-up. A Meta connection can rot silently: the token expires, the Page unsubscribes, someone removes the app in Business Settings. Nothing throws — messages simply stop arriving. The one honest signal we already hold is `lastEventAt`.

**Ruling 10 applies here:** the `GET /debug_token` probe is **not** built. Graph's debug endpoint takes both tokens as query parameters, and Phase 3's standing constraint is that a page token never goes in a URL. The age hint plus the existing `tokenReadable` check covers what can be covered without breaking that rule.

**Files:**
- Modify: `packages/core/src/services/channel-connections.ts`, `channel-connections.test.ts`, `apps/admin/src/app/(staff)/studio/channels/page.tsx`, `page.test.tsx`, `docs/CHANNELS.md`, `docs/PROJECT-BRIEF.md`

**Interfaces:**
- Consumes: `ChannelConnectionRow` (quoted in Task 3).
- Produces:
  ```ts
  // packages/core/src/services/channel-connections.ts
  export const RECONNECT_AFTER_DAYS = 30;
  export type ConnectionHealth =
    | { level: "ok"; message: null }
    | { level: "quiet"; message: string }
    | { level: "unreadable"; message: string };
  export function connectionHealth(
    row: Pick<ChannelConnectionRow, "tokenReadable" | "lastEventAt" | "connectedAt">,
    now?: Date,
  ): ConnectionHealth;
  ```

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/services/channel-connections.test.ts`:

```ts
import { connectionHealth, RECONNECT_AFTER_DAYS } from "./channel-connections";

describe("connectionHealth", () => {
  const NOW = new Date("2026-09-08T12:00:00.000Z");
  const CONNECTED = new Date("2026-01-01T12:00:00.000Z");

  it("is healthy when an event arrived recently", () => {
    expect(
      connectionHealth(
        {
          tokenReadable: true,
          lastEventAt: new Date("2026-09-01T12:00:00.000Z"),
          connectedAt: CONNECTED,
        },
        NOW,
      ),
    ).toEqual({ level: "ok", message: null });
  });

  it("recommends reconnecting after 30 silent days", () => {
    const health = connectionHealth(
      {
        tokenReadable: true,
        lastEventAt: new Date("2026-08-01T12:00:00.000Z"),
        connectedAt: CONNECTED,
      },
      NOW,
    );
    expect(health.level).toBe("quiet");
    expect(health.message).toBe(
      "Reconnect recommended — nothing received for 38 days.",
    );
  });

  it("measures a connection that has never received anything from when it was connected", () => {
    const health = connectionHealth(
      { tokenReadable: true, lastEventAt: null, connectedAt: CONNECTED },
      NOW,
    );
    expect(health.level).toBe("quiet");
    expect(health.message).toContain("nothing received since it was connected");
  });

  it("does not nag a Page connected yesterday that has heard nothing yet", () => {
    // Quiet is only meaningful once there has been time to be quiet in.
    expect(
      connectionHealth(
        {
          tokenReadable: true,
          lastEventAt: null,
          connectedAt: new Date("2026-09-07T12:00:00.000Z"),
        },
        NOW,
      ).level,
    ).toBe("ok");
  });

  it("reports an unreadable token ahead of anything else", () => {
    const health = connectionHealth(
      { tokenReadable: false, lastEventAt: null, connectedAt: CONNECTED },
      NOW,
    );
    expect(health).toEqual({
      level: "unreadable",
      message: "Reconnect required — the stored token can't be read.",
    });
  });

  it("keeps the threshold at 30 days", () => {
    expect(RECONNECT_AFTER_DAYS).toBe(30);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @bnb/core -- src/services/channel-connections.test.ts`
Expected: FAIL — `connectionHealth is not a function`.

- [ ] **Step 3: Implement `connectionHealth`**

Append to `packages/core/src/services/channel-connections.ts`:

```ts
/** How long a connection may go without an event before we suggest a repair. */
export const RECONNECT_AFTER_DAYS = 30;

const DAY_MS = 86_400_000;

export type ConnectionHealth =
  | { level: "ok"; message: null }
  | { level: "quiet"; message: string }
  | { level: "unreadable"; message: string };

/**
 * How a connection is doing, from what we already store.
 *
 * A Meta connection rots quietly — an expired token, an unsubscribed Page, the
 * app removed in Business Settings — and nothing throws: messages simply stop
 * arriving, which is indistinguishable from a quiet week until someone asks
 * why nobody is messaging. `lastEventAt` is the only honest signal we hold
 * without calling Graph, and it is enough to say "check this".
 *
 * We deliberately do NOT call Graph's `/debug_token`: it takes both tokens as
 * QUERY parameters, and a page token must never travel in a URL — query
 * strings end up in access logs, proxies and error trackers.
 */
export function connectionHealth(
  row: Pick<
    ChannelConnectionRow,
    "tokenReadable" | "lastEventAt" | "connectedAt"
  >,
  now: Date = new Date(),
): ConnectionHealth {
  if (!row.tokenReadable) {
    return {
      level: "unreadable",
      message: "Reconnect required — the stored token can't be read.",
    };
  }
  // A brand-new connection has not had time to be quiet in, so silence is
  // measured from whichever is later: the last event, or the connection.
  const since = row.lastEventAt ?? row.connectedAt;
  const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
  if (days < RECONNECT_AFTER_DAYS) return { level: "ok", message: null };
  return {
    level: "quiet",
    message: row.lastEventAt
      ? `Reconnect recommended — nothing received for ${days} days.`
      : `Reconnect recommended — nothing received since it was connected ${days} days ago.`,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @bnb/core -- src/services/channel-connections.test.ts`
Expected: PASS.

- [ ] **Step 5: Render it on the Channels panel**

In `apps/admin/src/app/(staff)/studio/channels/page.tsx`, import `connectionHealth` alongside `listChannelConnections`, and replace the `{c.tokenReadable ? null : (…)}` block with:

```tsx
                      {/* A rotated SESSION_SECRET, an expired token or an
                          unsubscribed Page all leave the row looking healthy
                          while every message on it fails — this is the only
                          place that is visible. */}
                      {(() => {
                        const health = connectionHealth(c);
                        if (health.level === "ok") return null;
                        return (
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-bb-gold">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {health.message}
                          </span>
                        );
                      })()}
```

- [ ] **Step 6: Assert it on the page suite**

Append to `apps/admin/src/app/(staff)/studio/channels/page.test.tsx`:

```ts
import { connectionHealth } from "@bnb/core/services/channel-connections";

/**
 * The panel is an async Server Component; its new decision is the pure health
 * verdict it renders, asserted here at the same boundary as the rest of the
 * file.
 */
describe("Channels panel connection health", () => {
  it("warns about a connection that has gone quiet", () => {
    expect(
      connectionHealth(
        {
          tokenReadable: true,
          lastEventAt: new Date(Date.now() - 40 * 86_400_000),
          connectedAt: new Date(Date.now() - 200 * 86_400_000),
        },
      ).level,
    ).toBe("quiet");
  });

  it("says nothing about a live one", () => {
    expect(
      connectionHealth({
        tokenReadable: true,
        lastEventAt: new Date(),
        connectedAt: new Date(),
      }),
    ).toEqual({ level: "ok", message: null });
  });
});
```

- [ ] **Step 7: Document it**

In `docs/CHANNELS.md`, under the Meta troubleshooting section, add:

```markdown
### "Reconnect recommended" on a connection

Studio › Channels flags any connection that has received no event for 30 days
(or, for a Page that has never received one, 30 days since it was connected).
It is a hint, not a fault: a quiet Page in a quiet month looks the same as an
expired token. Press **Connect a Facebook Page** and re-authorise; that
replaces the stored token, refreshes the Page name and re-subscribes the
webhook. If the studio genuinely had no DMs for a month, ignore it.

The panel does **not** call Graph's `/debug_token` to check the token directly:
that endpoint takes the token as a URL query parameter, and page tokens must
never appear in a URL (query strings are written to access logs). "Reconnect
required — the stored token can't be read" is the one hard failure we can
detect locally.
```

In `docs/PROJECT-BRIEF.md`, add the build-log entry for this phase:

```markdown
- **Enquiries phase 4 — inbox UX** (`feat/enquiries-phase-3`): EnquiryInbox split
  into filters/list/meta/composer, an explicit reply-channel selector with
  per-channel reachability (validated server-side), visibility-scoped tab
  counts, a nav badge that stops polling while the tab is hidden,
  `/enquiries?open=<id>` deep links, customer-page message timeline + identity
  chips, owner-only handle linking that merges stub customers away, and a
  30-day quiet-connection hint on Studio › Channels.
```

- [ ] **Step 8: Full sweep, then commit**

Run: `npm test -w @bnb/core && npm test -w @bnb/admin && npm test -w @bnb/web && npm run typecheck && npm run lint && npm run build`
Expected: all green. (`npm run build` catches Next 15 `PageProps` regressions from Task 5's `searchParams` change — the exact class of failure commit `6dc1828` fixed.)

```bash
git add packages/core/src/services/channel-connections.ts packages/core/src/services/channel-connections.test.ts "apps/admin/src/app/(staff)/studio/channels/page.tsx" "apps/admin/src/app/(staff)/studio/channels/page.test.tsx" docs/CHANNELS.md docs/PROJECT-BRIEF.md
git commit -m "feat(channels): flag a connection that has heard nothing for 30 days

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015iSmx4HGsG5fgQuibcfgGZ"
```
