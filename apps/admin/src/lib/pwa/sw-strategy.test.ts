import { describe, expect, it } from "vitest";
import { cacheStrategyFor } from "./sw-strategy";

/**
 * Mirrors the routing decisions in public/sw.js so the strategy is covered in
 * the test env (the SW itself needs a ServiceWorker global scope to run).
 */
describe("cacheStrategyFor", () => {
  const origin = "https://studio.test";

  it("passes through non-GET requests (writes never cached)", () => {
    expect(
      cacheStrategyFor({
        method: "POST",
        url: `${origin}/`,
        mode: "navigate",
        origin,
      }),
    ).toBe("passthrough");
  });

  it("passes through cross-origin requests", () => {
    expect(
      cacheStrategyFor({
        method: "GET",
        url: "https://other.test/x",
        mode: "no-cors",
        origin,
      }),
    ).toBe("passthrough");
  });

  it("passes through API requests", () => {
    expect(
      cacheStrategyFor({
        method: "GET",
        url: `${origin}/api/bookings`,
        mode: "cors",
        origin,
      }),
    ).toBe("passthrough");
  });

  it("uses network-first for HTML navigations", () => {
    expect(
      cacheStrategyFor({
        method: "GET",
        url: `${origin}/calendar`,
        mode: "navigate",
        origin,
      }),
    ).toBe("network-first");
  });

  it("uses stale-while-revalidate for static assets", () => {
    expect(
      cacheStrategyFor({
        method: "GET",
        url: `${origin}/icons/icon.svg`,
        mode: "no-cors",
        origin,
      }),
    ).toBe("stale-while-revalidate");
  });
});
