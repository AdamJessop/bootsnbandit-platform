import { describe, expect, it, vi } from "vitest";

// The panel imports the server action (server-only auth) transitively; stub
// the boundary so the graph loads under node (same pattern as FrontDeskClient).
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/leave", () => ({ setLeaveStatus: vi.fn() }));

import { PendingLeavePanel } from "./PendingLeavePanel";

/**
 * The panel renders in the browser and calls setLeaveStatusAction; the
 * approve/reject behaviour itself is asserted in actions.test.ts (owner can
 * approve, artist cannot, approved leave blocks the calendar).
 */
describe("PendingLeavePanel module", () => {
  it("exports the client component", () => {
    expect(typeof PendingLeavePanel).toBe("function");
  });
});
