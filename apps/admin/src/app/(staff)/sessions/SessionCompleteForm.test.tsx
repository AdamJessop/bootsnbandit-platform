import { describe, expect, it } from "vitest";
import { buildSessionPayload, summariseResult } from "./session-complete-logic";

/**
 * The form renders in the browser; its logic (validate → payload → submit →
 * summary) is the pure session-complete-logic module asserted here and in
 * session-complete-logic.test.ts.
 */
describe("SessionCompleteForm logic", () => {
  it("builds a pence payload from pounds inputs", () => {
    const r = buildSessionPayload({ bookingId: "b1", amount: "90", tip: "5" });
    expect(r.ok && r.payload.amountChargedPence).toBe(9000);
  });

  it("summarises receipt + aftercare + loyalty", () => {
    const s = summariseResult({
      session: { id: "s1", amountChargedPence: 9000 },
      loyalty: { loyaltyStamps: 2, loyaltyTier: 1, unlockedPerks: [] },
    });
    expect(s.receiptSent).toBe(true);
    expect(s.aftercareSent).toBe(true);
    expect(s.loyaltyStamps).toBe(2);
  });
});
