import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// recharts needs a browser; the chart internals are covered by chart-utils.
vi.mock("@/components/admin/ChartWrapper", () => ({
  ChartWrapper: () => <div data-slot="chart" />,
}));

import { ReportsView } from "./ReportsView";
import { toReportCsv } from "./report-data";

/**
 * ReportsView renders recharts in the browser; its data transforms +
 * CSV are the pure report-data helpers asserted here and in
 * report-data.test.ts. SSR markup assertions cover the artist filter.
 */
describe("ReportsView CSV", () => {
  it("exports per-artist rows", () => {
    const csv = toReportCsv([
      {
        artistName: "Boots",
        bookings: 1,
        completed: 1,
        revenuePence: 10000,
        utilisationPct: 50,
      },
    ]);
    expect(csv).toContain("Boots,1,1,100.00,50");
  });
});

describe("ReportsView artist select", () => {
  const base = {
    from: "2026-06-01",
    to: "2026-06-30",
    artists: [{ id: "cln4artist1aaaa", name: "Sarah North" }],
    canChooseArtist: true,
    totals: { bookings: 0, completed: 0, revenuePence: 0, utilisationPct: 0 },
    revenueTrend: [],
    bookingsByStatus: [],
    capacityByArtist: [],
    styleMix: [],
    csvRows: [],
  };

  it("closed trigger shows the selected artist's name, not the cuid", () => {
    const html = renderToStaticMarkup(
      <ReportsView {...base} artistId="cln4artist1aaaa" />,
    );
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("Sarah North");
  });

  it('closed trigger shows "All artists" for the all sentinel', () => {
    const html = renderToStaticMarkup(<ReportsView {...base} artistId="" />);
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("All artists");
  });
});
