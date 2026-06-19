import { describe, expect, it } from "vitest";
import { parseSiteForm, parseTickerLines } from "./site-form";

describe("parseTickerLines", () => {
  it("splits on newlines, trims, and drops blanks", () => {
    expect(parseTickerLines("Walk-ins welcome\n\n  Flash drops Friday  \n")).toEqual(
      ["Walk-ins welcome", "Flash drops Friday"],
    );
  });

  it("returns an empty array for empty input", () => {
    expect(parseTickerLines("")).toEqual([]);
  });
});

describe("parseSiteForm", () => {
  function fd(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  }

  it("parses studio details, ticker lines, and the enquiries toggle", () => {
    const out = parseSiteForm(
      fd({
        studioName: "Boots 'n' Bandit",
        addressLine: "1 High St",
        city: "Worksop",
        postcode: "S80 1AB",
        instagramUrl: "https://instagram.com/bnb",
        tickerText: "Line one\nLine two",
        enquiriesOpen: "on",
        visualDirection: "heritage",
      }),
    );
    expect(out.studioName).toBe("Boots 'n' Bandit");
    expect(out.city).toBe("Worksop");
    expect(out.tickerLines).toEqual(["Line one", "Line two"]);
    expect(out.enquiriesOpen).toBe(true);
    expect(out.visualDirection).toBe("heritage");
  });

  it("defaults enquiriesOpen to false when the checkbox is absent and direction falls back", () => {
    const out = parseSiteForm(fd({ studioName: "Studio" }));
    expect(out.enquiriesOpen).toBe(false);
    expect(out.visualDirection).toBe("heritage");
    expect(out.tickerLines).toEqual([]);
    expect(out.addressLine).toBeNull();
  });

  it("throws when studioName is blank", () => {
    expect(() => parseSiteForm(fd({ studioName: "  " }))).toThrow();
  });
});
