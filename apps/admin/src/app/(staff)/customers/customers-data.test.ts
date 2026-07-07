import { describe, expect, it } from "vitest";
import { computeLifetimeValue } from "./customers-data";

describe("computeLifetimeValue", () => {
  it("sums completed session amounts per customer", () => {
    const totals = computeLifetimeValue([
      { customerId: "c1", amountPence: 12500 },
      { customerId: "c2", amountPence: 9000 },
      { customerId: "c1", amountPence: 5000 },
    ]);
    expect(totals.get("c1")).toBe(17500);
    expect(totals.get("c2")).toBe(9000);
  });

  it("returns an empty map for no sessions (customers default to 0)", () => {
    const totals = computeLifetimeValue([]);
    expect(totals.size).toBe(0);
    expect(totals.get("c1") ?? 0).toBe(0);
  });
});
