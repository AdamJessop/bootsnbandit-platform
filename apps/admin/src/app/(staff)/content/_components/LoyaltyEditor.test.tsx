import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoyaltyEditor } from "./LoyaltyEditor";

describe("LoyaltyEditor", () => {
  it("renders the perks ladder as editable text and config fields", () => {
    const html = renderToStaticMarkup(
      <LoyaltyEditor
        action={vi.fn()}
        values={{
          name: "Bandit Pass",
          stampsPerVisit: 1,
          spendPerStamp: 5000,
          rewardThreshold: 8,
          rewardDesc: "Free small tattoo",
          expiryMonths: 12,
          messaging: "Collect stamps",
          perks: [{ stamps: 2, title: "Birthday", desc: "A drink" }],
          active: true,
        }}
      />,
    );
    expect(html).toContain("Perks ladder");
    expect(html).toContain("2 | Birthday | A drink");
    expect(html).toContain('name="stampsPerVisit"');
  });
});
