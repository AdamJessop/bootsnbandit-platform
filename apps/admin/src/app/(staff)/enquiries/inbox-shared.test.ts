import { describe, expect, it } from "vitest";
import {
  ALL,
  CHANNEL_BADGE,
  SOURCE_FILTER_ITEMS,
  STATUS_ORDER,
} from "./inbox-shared";

describe("inbox-shared constants", () => {
  it("orders every enquiry status exactly once", () => {
    expect(STATUS_ORDER).toEqual([
      "new",
      "customer_replied",
      "replied",
      "converted",
      "closed",
    ]);
    expect(new Set(STATUS_ORDER).size).toBe(STATUS_ORDER.length);
  });

  it("badges every channel, including the Meta ones", () => {
    // A missing entry would render `undefined` in a row's badge.
    expect(Object.keys(CHANNEL_BADGE).sort()).toEqual([
      "email",
      "flash",
      "inkling",
      "instagram",
      "messenger",
      "web",
    ]);
    expect(CHANNEL_BADGE.inkling).toBe("Mood board");
    expect(Object.values(CHANNEL_BADGE).every(Boolean)).toBe(true);
  });

  it("leads the source filter with the all-sources sentinel", () => {
    expect(SOURCE_FILTER_ITEMS[0]).toEqual({
      value: ALL,
      label: "All sources",
    });
    // The sentinel must never collide with a real EnquirySource value.
    expect(SOURCE_FILTER_ITEMS.filter((s) => s.value === ALL)).toHaveLength(1);
  });
});
