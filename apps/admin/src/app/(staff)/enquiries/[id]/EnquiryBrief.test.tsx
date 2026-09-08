import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AttachmentGrid,
  briefFacts,
  EnquiryBrief,
  threadAttachments,
} from "./EnquiryBrief";
import type { EnquiryItem } from "../inbox-shared";

const ITEM: EnquiryItem = {
  id: "e1",
  customerId: "c1",
  contactName: "Priya Kaur",
  contactEmail: "priya@example.test",
  subject: null,
  style: "Fine-line",
  placement: "Forearm",
  size: null,
  budgetPence: 25000,
  description: "A peony on the inner forearm.",
  moodboard: [],
  moodboardData: null,
  status: "customer_replied",
  source: "web",
  channel: "instagram",
  preferredArtistId: "a1",
  preferredArtistName: "Holly",
  createdAtISO: "2026-09-06T10:13:00Z",
  lastMessageAtISO: "2026-09-08T11:13:00Z",
  unread: false,
  thread: [
    {
      id: "m1",
      direction: "inbound",
      channel: "instagram",
      authorName: null,
      fromName: "priya.inks",
      subject: null,
      bodyText: "Here are two refs",
      deliveryStatus: "logged",
      senderVerified: null,
      createdAtISO: "2026-09-06T14:13:00Z",
      attachments: [
        { id: "att1", mime: "image/png", size: 10, filename: "ref.png", url: null, hasBytes: true },
        { id: "att2", mime: "application/pdf", size: 10, filename: "ideas.pdf", url: "https://x.test/ideas.pdf", hasBytes: false },
      ],
    },
    {
      id: "m2",
      direction: "outbound",
      channel: "instagram",
      authorName: "Holly",
      fromName: null,
      subject: null,
      bodyText: "Lovely",
      deliveryStatus: "sent",
      senderVerified: null,
      createdAtISO: "2026-09-06T15:13:00Z",
      attachments: [],
    },
  ],
  replyOptions: [],
  defaultReplyChannel: "email",
};

describe("briefFacts", () => {
  it("keeps the four facts in reading order and formats the budget", () => {
    expect(briefFacts(ITEM).map((f) => [f.label, f.value])).toEqual([
      ["Style", "Fine-line"],
      ["Placement", "Forearm"],
      ["Size", null],
      ["Budget", "£250.00"],
    ]);
  });
});

describe("threadAttachments", () => {
  it("flattens every attachment on the thread, in thread order", () => {
    expect(threadAttachments(ITEM).map((a) => a.id)).toEqual(["att1", "att2"]);
  });
});

describe("EnquiryBrief", () => {
  it("renders contact, facts, the description and the files from the thread", () => {
    const html = renderToStaticMarkup(<EnquiryBrief item={ITEM} />);
    expect(html).toContain("mailto:priya@example.test");
    expect(html).toContain('href="/customers/c1"');
    expect(html).toContain("Fine-line");
    // A missing fact says so instead of rendering a dash nobody can read.
    expect(html).toContain("Not given");
    expect(html).toContain("A peony on the inner forearm.");
    expect(html).toContain("Files from the thread (2)");
    expect(html).toContain('src="/api/attachments/att1"');
    expect(html).toContain('href="https://x.test/ideas.pdf"');
  });

  it("says when there is no written brief and hides the files section when empty", () => {
    const html = renderToStaticMarkup(
      <EnquiryBrief
        item={{ ...ITEM, description: null, thread: [], customerId: null }}
      />,
    );
    expect(html).toContain("No written brief");
    expect(html).not.toContain("Files from the thread");
    expect(html).not.toContain("View customer");
  });
});

describe("AttachmentGrid", () => {
  it("renders an unavailable attachment as text, never as a dead link", () => {
    const html = renderToStaticMarkup(
      <AttachmentGrid
        items={[
          { id: "x", mime: "image/png", size: 1, filename: "gone.png", url: null, hasBytes: false },
        ]}
      />,
    );
    expect(html).toContain("gone.png (unavailable)");
    expect(html).not.toContain("<a ");
  });
});
