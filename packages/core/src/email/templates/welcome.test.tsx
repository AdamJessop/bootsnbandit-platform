import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { WelcomeEmail } from "./welcome";

/**
 * The welcome template greets the new customer, links to the set-password
 * page and states the 30-day validity. Subject coverage lives in render.ts.
 */
describe("WelcomeEmail", () => {
  it("renders the customer name, set-password URL and 30-day note", async () => {
    const html = await render(
      WelcomeEmail({
        customerName: "Robin",
        setPasswordUrl:
          "http://localhost:3000/account/set-password?token=tok_abc",
        expiresAt: "2026-08-06T00:00:00.000Z",
      }),
    );
    expect(html).toContain("Robin");
    expect(html).toContain("token=tok_abc");
    expect(html).toContain("30 days");
    // Studio footer fact present (shared layout).
    expect(html).toContain("67 Newcastle Avenue");
  });

  it("omits the button without a URL and defaults the greeting", async () => {
    const html = await render(WelcomeEmail({}));
    // No name means no name — never "Welcome, there.".
    expect(html).toContain("Welcome.");
    expect(html).not.toContain("there");
    expect(html).not.toContain("set-password?token=");
  });
});
