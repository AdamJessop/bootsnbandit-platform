import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  InviteOutcome,
  PendingInvites,
  StaffManager,
  existingMemberFor,
  inviteOutcomeMessage,
  validFor,
  type StaffMember,
} from "./StaffManager";

const noop = vi.fn();

const SARAH: StaffMember = {
  id: "u1",
  email: "sarah@example.com",
  displayName: "Sarah",
  role: "OWNER",
  active: true,
  artist: { slug: "sarah", status: "CO_OWNER" },
  passkeys: [{ id: "p1", deviceName: "MacBook", createdAt: "2026-01-01" }],
};

const CALUM: StaffMember = {
  id: "u3",
  email: "calum@example.com",
  displayName: "Calum",
  role: "OWNER",
  active: true,
  artist: null,
  passkeys: [],
};

function render(staff: StaffMember[], extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <StaffManager
      inviteAction={noop}
      setRoleAction={noop}
      setActiveAction={noop}
      removePasskeyAction={noop}
      staff={staff}
      {...extra}
    />,
  );
}

describe("StaffManager", () => {
  it("renders the invite form and a roster with passkeys + artist status", () => {
    const html = render([SARAH]);
    expect(html).toContain("Invite staff");
    expect(html).toContain("sarah@example.com");
    expect(html).toContain("MacBook");
    expect(html).toContain("Passkeys");
    // unification: the linked artist title is surfaced
    expect(html).toContain("Co-owner");
  });

  it("uses a neutral example placeholder and tells the owner to use a personal email", () => {
    const html = render([SARAH]);
    expect(html).toContain('placeholder="name@example.com"');
    expect(html).not.toContain("studio.test");
    expect(html).toContain("personal email");
    expect(html).toContain("valid 7 days");
  });

  it("links artist-linked users to the owner profile editor", () => {
    const html = render([{ ...SARAH, passkeys: [] }]);
    expect(html).toContain("Edit profile");
    expect(html).toContain('href="/studio/staff/u1"');
  });

  it("flags a staff member with no linked artist profile", () => {
    const html = render([
      {
        id: "u2",
        email: "new@example.com",
        displayName: "New",
        role: "ARTIST",
        active: true,
        artist: null,
        passkeys: [],
      },
    ]);
    expect(html).toContain("No artist profile");
    // no artist → nothing to edit, so no editor link
    expect(html).not.toContain("Edit profile");
    expect(html).not.toContain('href="/studio/staff/u2"');
  });

  it("offers name + email editing when the action is wired", () => {
    const html = render([CALUM], { updateDetailsAction: noop });
    expect(html).toContain("Edit name &amp; email");
  });

  it("hides role + disable controls on the signed-in owner's own row", () => {
    const html = render([SARAH, CALUM], { currentUserId: "u1" });
    expect(html).toContain("(you)");
    expect(html).toContain("another owner can change your role");
    expect(html).not.toContain('aria-label="Role for sarah@example.com"');
    expect(html).toContain('aria-label="Role for calum@example.com"');
  });

  it("makes disable and passkey removal two-step (no direct submit)", () => {
    const html = render([SARAH]);
    // The first click only opens an inline confirm: both are plain buttons,
    // not submit buttons inside a form.
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Disable<\/button>/);
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Remove passkey"/,
    );
    expect(html).not.toContain("Yes, disable");
    expect(html).not.toContain("Yes, remove");
  });

  it("lists pending invites with Copy link + Resend", () => {
    const html = render([SARAH], {
      resendInviteAction: noop,
      invites: [
        {
          id: "i1",
          email: "jess@example.com",
          role: "ARTIST",
          url: "https://admin.example.com/sign-in?invite=t",
          expiresAt: "2026-11-08T09:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("Pending invites (1)");
    expect(html).toContain("jess@example.com");
    expect(html).toContain("8 Nov");
    expect(html).toContain("Copy link");
    expect(html).toContain("Resend");
  });
});

describe("PendingInvites", () => {
  it("says when nothing is pending", () => {
    const html = renderToStaticMarkup(<PendingInvites invites={[]} />);
    expect(html).toContain("No invites waiting");
  });
});

describe("invite outcome", () => {
  const NOW = new Date("2026-11-01T09:00:00Z").getTime();
  const ok = {
    ok: true as const,
    email: "jess@example.com",
    inviteUrl: "https://admin.example.com/sign-in?invite=t",
    expiresAt: "2026-11-08T09:00:00.000Z",
    emailed: true,
  };

  it("confirms an emailed invite with how long the link lasts", () => {
    expect(inviteOutcomeMessage(ok, NOW)).toMatch(
      /^Invite emailed to jess@example\.com — link valid 7 days\./,
    );
  });

  it("tells the owner to copy the link when the email didn't send", () => {
    expect(inviteOutcomeMessage({ ...ok, emailed: false }, NOW)).toMatch(
      /didn't send — copy the link/,
    );
  });

  it("renders a Copy invite link button with the confirmation", () => {
    const html = renderToStaticMarkup(<InviteOutcome result={ok} />);
    expect(html).toContain("Invite emailed to jess@example.com");
    expect(html).toContain("Copy invite link");
  });

  it("renders a refusal inline", () => {
    const html = renderToStaticMarkup(
      <InviteOutcome
        result={{
          ok: false,
          emailed: false,
          error:
            "Mail to @bootsnbandit.com goes to the enquiry inbox — invite their personal email.",
        }}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("enquiry inbox");
    expect(html).not.toContain("Copy invite link");
  });

  it("phrases the remaining validity", () => {
    expect(validFor("2026-11-02T09:00:00.000Z", NOW)).toBe("1 day");
    expect(validFor("2026-11-01T12:00:00.000Z", NOW)).toBe("less than a day");
  });
});

describe("existingMemberFor (re-invite keeps the role)", () => {
  it("matches a roster email case-insensitively", () => {
    expect(existingMemberFor(" Sarah@Example.com ", [SARAH])?.role).toBe(
      "OWNER",
    );
  });

  it("returns null for a new address or an empty field", () => {
    expect(existingMemberFor("jess@example.com", [SARAH])).toBeNull();
    expect(existingMemberFor("", [SARAH])).toBeNull();
  });
});
