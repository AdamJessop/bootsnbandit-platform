import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  signInAction: vi.fn(async () => ({ error: null })),
}));

describe("SignInPage", () => {
  it("renders the sign-in form inside the site chrome", async () => {
    const { default: SignInPage } = await import("./page");
    const html = renderToStaticMarkup(<SignInPage />);
    expect(html).toMatch(/sign in/i);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain("card");
  });
});
