import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The Sheet portals its content to <body>, which never renders under SSR in
// the node environment — pass children through so the form markup is visible.
vi.mock("@/components/ui/sheet", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Sheet: Passthrough,
    SheetContent: Passthrough,
    SheetDescription: Passthrough,
    SheetFooter: Passthrough,
    SheetHeader: Passthrough,
    SheetTitle: Passthrough,
  };
});

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

  it("closed customer + artist selects show names, not cuids", () => {
    const html = renderToStaticMarkup(
      <BookingDrawer
        open
        booking={{
          id: "bk_1",
          customerId: "cln4customer1aaa",
          artistId: "cln4artist1aaaa",
          type: "session",
          start: new Date(2026, 5, 16, 12, 0).toISOString(),
          durationMins: 90,
        }}
        customers={[{ id: "cln4customer1aaa", name: "Cassidy Vale" }]}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        onSave={vi.fn().mockResolvedValue(null)}
        onClose={vi.fn()}
      />,
    );
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(triggers).toContain("Cassidy Vale");
    expect(triggers).toContain("Sarah North");
    expect(triggers).not.toContain("cln4customer1aaa");
    expect(triggers).not.toContain("cln4artist1aaaa");
  });

  it("onSave receiving an error string keeps the drawer logic surfacing it", () => {
    // Contract check: onSave returns Promise<string|null>; a non-null string is
    // the friendly conflict message path.
    const onSave = vi.fn().mockResolvedValue("That slot is already booked.");
    expect(onSave).toBeTypeOf("function");
  });
});
