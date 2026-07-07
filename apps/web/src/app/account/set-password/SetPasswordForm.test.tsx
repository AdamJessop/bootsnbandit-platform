import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  setPasswordAction: vi.fn(async () => ({ error: null })),
}));

describe("SetPasswordForm", () => {
  it("renders password + confirm fields with the token embedded", async () => {
    const { SetPasswordForm } = await import("./SetPasswordForm");
    const html = renderToStaticMarkup(<SetPasswordForm token="tok_123" />);
    expect(html).toContain('name="token"');
    expect(html).toContain('value="tok_123"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirm"');
    expect(html).toMatch(/autocomplete="new-password"/i);
    expect(html).toMatch(/set password/i);
    // No error shown in the initial state.
    expect(html).not.toContain('role="alert"');
  });
});
