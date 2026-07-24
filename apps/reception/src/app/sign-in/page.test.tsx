import { describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("@bnb/core/auth", () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => redirect(to),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: () => true,
}));

import { renderToStaticMarkup } from "react-dom/server";
import SignInPage from "./page";

describe("reception sign-in page", () => {
  it("redirects an already-signed-in kiosk to the board", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "OWNER" });
    await expect(SignInPage()).rejects.toThrow("REDIRECT:/");
  });

  it("renders the branded sign-in card when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const el = await SignInPage();
    const html = renderToStaticMarkup(el);
    expect(html).toContain("/bb-logo.png");
    expect(html).toContain("Front desk");
    expect(html).toContain('type="email"');
  });
});
