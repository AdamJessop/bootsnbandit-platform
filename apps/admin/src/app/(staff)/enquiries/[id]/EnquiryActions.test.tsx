import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { EnquiryActions } from "./EnquiryActions";
import type { EnquiryItem } from "../inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  customerId: "c1",
  contactName: "Dec",
  contactEmail: "dec@example.test",
  subject: null,
  style: null,
  placement: null,
  size: null,
  budgetPence: null,
  description: null,
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "email",
  preferredArtistId: null,
  preferredArtistName: null,
  createdAtISO: "2026-09-08T06:13:00Z",
  lastMessageAtISO: null,
  unread: true,
  thread: [],
  replyOptions: [],
  defaultReplyChannel: "email",
};
const ARTISTS = [{ id: "a1", name: "Sarah North" }];

describe("EnquiryActions", () => {
  it("offers an artist Take this on an unassigned enquiry, and names the steps", () => {
    const html = renderToStaticMarkup(
      <EnquiryActions item={ITEM} artists={ARTISTS} canConvert viewerArtistId="a1" />,
    );
    expect(html).toContain("Take this enquiry");
    expect(html).toContain("Who&#x27;s taking it");
    expect(html).toContain("Book a consult");
    expect(html).toContain("Finished with it");
    expect(html).toContain("Pick an artist first.");
  });

  it("never offers an owner the take button, and says who has it when assigned", () => {
    const html = renderToStaticMarkup(
      <EnquiryActions
        item={{ ...ITEM, preferredArtistId: "a1", preferredArtistName: "Sarah North" }}
        artists={ARTISTS}
        canConvert
        viewerArtistId={null}
      />,
    );
    expect(html).not.toContain("Take this enquiry");
    expect(html).toContain("Sarah North has it.");
    // The assign select is seeded with the artist's name, never the cuid.
    expect(html).not.toContain(">a1<");
  });

  it("hides the consult step when the viewer cannot convert, and disables close on a closed enquiry", () => {
    const html = renderToStaticMarkup(
      <EnquiryActions
        item={{ ...ITEM, status: "closed" }}
        artists={ARTISTS}
        canConvert={false}
        viewerArtistId={null}
      />,
    );
    expect(html).not.toContain("Book a consult");
    expect(html).toContain("This enquiry is closed.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Closed<\/button>/);
  });
});
