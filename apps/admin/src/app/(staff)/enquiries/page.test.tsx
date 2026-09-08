import { describe, expect, it } from "vitest";
import {
  countByStatus,
  OPEN_NOT_FOUND_NOTICE,
  pickOpenState,
  resolveOpenParam,
} from "./enquiry-helpers";

/**
 * The enquiries page is an async Server Component (DB + server-only). Its
 * inbox tallies are the pure countByStatus helper, asserted here.
 */
describe("EnquiriesPage tallies", () => {
  it("counts an empty inbox as zero across statuses", () => {
    expect(countByStatus([])).toEqual({
      new: 0,
      replied: 0,
      customer_replied: 0,
      converted: 0,
      closed: 0,
    });
  });
});

/**
 * The page itself is an async Server Component (DB + server-only). Its
 * deep-link decision is these two pure helpers, asserted end to end here.
 */
describe("EnquiriesPage ?open= handling", () => {
  it("turns an inaccessible id into a notice rather than an error", () => {
    const id = resolveOpenParam("cln4missing0000");
    expect(id).toBe("cln4missing0000");
    // The scoped query returned nothing, so `items` does not contain it.
    expect(pickOpenState([{ id: "e1", status: "new" }], id)).toEqual({
      openId: null,
      tab: null,
      notice: OPEN_NOT_FOUND_NOTICE,
    });
  });

  it("never queries a malformed id at all", () => {
    expect(resolveOpenParam("<script>")).toBeNull();
  });
});
