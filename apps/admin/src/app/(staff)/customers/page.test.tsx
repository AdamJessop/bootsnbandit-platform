import { describe, expect, it } from "vitest";
import { deriveVisits } from "../_shared/labels";

/**
 * The page is an async Server Component that reaches the DB (verified by the
 * production build + manual QA, and cannot import `server-only` under vitest).
 * Its only non-trivial logic is deriving last/next visit, which lives in the
 * pure `deriveVisits` helper and is asserted here.
 */
describe("CustomersPage row shaping", () => {
  it("derives last + next visit from booking starts", () => {
    const now = new Date("2026-06-19T00:00:00Z").getTime();
    const r = deriveVisits(
      ["2026-04-01T00:00:00Z", "2026-09-01T00:00:00Z"],
      now,
    );
    expect(r.lastVisit).toBe("2026-04-01T00:00:00.000Z");
    expect(r.nextVisit).toBe("2026-09-01T00:00:00.000Z");
  });
});
