import { describe, expect, it } from "vitest";
import {
  RETURN_REFRESH_MIN_GAP_MS,
  shouldRefreshNow,
  shouldRefreshOnReturn,
  UNREAD_POLL_MS,
} from "./refresh-poll";

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

describe("shouldRefreshOnReturn", () => {
  it("refreshes when nothing has been refreshed yet", () => {
    expect(shouldRefreshOnReturn(null, 1_000_000)).toBe(true);
  });

  it("refuses a second refresh inside the minimum gap", () => {
    // Alt-tabbing between two windows fires visibilitychange every time. Each
    // one is a full server re-render of the staff tree — on a phone that is a
    // stall and a battery cost for a badge that cannot have moved.
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 5_000)).toBe(false);
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 14_999)).toBe(false);
  });

  it("refreshes once the gap has passed", () => {
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 15_000)).toBe(true);
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 60_000)).toBe(true);
  });

  it("takes an explicit gap", () => {
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 2_000, 1_000)).toBe(
      true,
    );
    expect(shouldRefreshOnReturn(1_000_000, 1_000_000 + 500, 1_000)).toBe(
      false,
    );
  });

  it("refreshes rather than freezing when the clock jumps backwards", () => {
    // A device clock correction must never strand the badge until the clock
    // catches up again.
    expect(shouldRefreshOnReturn(1_000_000, 999_000)).toBe(true);
  });

  it("keeps the gap at 15 seconds", () => {
    expect(RETURN_REFRESH_MIN_GAP_MS).toBe(15_000);
  });
});
