import { describe, expect, it } from "vitest";
import { parseLoyaltyForm, parsePerksText, perksToText } from "./loyalty-form";

describe("parsePerksText", () => {
  it("parses one perk per line as 'stamps | title | desc'", () => {
    const perks = parsePerksText(
      "2 | Birthday treat | A drink\n8 | Free small tattoo |",
    );
    expect(perks).toEqual([
      { stamps: 2, title: "Birthday treat", desc: "A drink" },
      { stamps: 8, title: "Free small tattoo", desc: "" },
    ]);
  });

  it("ignores blank lines and rows without a numeric stamp", () => {
    expect(parsePerksText("\n  \nfoo | bar\n4 | Early access")).toEqual([
      { stamps: 4, title: "Early access", desc: "" },
    ]);
  });

  it("sorts perks ascending by stamp count", () => {
    const perks = parsePerksText("8 | High\n2 | Low");
    expect(perks.map((p) => p.stamps)).toEqual([2, 8]);
  });
});

describe("perksToText round-trips", () => {
  it("renders perks back to editable text", () => {
    const text = "2 | Birthday treat | A drink\n8 | Free small tattoo | ";
    const perks = parsePerksText(text);
    expect(parsePerksText(perksToText(perks))).toEqual(perks);
  });
});

describe("parseLoyaltyForm", () => {
  function fd(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  }

  it("coerces numeric fields and parses perks JSON", () => {
    const out = parseLoyaltyForm(
      fd({
        name: "Bandit Pass",
        stampsPerVisit: "1",
        spendPerStamp: "5000",
        rewardThreshold: "8",
        rewardDesc: "Free small tattoo",
        expiryMonths: "12",
        messaging: "Collect stamps!",
        perksText: "2 | Birthday | \n8 | Free | ",
        active: "on",
      }),
    );
    expect(out.stampsPerVisit).toBe(1);
    expect(out.spendPerStamp).toBe(5000);
    expect(out.rewardThreshold).toBe(8);
    expect(out.expiryMonths).toBe(12);
    expect(out.active).toBe(true);
    expect(out.perks).toHaveLength(2);
  });

  it("treats empty optional numbers as null and missing active as false", () => {
    const out = parseLoyaltyForm(
      fd({
        name: "Bandit Pass",
        stampsPerVisit: "1",
        spendPerStamp: "",
        rewardThreshold: "8",
        expiryMonths: "",
        perksText: "",
      }),
    );
    expect(out.spendPerStamp).toBeNull();
    expect(out.expiryMonths).toBeNull();
    expect(out.active).toBe(false);
    expect(out.perks).toEqual([]);
  });

  it("throws when name is blank", () => {
    expect(() => parseLoyaltyForm(fd({ name: " " }))).toThrow();
  });
});
