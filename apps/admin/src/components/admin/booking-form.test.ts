import { describe, expect, it } from "vitest";
import {
  DURATION_OPTIONS,
  draftToPayload,
  formatPence,
  parsePounds,
  suggestedPricePounds,
  validateDraft,
  type BookingFormState,
} from "./booking-form";

const baseState = (over: Partial<BookingFormState> = {}): BookingFormState => ({
  customerId: "cus_1",
  artistId: "art_1",
  type: "session",
  style: "Traditional",
  placement: "Forearm",
  date: "2026-06-16",
  time: "12:00",
  durationMins: 90,
  priceEstimatePounds: "120",
  notes: "",
  status: "pending",
  ...over,
});

describe("formatPence / parsePounds", () => {
  it("formats pence to GBP", () => {
    expect(formatPence(12000)).toBe("£120.00");
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(9999)).toBe("£99.99");
  });

  it("parses pounds strings to integer pence", () => {
    expect(parsePounds("120")).toBe(12000);
    expect(parsePounds("99.99")).toBe(9999);
    expect(parsePounds("£12.5")).toBe(1250);
    expect(parsePounds("")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
  });

  it("offers sensible duration presets", () => {
    expect(DURATION_OPTIONS).toContain(60);
    expect(DURATION_OPTIONS).toContain(90);
  });
});

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(baseState())).toEqual({});
  });

  it("requires a customer", () => {
    const errors = validateDraft(baseState({ customerId: "" }));
    expect(errors.customerId).toBeTruthy();
  });

  it("requires an artist, date and time", () => {
    expect(validateDraft(baseState({ artistId: "" })).artistId).toBeTruthy();
    expect(validateDraft(baseState({ date: "" })).date).toBeTruthy();
    expect(validateDraft(baseState({ time: "" })).time).toBeTruthy();
  });

  it("requires a positive duration", () => {
    expect(
      validateDraft(baseState({ durationMins: 0 })).durationMins,
    ).toBeTruthy();
  });

  it("rejects a malformed price", () => {
    expect(
      validateDraft(baseState({ priceEstimatePounds: "abc" }))
        .priceEstimatePounds,
    ).toBeTruthy();
    // empty price is allowed (optional estimate)
    expect(
      validateDraft(baseState({ priceEstimatePounds: "" })).priceEstimatePounds,
    ).toBeUndefined();
  });
});

describe("suggestedPricePounds", () => {
  const rates = { hourlyRatePence: 9000, dayRatePence: 55000 };

  it("suggests ceil(hours) × hourly for short sessions", () => {
    // 90 min → 2 hr → 2 × £90 = £180
    expect(suggestedPricePounds(rates, 90)).toBe("180.00");
  });

  it("uses the day rate for 6h+ sessions when set", () => {
    expect(suggestedPricePounds(rates, 360)).toBe("550.00");
  });

  it("returns '' when no rate is available", () => {
    expect(
      suggestedPricePounds({ hourlyRatePence: null, dayRatePence: null }, 90),
    ).toBe("");
    expect(suggestedPricePounds(undefined, 90)).toBe("");
  });
});

describe("draftToPayload", () => {
  it("builds the /api start/end window and pence price", () => {
    const payload = draftToPayload(baseState());
    expect(payload.customerId).toBe("cus_1");
    expect(payload.artistId).toBe("art_1");
    expect(payload.type).toBe("session");
    expect(payload.durationMin).toBe(90);
    expect(payload.priceEstimatePence).toBe(12000);
    const start = new Date(payload.start);
    const end = new Date(payload.end);
    expect((end.getTime() - start.getTime()) / 60000).toBe(90);
    expect(start.getHours()).toBe(12);
  });

  it("omits price when blank", () => {
    const payload = draftToPayload(baseState({ priceEstimatePounds: "" }));
    expect(payload.priceEstimatePence).toBeNull();
  });
});
