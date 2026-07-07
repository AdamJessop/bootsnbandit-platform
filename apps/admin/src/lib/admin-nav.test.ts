import { describe, it, expect } from "vitest";
import {
  ADMIN_NAV,
  visibleNavItems,
  bottomNavItems,
  moreNavItems,
  type AdminRole,
} from "./admin-nav";

describe("ADMIN_NAV registry", () => {
  it("covers every BACKOFHOUSE-IA primary route", () => {
    const ids = ADMIN_NAV.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "today",
        "calendar",
        "front-desk",
        "enquiries",
        "bookings",
        "customers",
        "sessions",
        "availability",
        "reports",
        "content",
        "studio",
        "profile",
      ]),
    );
  });

  it("gives every item a unique id, a rebased path and an icon", () => {
    const ids = new Set<string>();
    for (const item of ADMIN_NAV) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.icon).toBeTruthy();
    }
  });

  it("flags content + studio as owner-only", () => {
    const ownerOnly = ADMIN_NAV.filter((i) => i.ownerOnly).map((i) => i.id);
    expect(ownerOnly).toContain("content");
    expect(ownerOnly).toContain("studio");
  });
});

describe("visibleNavItems", () => {
  it("hides owner-only items from artists", () => {
    const artist = visibleNavItems("artist" satisfies AdminRole).map(
      (i) => i.id,
    );
    expect(artist).not.toContain("content");
    expect(artist).not.toContain("studio");
    expect(artist).toContain("today");
  });

  it("shows everything to owners", () => {
    expect(visibleNavItems("owner")).toHaveLength(ADMIN_NAV.length);
  });
});

describe("bottomNavItems", () => {
  it("returns at most 5 items for the mobile bottom bar", () => {
    expect(bottomNavItems("owner").length).toBeLessThanOrEqual(5);
    expect(bottomNavItems("artist").length).toBeLessThanOrEqual(5);
  });
});

describe("moreNavItems", () => {
  it("with the bottom bar covers every visible item exactly once (no dead-ends)", () => {
    for (const role of ["owner", "artist"] as const) {
      const bottom = bottomNavItems(role).map((i) => i.id);
      const more = moreNavItems(role).map((i) => i.id);
      const union = [...bottom, ...more].sort();
      const visible = visibleNavItems(role)
        .map((i) => i.id)
        .sort();
      expect(union).toEqual(visible); // everything reachable, nothing twice
    }
  });

  it("includes the sections missing from the bottom bar", () => {
    const more = moreNavItems("owner").map((i) => i.id);
    for (const id of [
      "enquiries",
      "sessions",
      "availability",
      "reports",
      "profile",
      "content",
      "studio",
    ]) {
      expect(more).toContain(id);
    }
  });

  it("stays role-gated: artists never see owner-only items in More", () => {
    const more = moreNavItems("artist").map((i) => i.id);
    expect(more).not.toContain("content");
    expect(more).not.toContain("studio");
  });
});
