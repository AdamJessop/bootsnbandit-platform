import { describe, expect, it } from "vitest";
import { suggestSessionPricePence } from "./pricing";

describe("suggestSessionPricePence", () => {
  it("uses the day rate for sessions of 6h+ when a day rate is set", () => {
    const price = suggestSessionPricePence(
      { hourlyRatePence: 9000, dayRatePence: 55000 },
      360,
    );
    expect(price).toBe(55000);
  });

  it("uses the day rate beyond 6h too", () => {
    const price = suggestSessionPricePence(
      { hourlyRatePence: 9000, dayRatePence: 55000 },
      480,
    );
    expect(price).toBe(55000);
  });

  it("falls back to ceil-hours × hourly rate under 6h", () => {
    // 90min → ceil(1.5) = 2 hours × £90 = £180
    expect(
      suggestSessionPricePence(
        { hourlyRatePence: 9000, dayRatePence: 55000 },
        90,
      ),
    ).toBe(18000);
  });

  it("rounds partial hours up", () => {
    // 61min → ceil(1.0167) = 2 hours × £45 = £90
    expect(suggestSessionPricePence({ hourlyRatePence: 4500 }, 61)).toBe(9000);
  });

  it("uses hourly when 6h+ but no day rate is set", () => {
    // 360min, no day rate → 6 × £45 = £270
    expect(
      suggestSessionPricePence(
        { hourlyRatePence: 4500, dayRatePence: null },
        360,
      ),
    ).toBe(27000);
  });

  it("returns undefined when no rate is available", () => {
    expect(suggestSessionPricePence({}, 120)).toBeUndefined();
    expect(
      suggestSessionPricePence(
        { hourlyRatePence: null, dayRatePence: null },
        120,
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a 6h+ session with only a null day rate and no hourly", () => {
    expect(
      suggestSessionPricePence({ dayRatePence: null }, 420),
    ).toBeUndefined();
  });
});
