import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { weekStateToRules, rulesToWeekState } from "./availability-helpers";

/**
 * The editor renders in the browser and calls /api/availability + /api/leave;
 * its logic is the pure availability-helpers asserted here and in
 * availability-helpers.test.ts. SSR markup assertions cover the artist picker.
 */
describe("AvailabilityEditor round-trip", () => {
  it("round-trips rules through week state", () => {
    const rules = [
      { weekday: 1, startTime: "09:00", endTime: "17:00" },
      { weekday: 5, startTime: "10:00", endTime: "16:00" },
    ];
    expect(weekStateToRules(rulesToWeekState(rules))).toEqual(rules);
  });

  it("closed artist select shows the artist's name, not the cuid", () => {
    const html = renderToStaticMarkup(
      <AvailabilityEditor
        artists={[
          { id: "cln4artist1aaaa", name: "Sarah North" },
          { id: "cln4artist2bbbb", name: "Bandit" },
        ]}
        initialArtistId="cln4artist1aaaa"
        initialRules={[]}
        lockArtist={false}
      />,
    );
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("Sarah North");
  });
});
