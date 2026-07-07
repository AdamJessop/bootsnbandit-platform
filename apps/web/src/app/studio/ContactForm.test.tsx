import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactForm } from "./ContactForm";

describe("studio ContactForm", () => {
  it("renders the form fields and a disabled submit until valid", () => {
    const html = renderToStaticMarkup(<ContactForm enquiriesOpen={true} />);
    expect(html).toContain("Your name");
    expect(html).toContain("Email or phone");
    expect(html).toContain("Message");
    expect(html).toContain("Send message");
    expect(html).toContain("disabled");
  });

  it("renders a books-closed notice instead of the form when enquiries are off", () => {
    const html = renderToStaticMarkup(<ContactForm enquiriesOpen={false} />);
    expect(html).toContain("books are closed");
    expect(html).not.toContain("Send message");
  });
});
