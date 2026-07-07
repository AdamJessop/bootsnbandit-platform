import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// CalendarClient pulls in the server actions module transitively, which imports
// the server-only auth helper. Stub it so the module graph loads in node.
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class extends Error {},
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({
  saveBookingAction: vi.fn(),
  updateBookingAction: vi.fn(),
  CalendarGrid: vi.fn<(props: Record<string, unknown>) => null>(() => null),
  BookingDrawer: vi.fn<(props: Record<string, unknown>) => null>(() => null),
}));

vi.mock("./actions", () => ({
  saveBookingAction: mocks.saveBookingAction,
  updateBookingAction: mocks.updateBookingAction,
}));
// Capture grid/drawer props so tests can assert wiring and invoke handlers.
vi.mock("@/components/admin/CalendarGrid", () => ({
  CalendarGrid: mocks.CalendarGrid,
}));
vi.mock("@/components/admin/BookingDrawer", () => ({
  BookingDrawer: mocks.BookingDrawer,
}));
// SSR's useTransition throws when its startTransition is called post-render;
// swap in a pass-through so captured handlers (onMove) can run in node.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () => [false, (cb: () => void) => cb()] as const,
  };
});

import {
  ALL_STAFF,
  CalendarClient,
  eventArtist,
  slotDraft,
} from "./CalendarClient";
import { shiftAnchor } from "./nav";

const anchorISO = new Date(2026, 5, 16, 12).toISOString();
const artists = [
  { id: "cln4artist1aaaa", name: "Sarah North", hue: "#e11d48" },
  { id: "cln4artist2bbbb", name: "Bandit", hue: null },
];

function render(
  activeArtistId: string,
  events: Array<Record<string, unknown>> = [],
) {
  return renderToStaticMarkup(
    <CalendarClient
      canSwitchArtist
      artists={artists}
      activeArtistId={activeArtistId}
      view="day"
      anchorISO={anchorISO}
      events={
        events as unknown as React.ComponentProps<
          typeof CalendarClient
        >["events"]
      }
      leave={[]}
      customers={[]}
    />,
  );
}

function lastCall(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  mocks.saveBookingAction.mockReset();
  mocks.updateBookingAction.mockReset();
  mocks.CalendarGrid.mockClear();
  mocks.BookingDrawer.mockClear();
});

describe("CalendarClient module", () => {
  it("exports the client component", () => {
    expect(typeof CalendarClient).toBe("function");
  });

  it("uses the tested anchor stepper for nav", () => {
    const base = new Date(2026, 5, 16, 12).toISOString();
    expect(new Date(shiftAnchor(base, "day", 1)).getDate()).toBe(17);
    expect(new Date(shiftAnchor(base, "week", -1)).getDate()).toBe(9);
  });

  it("closed artist select shows the artist's name, not the cuid", () => {
    const html = render("cln4artist1aaaa");
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("Sarah North");
  });

  it("closed artist select shows All staff when the sentinel is active", () => {
    const html = render(ALL_STAFF);
    const trigger = html.match(/data-slot="select-value"[^>]*>([^<]*)</);
    expect(trigger?.[1]).toBe("All staff");
  });
});

describe("all-staff grid wiring", () => {
  it("all-staff passes allStaff mode + artist hue metadata to the grid", () => {
    render(ALL_STAFF);
    const props = lastCall(mocks.CalendarGrid);
    expect(props.mode).toBe("allStaff");
    expect(props.artists).toEqual([
      { id: "cln4artist1aaaa", name: "Sarah North", hue: "#e11d48" },
      { id: "cln4artist2bbbb", name: "Bandit", hue: null },
    ]);
  });

  it("single-artist view stays in single mode without artist metadata", () => {
    render("cln4artist1aaaa");
    const props = lastCall(mocks.CalendarGrid);
    expect(props.mode).toBe("single");
    expect(props.artists).toBeUndefined();
  });

  it("all-staff drawer has no default artist (user must pick)", () => {
    render(ALL_STAFF);
    expect(lastCall(mocks.BookingDrawer).defaultArtistId).toBeUndefined();
  });

  it("single mode drawer defaults to the active artist", () => {
    render("cln4artist1aaaa");
    expect(lastCall(mocks.BookingDrawer).defaultArtistId).toBe(
      "cln4artist1aaaa",
    );
  });
});

describe("moving a booking", () => {
  const event = {
    id: "bk1",
    type: "session",
    title: "Sleeve",
    start: new Date(2026, 5, 16, 12).toISOString(),
    end: new Date(2026, 5, 16, 14).toISOString(),
    status: "confirmed",
    artistId: "cln4artist2bbbb",
  };

  it("in all-staff mode keeps the event's own artist (not the sentinel)", async () => {
    mocks.updateBookingAction.mockResolvedValueOnce({ ok: true });
    render(ALL_STAFF, [event]);
    const onMove = lastCall(mocks.CalendarGrid).onMove as (
      id: string,
      start: string,
      end: string,
    ) => void;
    onMove("bk1", event.start, event.end);
    await vi.waitFor(() =>
      expect(mocks.updateBookingAction).toHaveBeenCalled(),
    );
    expect(mocks.updateBookingAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bk1", artistId: "cln4artist2bbbb" }),
    );
  });

  it("in single mode falls back to the active artist for untagged events", async () => {
    mocks.updateBookingAction.mockResolvedValueOnce({ ok: true });
    render("cln4artist1aaaa", [{ ...event, artistId: undefined }]);
    const onMove = lastCall(mocks.CalendarGrid).onMove as (
      id: string,
      start: string,
      end: string,
    ) => void;
    onMove("bk1", event.start, event.end);
    await vi.waitFor(() =>
      expect(mocks.updateBookingAction).toHaveBeenCalled(),
    );
    expect(mocks.updateBookingAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bk1", artistId: "cln4artist1aaaa" }),
    );
  });
});

describe("slotDraft / eventArtist helpers", () => {
  const start = new Date(2026, 5, 16, 12).toISOString();

  it("column click in all-staff pre-selects that column's artist", () => {
    expect(slotDraft(ALL_STAFF, start, "a2")).toEqual({
      start,
      artistId: "a2",
    });
  });

  it("all-staff slot without a column artist leaves the pick to the user", () => {
    expect(slotDraft(ALL_STAFF, start)).toEqual({
      start,
      artistId: undefined,
    });
  });

  it("single-mode slot uses the active artist", () => {
    expect(slotDraft("a1", start)).toEqual({ start, artistId: "a1" });
  });

  it("New button (no slot) starts a blank draft", () => {
    expect(slotDraft(ALL_STAFF)).toBeUndefined();
    expect(slotDraft("a1")).toBeUndefined();
  });

  it("editing uses the event's own artist, falling back to active", () => {
    expect(eventArtist({ artistId: "a2" }, ALL_STAFF)).toBe("a2");
    expect(eventArtist({}, "a1")).toBe("a1");
    expect(eventArtist(undefined, "a1")).toBe("a1");
  });
});
