import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The "use server" actions module imports server-only auth/db/email — stub it
// so the component module graph loads in node.
vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
  markEnquiryRead: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

// The detail Dialog portals to <body>, which never renders under SSR in the
// node environment — pass children through so the assign select is visible.
vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Passthrough,
    DialogContent: Passthrough,
    DialogDescription: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: Passthrough,
    DialogTrigger: Passthrough,
  };
});

import { EnquiryInbox, type EnquiryItem } from "./EnquiryInbox";
import { countByStatus } from "./enquiry-helpers";
const items: EnquiryItem[] = [
  {
    id: "1",
    contactName: "Amy",
    contactEmail: "amy@x.com",
    subject: "ladybird",
    style: "fine line",
    placement: "arm",
    size: "small",
    budgetPence: 15000,
    description: "ladybird",
    moodboard: ["https://x.test/a.jpg"],
    moodboardData: null,
    status: "new",
    source: "web",
    channel: "web",
    preferredArtistId: "a1",
    preferredArtistName: null,
    createdAtISO: "2026-06-01T10:00:00Z",
    lastMessageAtISO: null,
    unread: false,
    thread: [
      {
        id: "m1",
        direction: "inbound",
        channel: "web",
        authorName: null,
        fromName: "Amy",
        subject: "Thanks for your enquiry",
        bodyText: "A ladybird on the forearm please",
        deliveryStatus: "logged",
        createdAtISO: "2026-06-01T10:01:00Z",
        attachments: [],
      },
    ],
  },
  {
    id: "2",
    contactName: "Bob",
    contactEmail: null,
    subject: null,
    style: null,
    placement: null,
    size: null,
    budgetPence: null,
    description: null,
    moodboard: [],
    moodboardData: null,
    status: "converted",
    source: "flash",
    channel: "flash",
    preferredArtistId: null,
    preferredArtistName: null,
    createdAtISO: "2026-06-02T10:00:00Z",
    lastMessageAtISO: null,
    unread: false,
    thread: [],
  },
];

describe("countByStatus", () => {
  it("tallies enquiries per status", () => {
    const counts = countByStatus(items);
    expect(counts.new).toBe(1);
    expect(counts.converted).toBe(1);
    expect(counts.replied).toBe(0);
    expect(counts.customer_replied).toBe(0);
    expect(counts.closed).toBe(0);
  });
});

describe("EnquiryInbox closed select labels", () => {
  it("filter + assign selects show labels/names, not raw values", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[{ ...items[0], preferredArtistId: "cln4artist1aaaa" }]}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
      />,
    );
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    // Artist + style filters default to the "all" sentinel — the trigger must
    // show the label, never the raw "__all__" value.
    expect(triggers).toContain("All artists");
    expect(triggers).toContain("All styles");
    expect(triggers).not.toContain("__all__");
    // Assign select is seeded with the preferred artist's cuid.
    expect(triggers).toContain("Sarah North");
    expect(triggers).not.toContain("cln4artist1aaaa");
  });
});

describe("EnquiryInbox row chrome", () => {
  it("shows the status tabs including Customer replied", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={items}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
      />,
    );
    expect(html).toContain("Customer replied");
  });

  it("shows an unread dot and the assigned-artist pill for owners", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[
          { ...items[0], unread: true, preferredArtistName: "Sarah North" },
        ]}
        artists={[{ id: "a1", name: "Sarah North" }]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
      />,
    );
    expect(html).toContain('aria-label="Unread"');
    expect(html).toContain("Sarah North");
  });

  it("labels an unassigned enquiry for owners", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[
          {
            ...items[1],
            status: "new",
            preferredArtistId: null,
            preferredArtistName: null,
          },
        ]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
      />,
    );
    expect(html).toContain("Unassigned");
  });

  it("offers artists a take + internal-note composer, and renders the thread", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[{ ...items[0], preferredArtistId: null }]}
        artists={[{ id: "a1", name: "Sarah North" }]}
        canConvert
        viewerArtistId="a1"
        showAssignedPill={false}
      />,
    );
    expect(html).toContain("Take this enquiry");
    expect(html).toContain("Internal note (staff only — never sent)");
    expect(html).toContain("A ladybird on the forearm please");
  });
});
