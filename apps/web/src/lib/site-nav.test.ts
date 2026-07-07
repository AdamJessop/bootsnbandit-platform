import { describe, expect, it } from "vitest";
import { mergeShellSettings, SITE_NAV, STUDIO, TICKER_LINES } from "./site-nav";

describe("SITE_NAV", () => {
  it("keeps the public routes registered", () => {
    expect(SITE_NAV.map((i) => i.href)).toContain("/enquire");
  });

  it("registers the customer sign-in route", () => {
    const signIn = SITE_NAV.find((i) => i.href === "/account/sign-in");
    expect(signIn?.label).toBe("Sign in");
  });
});

describe("mergeShellSettings", () => {
  it("returns the hardcoded fallbacks for a null settings row", () => {
    const shell = mergeShellSettings(null);
    expect(shell.name).toBe(STUDIO.name);
    expect(shell.address).toBe(STUDIO.address);
    expect(shell.hours).toBe(STUDIO.hours);
    expect(shell.phone).toBe(STUDIO.phone);
    expect(shell.instagram).toBe(STUDIO.instagram);
    expect(shell.facebook).toBe(STUDIO.facebook);
    expect(shell.tickerLines).toEqual(TICKER_LINES);
  });

  it("prefers CMS values when present", () => {
    const shell = mergeShellSettings({
      studioName: "Boots 'n' Bandit Tattoo Studio",
      addressLine: "1 New Row",
      city: "Worksop",
      county: "Notts",
      postcode: "S80 9ZZ",
      hoursText: "Wed–Sun 11–7",
      phone: "01909 111 222",
      instagramUrl: "https://instagram.com/newhandle",
      facebookUrl: "https://facebook.com/newpage",
      tickerLines: ["Books closed until March"],
    });
    expect(shell.name).toBe("Boots 'n' Bandit Tattoo Studio");
    expect(shell.address).toBe("1 New Row, Worksop, Notts, S80 9ZZ");
    expect(shell.hours).toBe("Wed–Sun 11–7");
    expect(shell.phone).toBe("01909 111 222");
    expect(shell.instagram).toBe("https://instagram.com/newhandle");
    expect(shell.facebook).toBe("https://facebook.com/newpage");
    expect(shell.tickerLines).toEqual(["Books closed until March"]);
  });

  it("falls back per-field when CMS fields are empty", () => {
    const shell = mergeShellSettings({
      studioName: "  ",
      addressLine: null,
      hoursText: "",
      phone: "01909 333 444",
      tickerLines: [],
    });
    expect(shell.name).toBe(STUDIO.name);
    expect(shell.address).toBe(STUDIO.address);
    expect(shell.hours).toBe(STUDIO.hours);
    expect(shell.phone).toBe("01909 333 444");
    expect(shell.tickerLines).toEqual(TICKER_LINES);
  });

  it("drops blank ticker lines before deciding on the fallback", () => {
    expect(mergeShellSettings({ tickerLines: ["", "  "] }).tickerLines).toEqual(
      TICKER_LINES,
    );
    expect(
      mergeShellSettings({ tickerLines: ["Open late Fridays", ""] })
        .tickerLines,
    ).toEqual(["Open late Fridays"]);
  });
});
