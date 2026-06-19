import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { StaffInviteEmail } from "./staff-invite";

/**
 * The staff-invite template renders the invitee name, the redeem URL and the
 * role label. Subject/exhaustiveness coverage lives in render.test.ts.
 */
describe("StaffInviteEmail", () => {
  it("renders the invitee name, redeem URL and owner role", async () => {
    const html = await render(
      StaffInviteEmail({
        inviteeName: "Jordan",
        url: "http://localhost:3000/sign-in?invite=tok_xyz",
        role: "OWNER",
        expiresAt: "2026-07-01T00:00:00.000Z",
      }),
    );
    expect(html).toContain("Jordan");
    expect(html).toContain("invite=tok_xyz");
    expect(html).toContain("an owner");
    // Studio footer fact present.
    expect(html).toContain("67 Newcastle Avenue");
  });

  it("omits the button when no URL is provided and defaults the greeting", async () => {
    const html = await render(StaffInviteEmail({}));
    expect(html).toContain("there");
    expect(html).not.toContain("invite=");
  });
});
