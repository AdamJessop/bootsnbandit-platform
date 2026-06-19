import { describe, expect, it } from "vitest";
import { initialState, toLocalParts } from "./booking-drawer-state";

describe("toLocalParts", () => {
  it("splits an ISO timestamp into date + time", () => {
    const iso = new Date(2026, 5, 16, 12, 30).toISOString();
    const { date, time } = toLocalParts(iso);
    expect(date).toBe("2026-06-16");
    expect(time).toBe("12:30");
  });
});

describe("initialState", () => {
  it("defaults a fresh create to a 90-min session", () => {
    const s = initialState(undefined, "art_default");
    expect(s.artistId).toBe("art_default");
    expect(s.type).toBe("session");
    expect(s.durationMins).toBe(90);
    expect(s.status).toBe("pending");
    expect(s.priceEstimatePounds).toBe("");
  });

  it("seeds from an existing booking, converting pence to pounds", () => {
    const s = initialState(
      {
        id: "bk_1",
        customerId: "cus_1",
        artistId: "art_1",
        type: "consult",
        priceEstimate: 12500,
        start: new Date(2026, 5, 16, 14, 0).toISOString(),
        durationMins: 60,
        status: "confirmed",
      },
      "art_default",
    );
    expect(s.customerId).toBe("cus_1");
    expect(s.artistId).toBe("art_1"); // booking wins over default
    expect(s.type).toBe("consult");
    expect(s.priceEstimatePounds).toBe("125.00");
    expect(s.time).toBe("14:00");
    expect(s.status).toBe("confirmed");
  });
});
