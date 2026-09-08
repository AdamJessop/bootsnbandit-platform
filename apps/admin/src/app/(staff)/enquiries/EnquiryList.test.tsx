import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
  markEnquiryRead: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

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

import { EnquiryList } from "./EnquiryList";
import type { EnquiryItem } from "./inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  contactName: "Amy Rowe",
  contactEmail: "amy@example.test",
  subject: "Sleeve idea",
  style: "fine line",
  placement: "forearm",
  size: null,
  budgetPence: null,
  description: null,
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "messenger",
  preferredArtistId: null,
  preferredArtistName: null,
  createdAtISO: "2026-09-01T10:00:00.000Z",
  lastMessageAtISO: "2026-09-02T10:00:00.000Z",
  unread: true,
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

describe("EnquiryList", () => {
  it("renders a row with its unread dot, channel badge and owner pill", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated={false}
        emptyLabel="new"
      />,
    );
    expect(html).toContain('aria-label="Unread"');
    expect(html).toContain("Messenger");
    expect(html).toContain("Unassigned");
    expect(html).toContain("Amy Rowe");
  });

  it("shows the per-tab empty state when there is nothing to show", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[]}
        artists={[]}
        canConvert={false}
        viewerArtistId={null}
        showAssignedPill={false}
        truncated={false}
        emptyLabel="closed"
      />,
    );
    expect(html).toContain("No closed enquiries.");
  });

  it("offers an artist Take this on an unassigned row", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId="a1"
        showAssignedPill={false}
        truncated={false}
        emptyLabel="new"
      />,
    );
    expect(html).toContain("Unassigned");
    expect(html).toContain("Take this");
    // Specifically the row's own button. The dialog mock is a passthrough, so
    // EnquiryMeta's "Take this enquiry" is in this markup too — without the
    // negative lookahead the assertion above would pass with no row button.
    expect(html.match(/Take this(?! enquiry)/g)).toHaveLength(1);
  });

  it("says so when the list is only the most recent page", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated
        emptyLabel="new"
      />,
    );
    // Otherwise a tab reading "412" above three rows looks like a bug.
    expect(html).toContain("Showing the 300 most recent");
  });
});
