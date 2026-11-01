import { describe, expect, it } from "vitest";
import { PinThrottle } from "./pin-throttle";

describe("PinThrottle", () => {
  it("allows attempts until the limit, then locks out for the window", () => {
    const t = new PinThrottle(3, 60_000);
    const now = 1_000_000;
    t.recordFailure(now);
    t.recordFailure(now);
    expect(t.lockedFor(now)).toBe(0);
    t.recordFailure(now);
    expect(t.lockedFor(now)).toBe(60);
    expect(t.lockedFor(now + 59_001)).toBe(1);
    expect(t.lockedFor(now + 60_000)).toBe(0);
  });

  it("a success (reset) clears the failure count", () => {
    const t = new PinThrottle(2, 60_000);
    t.recordFailure(0);
    t.reset();
    t.recordFailure(0);
    expect(t.lockedFor(0)).toBe(0);
  });
});
