import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
}));

import { EnquiryMeta } from "./EnquiryMeta";
import type { EnquiryItem } from "./inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  customerId: "cus1",
  contactName: "Amy Rowe",
  contactEmail: "amy@example.test",
  subject: "Sleeve idea",
  style: "fine line",
  placement: "forearm",
  size: "small",
  budgetPence: 15000,
  description: "A ladybird, please",
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "web",
  preferredArtistId: null,
  preferredArtistName: null,
  createdAtISO: "2026-09-01T10:00:00.000Z",
  lastMessageAtISO: null,
  unread: false,
  thread: [],
  replyOptions: [
    {
      channel: "email",
      label: "Email",
      available: true,
      hint: "Sends to amy@example.test.",
    },
    {
      channel: "messenger",
      label: "Messenger",
      available: false,
      hint: "No Messenger conversation on this thread.",
    },
    {
      channel: "instagram",
      label: "Instagram",
      available: false,
      hint: "No Instagram conversation on this thread.",
    },
    {
      channel: "note",
      label: "Internal note",
      available: true,
      hint: "Saved on the thread for staff only — never sent.",
    },
  ],
  defaultReplyChannel: "email" as const,
};

describe("EnquiryMeta", () => {
  it("shows the brief, the assign select by name, and the close control", () => {
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={{ ...ITEM, preferredArtistId: "cln4artist1aaaa" }}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        canConvert
        viewerArtistId={null}
        onDone={vi.fn()}
      />,
    );
    expect(html).toContain("fine line");
    expect(html).toContain("Sarah North");
    expect(html).toContain("Close enquiry");
    expect(html).toContain("Create consult");
  });

  it("offers an artist the take control on an unassigned enquiry", () => {
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={ITEM}
        artists={[{ id: "a1", name: "Sarah North" }]}
        canConvert
        viewerArtistId="a1"
        onDone={vi.fn()}
      />,
    );
    expect(html).toContain("Take this enquiry");
  });

  it("links to the customer record when the lead is attached to one", () => {
    // The route to everything the inbox deliberately does not carry: older
    // enquiries, bookings, notes, the rest of the history.
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={ITEM}
        artists={[]}
        canConvert={false}
        viewerArtistId={null}
        onDone={vi.fn()}
      />,
    );
    expect(html).toContain('href="/customers/cus1"');
    expect(html).toContain("View customer");
  });

  it("offers no link at all when the lead has no customer record yet", () => {
    const html = renderToStaticMarkup(
      <EnquiryMeta
        item={{ ...ITEM, customerId: null }}
        artists={[]}
        canConvert={false}
        viewerArtistId={null}
        onDone={vi.fn()}
      />,
    );
    expect(html).not.toContain("View customer");
    expect(html).not.toContain("/customers/");
  });
});
