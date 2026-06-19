import { describe, expect, it } from "vitest";
import type { EnquiryItem } from "./EnquiryInbox";
import { countByStatus } from "./enquiry-helpers";

/**
 * EnquiryInbox imports the "use server" actions module (server-only, not
 * importable under vitest), so we assert the pure tally helper it relies on
 * rather than importing the component. Rendering is covered by the build.
 */
const items: EnquiryItem[] = [
  {
    id: "1",
    contactName: "Amy",
    contactEmail: "amy@x.com",
    style: "fine line",
    placement: "arm",
    size: "small",
    budgetPence: 15000,
    description: "ladybird",
    status: "new",
    source: "web",
    preferredArtistId: "a1",
    createdAtISO: "2026-06-01T10:00:00Z",
  },
  {
    id: "2",
    contactName: "Bob",
    contactEmail: null,
    style: null,
    placement: null,
    size: null,
    budgetPence: null,
    description: null,
    status: "converted",
    source: "flash",
    preferredArtistId: null,
    createdAtISO: "2026-06-02T10:00:00Z",
  },
];

describe("countByStatus", () => {
  it("tallies enquiries per status", () => {
    const counts = countByStatus(items);
    expect(counts.new).toBe(1);
    expect(counts.converted).toBe(1);
    expect(counts.replied).toBe(0);
    expect(counts.closed).toBe(0);
  });
});
