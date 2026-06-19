import { describe, expect, it } from "vitest";
import { CustomersTable, type CustomerRow } from "./CustomersTable";

describe("CustomersTable contract", () => {
  it("is a component function", () => {
    expect(typeof CustomersTable).toBe("function");
  });

  it("accepts the precomputed directory row shape", () => {
    const rows: CustomerRow[] = [
      {
        id: "c1",
        name: "Amy",
        email: "amy@example.com",
        phone: "",
        loyaltyStamps: 3,
        loyaltyTier: 1,
        lastVisit: "2026-05-01T00:00:00Z",
        nextVisit: null,
      },
    ];
    expect(rows[0].name).toBe("Amy");
  });
});
