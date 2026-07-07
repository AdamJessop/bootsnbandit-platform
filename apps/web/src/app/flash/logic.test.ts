import { describe, it, expect } from "vitest";
import { groupByDeadline, flashStock, nextDropDeadline } from "./logic";

describe("groupByDeadline", () => {
  it("groups flash items by deadline preserving first-seen order", () => {
    const groups = groupByDeadline([
      { id: "a", deadline: "Sat 7 Jun" },
      { id: "b", deadline: "Sun 8 Jun" },
      { id: "c", deadline: "Sat 7 Jun" },
    ]);
    expect(groups.map((g) => g.deadline)).toEqual(["Sat 7 Jun", "Sun 8 Jun"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "c"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["b"]);
  });

  it("buckets null deadlines together", () => {
    const groups = groupByDeadline([{ id: "a", deadline: null }]);
    expect(groups[0].deadline).toBe("Coming soon");
  });
});

describe("nextDropDeadline", () => {
  it("returns the first non-null deadline in display order", () => {
    expect(
      nextDropDeadline([
        { deadline: null },
        { deadline: "Sat 7 Jun" },
        { deadline: "Sun 8 Jun" },
      ]),
    ).toBe("Sat 7 Jun");
  });

  it("returns null when no item has a deadline (banner hides)", () => {
    expect(nextDropDeadline([])).toBeNull();
    expect(nextDropDeadline([{ deadline: null }, { deadline: undefined }])).toBeNull();
  });
});

describe("flashStock", () => {
  it("reports remaining stock", () => {
    expect(flashStock(3, 1)).toEqual({ left: 2, gone: false, low: false });
  });

  it("flags low stock at <=1 remaining", () => {
    expect(flashStock(2, 1)).toEqual({ left: 1, gone: false, low: true });
  });

  it("flags gone when fully claimed", () => {
    expect(flashStock(2, 2)).toEqual({ left: 0, gone: true, low: true });
    expect(flashStock(2, 5)).toEqual({ left: 0, gone: true, low: true });
  });
});
