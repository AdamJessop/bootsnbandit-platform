import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The "use server" actions module imports server-only auth/db/email — stub it
// so the component module graph loads in node.
vi.mock("./actions", () => ({
  assignEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
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
    style: "fine line",
    placement: "arm",
    size: "small",
    budgetPence: 15000,
    description: "ladybird",
    moodboard: ["https://x.test/a.jpg"],
    status: "new",
    source: "web",
    preferredArtistId: "a1",
    createdAtISO: "2026-06-01T10:00:00Z",
    thread: [
      {
        id: "m1",
        type: "enquiry_ack",
        status: "sent",
        subject: "Thanks for your enquiry",
        whenISO: "2026-06-01T10:01:00Z",
      },
    ],
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
    moodboard: [],
    status: "converted",
    source: "flash",
    preferredArtistId: null,
    createdAtISO: "2026-06-02T10:00:00Z",
    thread: [],
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

describe("EnquiryInbox closed select labels", () => {
  it("filter + assign selects show labels/names, not raw values", () => {
    const html = renderToStaticMarkup(
      <EnquiryInbox
        items={[{ ...items[0], preferredArtistId: "cln4artist1aaaa" }]}
        artists={[{ id: "cln4artist1aaaa", name: "Sarah North" }]}
        canConvert
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
