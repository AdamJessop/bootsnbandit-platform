import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline-builder";

/**
 * The detail page is an async Server Component (DB + server-only). Its timeline
 * assembly is the pure buildTimeline transform, asserted here and in
 * timeline-builder.test.ts; DB wiring is covered by the build + manual QA.
 */
describe("CustomerDetailPage timeline", () => {
  it("produces an empty stream for a customer with no history", () => {
    expect(
      buildTimeline({
        enquiries: [],
        bookings: [],
        sessions: [],
        messages: [],
        loyalty: { stamps: 0, tier: 0 },
      }),
    ).toEqual([]);
  });
});
