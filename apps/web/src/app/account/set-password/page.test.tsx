import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  setPasswordAction: vi.fn(async () => ({ error: null })),
}));

describe("SetPasswordPage", () => {
  it("renders the password form with the token embedded", async () => {
    const { default: SetPasswordPage } = await import("./page");
    const html = renderToStaticMarkup(
      await SetPasswordPage({
        searchParams: Promise.resolve({ token: "tok_abc" }),
      }),
    );
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirm"');
    expect(html).toContain('value="tok_abc"');
  });

  it("shows a friendly error with a sign-in link when the token is missing", async () => {
    const { default: SetPasswordPage } = await import("./page");
    const html = renderToStaticMarkup(
      await SetPasswordPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toMatch(/link/i);
    expect(html).toContain('href="/account/sign-in"');
    expect(html).not.toContain('name="password"');
  });
});
