import { describe, expect, it } from "vitest";
import { shouldRefreshNow, UNREAD_POLL_MS } from "./refresh-poll";

describe("shouldRefreshNow", () => {
  it("polls a visible tab", () => {
    expect(shouldRefreshNow("visible")).toBe(true);
  });

  it("does not poll a hidden tab", () => {
    // A backgrounded PWA on a phone would otherwise re-render the whole staff
    // tree every minute, all day, for counts nobody is looking at.
    expect(shouldRefreshNow("hidden")).toBe(false);
  });

  it("polls when the browser tells us nothing", () => {
    expect(shouldRefreshNow(undefined)).toBe(true);
    expect(shouldRefreshNow("prerender")).toBe(true);
  });

  it("keeps the kiosk-style one-minute cadence", () => {
    expect(UNREAD_POLL_MS).toBe(60_000);
  });
});
