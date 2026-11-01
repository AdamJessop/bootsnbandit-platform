import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  browserSupportsWebAuthn: () => true,
}));

import { renderToStaticMarkup } from "react-dom/server";
import { SignInForm } from "./SignInForm";

/**
 * Form contract only (the ceremony runs against a real browser): email-first
 * sign-in with a neutral placeholder — staff use personal addresses, so
 * nothing should suggest a studio-domain email — and the invite enrolment
 * variant.
 */
describe("admin SignInForm", () => {
  it("renders an email-first passkey form with a neutral placeholder", () => {
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('type="email"');
    expect(html).toContain("webauthn");
    expect(html).toContain('placeholder="name@example.com"');
    expect(html).not.toContain("bootsnbandit.studio");
    expect(html).not.toContain("Studio email");
  });

  it("switches to device enrolment for an invite link", () => {
    const html = renderToStaticMarkup(<SignInForm invite="tok" />);
    expect(html).toContain("Name this device");
    expect(html).not.toContain('type="email"');
  });
});
