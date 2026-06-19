import { describe, expect, it } from "vitest";
import { formatPence } from "@/components/admin/money";

/**
 * The sessions page is an async Server Component (DB + server-only). The
 * completion logic is in session-complete-logic.ts; here we sanity-check the
 * money formatting used to show the estimate.
 */
describe("SessionsPage estimate formatting", () => {
  it("formats the price estimate", () => {
    expect(formatPence(12500)).toBe("£125.00");
  });
});
