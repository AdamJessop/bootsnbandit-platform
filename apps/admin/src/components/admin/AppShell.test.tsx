import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { bottomNavItems, moreNavItems, visibleNavItems } from "@/lib/admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * The shell renders in the browser (usePathname, sheets, menus). Its logic is
 * the admin-nav derivation (asserted in src/lib/admin-nav.test.ts) plus the
 * sign-out flow (src/lib/sign-out.test.ts); assert the module boundary and the
 * nav contract the shell relies on here.
 */
describe("AppShell module", () => {
  it("exports the client component", () => {
    expect(typeof AppShell).toBe("function");
  });

  it("bottom bar (4 items) + More sheet cover every visible section", () => {
    for (const role of ["owner", "artist"] as const) {
      const bottom = bottomNavItems(role);
      expect(bottom.length).toBeLessThanOrEqual(4); // 5th slot is "More"
      expect(bottom.length + moreNavItems(role).length).toBe(
        visibleNavItems(role).length,
      );
    }
  });
});

describe("AppShell branding", () => {
  it("renders the bb-logo image in the sidebar brand", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(<AppShell role="owner">{null}</AppShell>);
    expect(html).toContain("/bb-logo.png");
  });
});

describe("AppShell unread badge", () => {
  it("badges the Enquiries nav item only when there is something unread", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const none = renderToStaticMarkup(<AppShell role="owner">{null}</AppShell>);
    expect(none).not.toContain("unread enquiries");
    const some = renderToStaticMarkup(
      <AppShell role="owner" enquiriesUnread={4}>
        {null}
      </AppShell>,
    );
    expect(some).toContain("4 unread enquiries");
  });
});
