import { describe, expect, it } from "vitest";
import { CHART_COLORS, chartTotal, isChartEmpty } from "./chart-utils";

describe("isChartEmpty", () => {
  it("is empty for no data", () => {
    expect(isChartEmpty([])).toBe(true);
  });

  it("is empty when every value (and value2) is zero", () => {
    expect(
      isChartEmpty([
        { label: "a", value: 0 },
        { label: "b", value: 0, value2: 0 },
      ]),
    ).toBe(true);
  });

  it("is not empty when any value is non-zero", () => {
    expect(isChartEmpty([{ label: "a", value: 0, value2: 3 }])).toBe(false);
  });
});

describe("chartTotal", () => {
  it("sums the primary value series", () => {
    expect(
      chartTotal([
        { label: "a", value: 2 },
        { label: "b", value: 5 },
      ]),
    ).toBe(7);
  });
});

describe("CHART_COLORS", () => {
  it("exposes at least 5 accessible heritage colours", () => {
    expect(CHART_COLORS.length).toBeGreaterThanOrEqual(5);
    for (const c of CHART_COLORS) expect(c).toMatch(/^var\(--/);
  });
});
