import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: () => true,
}));

import { renderToStaticMarkup } from "react-dom/server";
import { SignInForm } from "./SignInForm";

/**
 * The passkey ceremony itself is exercised end-to-end against the real
 * browser; here we assert the form contract — email-first input and the
 * webauthn autocomplete hint the ceremony relies on.
 */
describe("reception SignInForm", () => {
  it("renders an email-first passkey form", () => {
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('type="email"');
    expect(html).toContain("webauthn");
    expect(html.toLowerCase()).toContain("passkey");
  });

  it("uses a neutral placeholder (staff sign in with a personal email)", () => {
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('placeholder="name@example.com"');
    expect(html).not.toContain("Studio email");
  });
});
