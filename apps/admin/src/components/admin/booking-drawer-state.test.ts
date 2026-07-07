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
  it("defaults a fresh create to a 90-min confirmed session", () => {
    const s = initialState(undefined, "art_default");
    expect(s.artistId).toBe("art_default");
    expect(s.type).toBe("session");
    expect(s.durationMins).toBe(90);
    expect(s.status).toBe("confirmed");
    expect(s.priceEstimatePounds).toBe("");
  });

  it("seeds the existing-customer mode with blank new-customer fields", () => {
    const s = initialState(undefined, "art_default");
    expect(s.customerMode).toBe("existing");
    expect(s.newCustomerName).toBe("");
    expect(s.newCustomerDob).toBe("");
    expect(s.newCustomerEmail).toBe("");
  });

  it("a clicked empty slot (start, no id) is still a new draft → confirmed", () => {
    const s = initialState(
      { start: new Date(2026, 5, 16, 12, 0).toISOString() },
      "art_default",
    );
    expect(s.status).toBe("confirmed");
  });

  it("editing an existing booking keeps its stored status", () => {
    const s = initialState(
      { id: "bk_1", customerId: "cus_1", status: "pending" },
      "art_default",
    );
    expect(s.status).toBe("pending");
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
