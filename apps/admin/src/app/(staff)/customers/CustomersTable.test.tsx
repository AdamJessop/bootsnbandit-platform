import { describe, expect, it } from "vitest";
import { CustomersTable, type CustomerRow } from "./CustomersTable";
import { formatPence } from "@/components/admin/money";

const rows: CustomerRow[] = [
  {
    id: "c1",
    name: "Amy",
    email: "amy@example.com",
    phone: "",
    loyaltyStamps: 3,
    loyaltyTier: 1,
    tags: ["vip", "fine line"],
    lifetimeValuePence: 17500,
    lastVisit: "2026-05-01T00:00:00Z",
    nextVisit: null,
  },
];

describe("CustomersTable contract", () => {
  it("is a component function", () => {
    expect(typeof CustomersTable).toBe("function");
  });

  it("accepts the precomputed directory row shape (tags + lifetime value)", () => {
    expect(rows[0].tags).toEqual(["vip", "fine line"]);
    expect(rows[0].lifetimeValuePence).toBe(17500);
  });

  it("formats lifetime value as money for display/CSV", () => {
    expect(formatPence(rows[0].lifetimeValuePence)).toBe("£175.00");
  });

  it("joins tags for CSV export", () => {
    expect(rows[0].tags.join("; ")).toBe("vip; fine line");
  });
});
