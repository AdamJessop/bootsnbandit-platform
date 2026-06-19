import { describe, expect, it } from "vitest";
import { rulesToWeekState } from "./availability-helpers";

/**
 * The availability page is an async Server Component (DB + server-only). The
 * weekly-grid mapping is the pure rulesToWeekState helper, asserted here.
 */
describe("AvailabilityPage week state", () => {
  it("defaults all days disabled when there are no rules", () => {
    expect(rulesToWeekState([]).every((d) => !d.enabled)).toBe(true);
  });
});
