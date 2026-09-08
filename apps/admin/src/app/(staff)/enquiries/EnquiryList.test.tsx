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
  // Dialog itself carries a `data-open` marker reflecting the `open` prop it
  // was given — the only way an SSR string can distinguish "forced open by
  // a deep link" from "closed", since DialogContent is a passthrough that
  // always renders its children either way (other tests in this file rely
  // on that to inspect composer content without clicking anything open).
  const DialogRoot = ({
    open,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={open ? "true" : "false"}>
      {children}
    </div>
  );
  return {
    Dialog: DialogRoot,
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
  customerId: "cus1",
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
        pageSize={300}
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
        pageSize={300}
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
        pageSize={300}
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
        pageSize={300}
        emptyLabel="new"
      />,
    );
    // Otherwise a tab reading "412" above three rows looks like a bug.
    expect(html).toContain("Showing the 300 most recent");
  });

  it("keeps the truncation note on a tab that filtered down to nothing", () => {
    // The empty branch used to swallow it, so the one view where "there is
    // more than you can see" matters most was the one view that never said so.
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[]}
        artists={[]}
        canConvert={false}
        viewerArtistId={null}
        showAssignedPill={false}
        truncated
        pageSize={300}
        emptyLabel="closed"
      />,
    );
    expect(html).toContain("No closed enquiries.");
    expect(html).toContain("Showing the 300 most recent enquiries");
  });

  it("never advises narrowing the filters, which cannot reach an older row", () => {
    // Filtering is client-side over the rows already fetched — narrowing it
    // can only ever show FEWER of them.
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated
        pageSize={300}
        emptyLabel="new"
      />,
    );
    expect(html).not.toContain("narrow the filters");
    expect(html).toContain("older ones are not loaded here");
    expect(html).toContain("Open an older enquiry from the customer");
  });

  it("takes the cap from the page size it was handed, not a literal", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated
        pageSize={50}
        emptyLabel="new"
      />,
    );
    expect(html).toContain("Showing the 50 most recent enquiries");
  });

  it("says so and credits the pinned extra when a deep link added one past the cap", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated
        pageSize={300}
        emptyLabel="new"
        pinnedExtra
      />,
    );
    expect(html).toContain(
      "Showing the 300 most recent plus the linked enquiry",
    );
  });
});

describe("EnquiryList deep-link one-shot", () => {
  it("opens the row while the deep link is pending", () => {
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated={false}
        pageSize={300}
        emptyLabel="new"
        openEnquiryId={ITEM.id}
      />,
    );
    expect(html).toContain('data-open="true"');
  });

  it("does not reopen the row once the caller has consumed the pending id", () => {
    // Simulates what happens in EnquiryInbox after `onAutoOpened` fires and
    // clears `pendingOpenId`: a later tab/filter change remounts the row
    // with `openEnquiryId` already null, so the dialog must not be forced
    // open (and its unread flag must not be re-marked) a second time.
    const html = renderToStaticMarkup(
      <EnquiryList
        items={[ITEM]}
        artists={[]}
        canConvert
        viewerArtistId={null}
        showAssignedPill
        truncated={false}
        pageSize={300}
        emptyLabel="new"
        openEnquiryId={null}
      />,
    );
    expect(html).toContain('data-open="false"');
    expect(html).not.toContain('data-open="true"');
  });
});
