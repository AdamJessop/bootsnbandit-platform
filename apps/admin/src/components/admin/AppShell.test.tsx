import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { bottomNavItems, moreNavItems, visibleNavItems } from "@/lib/admin-nav";

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
