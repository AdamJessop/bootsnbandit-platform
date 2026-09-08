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
        senderVerified: null,
        createdAtISO: "2026-06-01T10:01:00Z",
        attachments: [],
      },
    ],
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
        counts={{
          new: 1,
          customer_replied: 0,
          replied: 0,
          converted: 1,
          closed: 0,
        }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId={null}
        openTab={null}
        notice={null}
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
        counts={{
          new: 1,
          customer_replied: 0,
          replied: 0,
          converted: 1,
          closed: 0,
        }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId={null}
        openTab={null}
        notice={null}
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
        counts={{
          new: 1,
          customer_replied: 0,
          replied: 0,
          converted: 1,
          closed: 0,
        }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        openEnquiryId={null}
        openTab={null}
        notice={null}
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
        counts={{
          new: 1,
          customer_replied: 0,
          replied: 0,
          converted: 1,
          closed: 0,
        }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        openEnquiryId={null}
        openTab={null}
        notice={null}
      />,
    );
    expect(html).toContain("Unassigned");
  });

  it("offers artists a take + internal-note composer, and renders the thread", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[{ ...items[0], preferredArtistId: null }]}
        artists={[{ id: "a1", name: "Sarah North" }]}
        counts={{
          new: 1,
          customer_replied: 0,
          replied: 0,
          converted: 1,
          closed: 0,
        }}
        truncated={false}
        canConvert
        viewerArtistId="a1"
        showAssignedPill={false}
        openEnquiryId={null}
        openTab={null}
        notice={null}
      />,
    );
    expect(html).toContain("Take this enquiry");
    // The note is now a channel on the single composer, not a second box, so
    // what the row renders is the channel selector. Its items live in a
    // portal that SSR never opens — ReplyComposer.test.tsx covers choosing
    // the note and the "Add note" button that follows.
    expect(html).toContain('aria-label="Reply channel"');
    expect(html).toContain("Sends to amy@example.test.");
    expect(html).toContain("A ladybird on the forearm please");
  });
});

describe("EnquiryInbox deep link", () => {
  it("starts on the deep-linked enquiry's tab", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={items}
        artists={[]}
        counts={{ new: 1, customer_replied: 0, replied: 0, converted: 1, closed: 0 }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId="2"
        openTab="converted"
        notice={null}
      />,
    );
    // items[1] ("Bob") is the converted one; landing on New would show
    // "Amy" and hide the very enquiry the link pointed at.
    expect(html).toContain("Bob");
    expect(html).not.toContain("No converted enquiries.");
  });

  it("shows a quiet notice for a link it cannot open", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={items}
        artists={[]}
        counts={{ new: 1, customer_replied: 0, replied: 0, converted: 1, closed: 0 }}
        truncated={false}
        canConvert
        viewerArtistId={null}
        showAssignedPill={false}
        openEnquiryId={null}
        openTab={null}
        notice="That enquiry is not in your inbox — it may have been assigned to another artist."
      />,
    );
    expect(html).toContain("not in your inbox");
  });
});
