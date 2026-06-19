import { describe, expect, it, vi } from "vitest";

// FrontDeskClient pulls the calendar server actions (server-only auth) in
// transitively; stub the boundary so the graph loads under node.
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class extends Error {},
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}));

import { FrontDeskClient } from "./FrontDeskClient";

describe("FrontDeskClient module", () => {
  it("exports the client component", () => {
    expect(typeof FrontDeskClient).toBe("function");
  });
});
