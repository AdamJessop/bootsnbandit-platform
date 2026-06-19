import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaffManager } from "./StaffManager";

const noop = vi.fn();

describe("StaffManager", () => {
  it("renders the invite form and a roster with passkeys", () => {
    const html = renderToStaticMarkup(
      <StaffManager
        inviteAction={noop}
        setRoleAction={noop}
        setActiveAction={noop}
        removePasskeyAction={noop}
        staff={[
          {
            id: "u1",
            email: "sarah@studio.test",
            displayName: "Sarah",
            role: "OWNER",
            active: true,
            passkeys: [
              { id: "p1", deviceName: "MacBook", createdAt: "2026-01-01" },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("Invite staff");
    expect(html).toContain("sarah@studio.test");
    expect(html).toContain("MacBook");
    expect(html).toContain("Passkeys");
  });
});
