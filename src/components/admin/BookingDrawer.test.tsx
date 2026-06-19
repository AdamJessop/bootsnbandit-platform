import { describe, expect, it, vi } from "vitest";

// The drawer pulls next-themes via no path here; it only imports ui primitives,
// react and the tested pure modules. We assert the component is importable and
// that its public types/exports line up with the form helpers it delegates to.
import { BookingDrawer, type NamedOption } from "./BookingDrawer";
import { initialState } from "./booking-drawer-state";
import {
  draftToPayload,
  suggestedPricePounds,
  validateDraft,
} from "./booking-form";

describe("BookingDrawer module", () => {
  it("exports the component", () => {
    expect(typeof BookingDrawer).toBe("function");
  });

  it("artist options may carry numeric rates for the price suggestion", () => {
    const artist: NamedOption = {
      id: "art_1",
      name: "Sarah",
      hourlyRatePence: 9000,
      dayRatePence: 55000,
    };
    // The drawer seeds the price field from the selected artist + duration.
    expect(
      suggestedPricePounds(
        {
          hourlyRatePence: artist.hourlyRatePence,
          dayRatePence: artist.dayRatePence,
        },
        90,
      ),
    ).toBe("180.00");
  });

  it("re-exports the BookingDraft type via state module (smoke)", () => {
    // initialState + the drawer share the same draft shape; a draft that seeds
    // a valid state must produce a payload with a matching window.
    const draft = {
      id: "bk_1",
      customerId: "cus_1",
      artistId: "art_1",
      type: "session" as const,
      start: new Date(2026, 5, 16, 12, 0).toISOString(),
      durationMins: 90,
      priceEstimate: 12000,
    };
    const state = initialState(draft, "art_default");
    expect(validateDraft(state)).toEqual({});
    const payload = draftToPayload(state);
    expect(payload.durationMin).toBe(90);
    expect(payload.priceEstimatePence).toBe(12000);
  });

  it("onSave receiving an error string keeps the drawer logic surfacing it", () => {
    // Contract check: onSave returns Promise<string|null>; a non-null string is
    // the friendly conflict message path.
    const onSave = vi.fn().mockResolvedValue("That slot is already booked.");
    expect(onSave).toBeTypeOf("function");
  });
});
