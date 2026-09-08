import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  addInternalNote: vi.fn(),
  assignEnquiry: vi.fn(),
  claimEnquiry: vi.fn(),
  closeEnquiry: vi.fn(),
  convertEnquiry: vi.fn(),
  markEnquiryRead: vi.fn(),
  replyToEnquiry: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { briefCount, EnquiryPage, SegmentedControl, slideClass } from "./EnquiryPage";
import type { EnquiryItem } from "../inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  customerId: "c1",
  contactName: "Priya Kaur",
  contactEmail: "priya@example.test",
  subject: null,
  style: "Fine-line",
  placement: "Forearm",
  size: "Medium",
  budgetPence: 25000,
  description: "A peony.",
  moodboard: [],
  moodboardData: null,
  status: "customer_replied",
  source: "web",
  channel: "instagram",
  preferredArtistId: "a1",
  preferredArtistName: "Holly",
  createdAtISO: "2026-09-06T10:13:00Z",
  lastMessageAtISO: "2026-09-08T11:13:00Z",
  unread: true,
  thread: [
    {
      id: "m1",
      direction: "inbound",
      channel: "instagram",
      authorName: null,
      fromName: "priya.inks",
      subject: null,
      bodyText: "Sat 18th please!!",
      deliveryStatus: "logged",
      senderVerified: null,
      createdAtISO: "2026-09-08T11:13:00Z",
      attachments: [
        { id: "att1", mime: "image/png", size: 10, filename: "arm.png", url: null, hasBytes: true },
      ],
    },
  ],
  replyOptions: [
    { channel: "email", label: "Email", available: true, hint: "Sends to priya@example.test." },
    { channel: "note", label: "Internal note", available: true, hint: "Staff only." },
  ],
  defaultReplyChannel: "email",
};
const ARTISTS = [{ id: "a1", name: "Holly" }];

describe("briefCount", () => {
  it("counts board images plus thread attachments", () => {
    expect(briefCount(ITEM)).toBe(1);
    expect(briefCount({ ...ITEM, moodboard: ["https://x.test/a.jpg"] })).toBe(2);
  });
});

describe("SegmentedControl", () => {
  it("renders three tabs with the active one selected and counts as chips", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl value="brief" onChange={() => {}} counts={{ conversation: 6, brief: 3 }} />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="tab-brief"[^>]*aria-selected="true"/);
    expect(html).toMatch(/id="tab-conversation"[^>]*aria-selected="false"/);
    expect(html).toContain(">6<");
    expect(html).toContain(">3<");
  });
});

describe("EnquiryPage", () => {
  it("opens on the conversation with the composer docked and the brief in the rail", () => {
    const html = renderToStaticMarkup(
      <EnquiryPage item={ITEM} artists={ARTISTS} canConvert viewerArtistId={null} />,
    );
    expect(html).toContain('href="/enquiries"');
    expect(html).toContain("Priya Kaur");
    expect(html).toContain("Customer replied");
    expect(html).toContain("Waiting since");
    expect(html).toContain("Sat 18th please!!");
    expect(html).toContain('aria-label="Reply channel"');
    // The rail carries the facts so the brief stays visible while replying.
    expect(html).toContain("At a glance");
    expect(html).toContain("Fine-line");
    expect(html).toContain('href="/customers/c1"');
    // Nothing from the other views leaks into this one.
    expect(html).not.toContain("Book a consult");
  });

  it("renders the actions view on request and flags an unassigned enquiry", () => {
    const html = renderToStaticMarkup(
      <EnquiryPage
        item={{ ...ITEM, preferredArtistId: null, preferredArtistName: null, status: "new" }}
        artists={ARTISTS}
        canConvert
        viewerArtistId="a1"
        initialView="actions"
      />,
    );
    expect(html).toContain("Unassigned");
    expect(html).toContain("Book a consult");
    expect(html).not.toContain('aria-label="Reply channel"');
  });
});

describe("slideClass", () => {
  it("does not move on first paint, slides from the right going forward and from the left going back", () => {
    expect(slideClass(null, "conversation")).toBe("");
    expect(slideClass("brief", "brief")).toBe("");
    expect(slideClass("conversation", "actions")).toContain("slide-in-from-right");
    expect(slideClass("actions", "brief")).toContain("slide-in-from-left");
  });
});
