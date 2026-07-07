import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./SignInForm", () => ({ SignInForm: () => <div>form</div> }));

describe("SignInPage branding", () => {
  it("renders the bb-logo image above the heading", async () => {
    const { default: SignInPage } = await import("./page");
    const html = renderToStaticMarkup(
      await SignInPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("/bb-logo.png");
    expect(html).toContain("Boots");
  });
});
