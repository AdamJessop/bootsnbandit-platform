import { describe, expect, it } from "vitest";
import { countByStatus } from "./enquiry-helpers";

/**
 * The enquiries page is an async Server Component (DB + server-only). Its
 * inbox tallies are the pure countByStatus helper, asserted here.
 */
describe("EnquiriesPage tallies", () => {
  it("counts an empty inbox as zero across statuses", () => {
    expect(countByStatus([])).toEqual({
      new: 0,
      replied: 0,
      converted: 0,
      closed: 0,
    });
  });
});
