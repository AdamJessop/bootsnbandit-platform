import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({
  addInternalNote: vi.fn(),
  replyToEnquiry: vi.fn(),
}));

import { ReplyComposer } from "./ReplyComposer";

describe("ReplyComposer", () => {
  it("renders the reply and note composers", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="web"
        claimsOnReply={false}
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("Reply (emails customer)");
    expect(html).toContain("Internal note (staff only — never sent)");
    expect(html).toContain("Send reply");
  });

  it("warns an artist that replying to an unassigned enquiry takes it", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        enquiryId="e1"
        source="inkling"
        claimsOnReply
        onSent={vi.fn()}
      />,
    );
    expect(html).toContain("assigns it to you");
    expect(html).toContain("Respond");
  });
});
