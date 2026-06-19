import { describe, expect, it } from "vitest";
import { ChartWrapper, type ChartDatum } from "./ChartWrapper";
import { CHART_COLORS, chartTotal, isChartEmpty } from "./chart-utils";

/**
 * Recharts renders in the browser; the empty/loading/total logic it relies on
 * is the pure `chart-utils` module (covered in chart-utils.test.ts). Here we
 * assert the component contract + re-assert the empty/loading decisions the
 * component branches on.
 */
describe("ChartWrapper contract", () => {
  it("is a component function", () => {
    expect(typeof ChartWrapper).toBe("function");
  });

  it("treats empty + all-zero data as empty", () => {
    const data: ChartDatum[] = [{ label: "a", value: 0 }];
    expect(isChartEmpty(data)).toBe(true);
    expect(isChartEmpty([{ label: "a", value: 5 }])).toBe(false);
  });

  it("computes a total for the alt table", () => {
    expect(chartTotal([{ label: "a", value: 3 }])).toBe(3);
  });

  it("has an accessible palette", () => {
    expect(CHART_COLORS.length).toBeGreaterThanOrEqual(5);
  });
});
