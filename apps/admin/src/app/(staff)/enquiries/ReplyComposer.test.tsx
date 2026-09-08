import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

import { ReplyComposer } from "./ReplyComposer";
import type { ReplyChannelOption } from "./enquiry-helpers";

const OPTIONS: ReplyChannelOption[] = [
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
    hint: "The 24-hour reply window closed at 07 Sep 2026, 10:00 — reply by email instead.",
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
];

describe("ReplyComposer", () => {
  it("opens on the default channel and shows that channel's hint", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    const triggers = [
      ...html.matchAll(/data-slot="select-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(triggers).toContain("Email");
    expect(html).toContain("Sends to amy@example.test.");
    expect(html).toContain("Send reply");
  });

  it("disables an unreachable channel and still shows why", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    // The shut window is legible without opening the dropdown: that sentence
    // is the whole point of the selector.
    expect(html).toContain("24-hour reply window closed at 07 Sep 2026");
    expect(html).toContain("No Instagram conversation on this thread.");
  });

  it("labels the send button as a note when the note channel is the default", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        options={OPTIONS}
        defaultChannel="note"
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("Add note");
    expect(html).not.toContain("Send reply");
    expect(html).toContain("Saved on the thread for staff only — never sent.");
  });

  it("warns an artist that replying to an unassigned enquiry takes it", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="inkling"
        claimsOnReply
        options={OPTIONS}
        defaultChannel="email"
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("assigns it to you");
    expect(html).toContain("Respond");
  });
});
