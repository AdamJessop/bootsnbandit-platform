import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaffManager } from "./StaffManager";

const noop = vi.fn();

describe("StaffManager", () => {
  it("renders the invite form and a roster with passkeys + artist status", () => {
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
            artist: { slug: "sarah", status: "CO_OWNER" },
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
    // unification: the linked artist title is surfaced
    expect(html).toContain("Co-owner");
  });

  it("links artist-linked users to the owner profile editor", () => {
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
            artist: { slug: "sarah", status: "CO_OWNER" },
            passkeys: [],
          },
        ]}
      />,
    );
    expect(html).toContain("Edit profile");
    expect(html).toContain('href="/studio/staff/u1"');
  });

  it("flags a staff member with no linked artist profile", () => {
    const html = renderToStaticMarkup(
      <StaffManager
        inviteAction={noop}
        setRoleAction={noop}
        setActiveAction={noop}
        removePasskeyAction={noop}
        staff={[
          {
            id: "u2",
            email: "new@studio.test",
            displayName: "New",
            role: "ARTIST",
            active: true,
            artist: null,
            passkeys: [],
          },
        ]}
      />,
    );
    expect(html).toContain("No artist profile");
    // no artist → nothing to edit, so no editor link
    expect(html).not.toContain("Edit profile");
    expect(html).not.toContain('href="/studio/staff/u2"');
  });
});
