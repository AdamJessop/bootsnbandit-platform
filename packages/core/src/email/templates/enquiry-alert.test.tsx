import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { EnquiryAlertEmail } from "./enquiry-alert";

/**
 * The owners' new-enquiry alert: who, how it came in, which artist, what they
 * want, and a button into the admin thread. Subject coverage lives in
 * render.test.ts.
 */
describe("EnquiryAlertEmail", () => {
  it("renders the triage details and the admin link", async () => {
    const html = await render(
      EnquiryAlertEmail({
        customerName: "Robin",
        channelLabel: "Flash claim",
        artistName: "Marnie",
        summary: "Flash claim: Swallow",
        enquiryUrl: "https://admin.example/enquiries/enq_9",
      }),
    );
    expect(html).toContain("Robin has sent an enquiry.");
    expect(html).toContain("Flash claim");
    expect(html).toContain("Marnie");
    expect(html).toContain("Flash claim: Swallow");
    expect(html).toContain('href="https://admin.example/enquiries/enq_9"');
    expect(html).toContain("67 Newcastle Avenue");
  });

  it("says when there is no preferred artist and omits the button without a URL", async () => {
    const html = await render(EnquiryAlertEmail({ customerName: "Robin" }));
    expect(html).toContain("No preference");
    expect(html).not.toContain("Open the enquiry");
  });
});
