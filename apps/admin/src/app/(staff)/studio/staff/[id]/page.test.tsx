import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const requireRole = vi.fn();
const userFindUnique = vi.fn();
const styleFindMany = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    tattooStyle: { findMany: (...a: unknown[]) => styleFindMany(...a) },
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));
vi.mock("../../../profile/_lib/actions", () => ({
  saveArtistProfile: vi.fn(async () => {}),
}));

const params = (id: string) => Promise.resolve({ id });

describe("StaffProfilePage (/studio/staff/[id])", () => {
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue({ id: "o1", role: "OWNER" });
    userFindUnique.mockReset().mockResolvedValue({
      id: "u1",
      email: "sarah@studio.test",
      displayName: "Sarah",
      artist: {
        id: "art1",
        status: "RESIDENT",
        bio: "Heritage tattooer",
        insta: "@sarah",
        headshot: "/uploads/s.png",
        hourlyRatePence: 9000,
        dayRatePence: 60000,
        specials: ["Snakes"],
        styles: [{ id: "s1" }],
      },
    });
    styleFindMany.mockReset().mockResolvedValue([
      { id: "s1", name: "Fine-line" },
      { id: "s2", name: "Bold" },
    ]);
    notFound.mockClear();
  });

  it("lets an owner edit the artist's full profile including an editable status", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ params: params("u1") }));
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(html).toContain("Sarah");
    expect(html).toContain("Heritage tattooer");
    expect(html).toContain("@sarah");
    expect(html).toContain('name="headshot"');
    expect(html).toContain('name="hourlyRatePounds"');
    // owner-only editable status control bound into the form
    expect(html).toContain('name="status"');
    expect(html).not.toContain("set by an owner");
  });

  it("redirects a non-owner before touching the DB — even for their own user id", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    const { default: Page } = await import("./page");
    // "self-u1" is the signed-in non-owner's own user id: the OWNER gate must
    // still fire — no self-id bypass.
    await expect(Page({ params: params("self-u1") })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("404s for an unknown user id", async () => {
    userFindUnique.mockResolvedValue(null);
    const { default: Page } = await import("./page");
    await expect(Page({ params: params("nope") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("404s for a user with no linked artist profile", async () => {
    userFindUnique.mockResolvedValue({
      id: "u2",
      email: "new@studio.test",
      displayName: "New",
      artist: null,
    });
    const { default: Page } = await import("./page");
    await expect(Page({ params: params("u2") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
