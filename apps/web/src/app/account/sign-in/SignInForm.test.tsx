import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  signInAction: vi.fn(async () => ({ error: null })),
}));

describe("SignInForm", () => {
  it("renders labelled email + password fields and a submit button", async () => {
    const { SignInForm } = await import("./SignInForm");
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('type="password"');
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).toMatch(/sign in/i);
    expect(html).toContain("btn-gold");
    // No error shown in the initial state.
    expect(html).not.toContain('role="alert"');
  });
});
