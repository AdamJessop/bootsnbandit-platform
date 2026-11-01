import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { EnquiryAckEmail } from "./enquiry-ack";

/**
 * Each branch of the ack is one whole sentence: splicing the artist's name
 * into shared copy once produced "a message is on its way to Calum will get
 * back to you soon". Subject coverage lives in render.test.ts.
 */
describe("EnquiryAckEmail", () => {
  it("puts the enquiry with the chosen artist", async () => {
    const html = await render(
      EnquiryAckEmail({ customerName: "Robin", artistName: "Calum" }),
    );
    expect(html).toContain("Thanks for getting in touch, Robin.");
    expect(html).toContain(
      "Your enquiry is with Calum, who&#x27;ll get back to you soon",
    );
    expect(html).not.toContain("on its way to");
  });

  it("puts the enquiry with the studio when no artist was picked", async () => {
    const html = await render(EnquiryAckEmail({ customerName: "Robin" }));
    expect(html).toContain(
      "Your enquiry is with the studio — we&#x27;ll match you with the right artist",
    );
    expect(html).not.toContain("member of the crew");
  });

  it("quotes the idea and drops the name from the greeting when unknown", async () => {
    const html = await render(
      EnquiryAckEmail({ subjectIdea: "Snake and peony half sleeve" }),
    );
    expect(html).toContain("Thanks for getting in touch.");
    expect(html).not.toContain("there");
    expect(html).toContain("Snake and peony half sleeve");
  });
});
