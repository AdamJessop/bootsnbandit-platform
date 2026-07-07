import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows hits up to the limit within one window", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(rl.hit("a", 1_000)).toBe(true);
    expect(rl.hit("a", 2_000)).toBe(true);
    expect(rl.hit("a", 3_000)).toBe(true);
    expect(rl.hit("a", 4_000)).toBe(false);
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.hit("a", 1_000)).toBe(true);
    expect(rl.hit("b", 1_000)).toBe(true);
    expect(rl.hit("a", 2_000)).toBe(false);
  });

  it("slides: hits older than the window free up capacity", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 10_000 });
    expect(rl.hit("a", 1_000)).toBe(true);
    expect(rl.hit("a", 5_000)).toBe(true);
    expect(rl.hit("a", 9_000)).toBe(false);
    // t=1000 falls out of the window at t>11000; t=5000 is still in.
    expect(rl.hit("a", 11_500)).toBe(true);
    expect(rl.hit("a", 11_600)).toBe(false);
  });

  it("a rejected hit does not consume capacity", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 10_000 });
    expect(rl.hit("a", 1_000)).toBe(true);
    expect(rl.hit("a", 2_000)).toBe(false);
    // The rejection at t=2000 must not extend the block past t=11000.
    expect(rl.hit("a", 11_500)).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://x/", { headers });

  it("uses the first x-forwarded-for hop", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
    ).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
    expect(clientIp(req({}))).toBe("unknown");
  });
});
