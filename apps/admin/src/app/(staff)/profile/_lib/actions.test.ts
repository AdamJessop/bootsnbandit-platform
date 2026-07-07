import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getCurrentUser = vi.fn();
const requireRole = vi.fn();
const revalidatePath = vi.fn();
const artistUpdate = vi.fn();
const feedUpsert = vi.fn();
const feedUpdate = vi.fn();
const authFindFirst = vi.fn();
const authDelete = vi.fn();

vi.mock("@bnb/core/auth", () => ({
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("@bnb/core/auth/tokens", () => ({ generateToken: () => "NEWTOKEN" }));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    artist: { update: artistUpdate },
    calendarFeed: { upsert: feedUpsert, update: feedUpdate },
    authenticator: { findFirst: authFindFirst, delete: authDelete },
  },
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("profile actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset().mockResolvedValue({
      id: "u1",
      role: "ARTIST",
      artistId: "art1",
    });
    requireRole
      .mockReset()
      .mockResolvedValue({ id: "u1", role: "ARTIST", artistId: "art1" });
    revalidatePath.mockReset();
    artistUpdate.mockReset().mockResolvedValue({});
    feedUpsert.mockReset().mockResolvedValue({ token: "NEWTOKEN" });
    feedUpdate.mockReset().mockResolvedValue({ token: "NEWTOKEN" });
    authFindFirst.mockReset().mockResolvedValue({ id: "p1", userId: "u1" });
    authDelete.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.resetModules());

  it("saveProfile updates only the signed-in user's own artist row with the style relation + numeric rates", async () => {
    const { saveProfile } = await import("./actions");
    const form = fd({
      bio: "Hello",
      insta: "@me",
      hourlyRatePounds: "90",
      dayRatePounds: "600",
    });
    form.append("styleIds", "s1");
    form.append("styleIds", "s2");
    await saveProfile(form);
    expect(artistUpdate).toHaveBeenCalledWith({
      where: { id: "art1" },
      data: expect.objectContaining({
        bio: "Hello",
        insta: "@me",
        hourlyRatePence: 9000,
        dayRatePence: 60000,
        styles: { set: [{ id: "s1" }, { id: "s2" }] },
      }),
    });
  });

  it("saveProfile does not write rateText or a comma-joined styles string", async () => {
    const { saveProfile } = await import("./actions");
    await saveProfile(fd({ bio: "x" }));
    const data = artistUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("rateText");
    expect(data.styles).toEqual({ set: [] });
  });

  it("saveProfile throws if the user has no linked artist", async () => {
    getCurrentUser.mockResolvedValue({
      id: "u1",
      role: "ARTIST",
      artistId: null,
    });
    const { saveProfile } = await import("./actions");
    await expect(saveProfile(fd({ bio: "x" }))).rejects.toThrow();
  });

  it("saveArtistProfile lets an owner update another artist's profile including status", async () => {
    getCurrentUser.mockResolvedValue({
      id: "o1",
      role: "OWNER",
      artistId: "ownArt",
    });
    requireRole.mockResolvedValue({ id: "o1", role: "OWNER" });
    const { saveArtistProfile } = await import("./actions");
    const form = fd({
      status: "APPRENTICE",
      bio: "New bio",
      insta: "@target",
      headshot: "/uploads/t.png",
      hourlyRatePounds: "80",
      dayRatePounds: "500",
      specials: "Snakes, Skulls",
    });
    form.append("styleIds", "s2");
    await saveArtistProfile("art2", form);
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(artistUpdate).toHaveBeenCalledWith({
      where: { id: "art2" },
      data: expect.objectContaining({
        status: "APPRENTICE",
        bio: "New bio",
        insta: "@target",
        headshot: "/uploads/t.png",
        hourlyRatePence: 8000,
        dayRatePence: 50000,
        styles: { set: [{ id: "s2" }] },
        specials: ["Snakes", "Skulls"],
      }),
    });
  });

  it("saveArtistProfile rejects a non-owner targeting another artist", async () => {
    getCurrentUser.mockResolvedValue({
      id: "u1",
      role: "ARTIST",
      artistId: "art1",
    });
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    const { saveArtistProfile } = await import("./actions");
    await expect(saveArtistProfile("art2", fd({ bio: "x" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(artistUpdate).not.toHaveBeenCalled();
  });

  it("saveArtistProfile never writes status for a non-owner editing their own artist", async () => {
    getCurrentUser.mockResolvedValue({
      id: "u1",
      role: "ARTIST",
      artistId: "art1",
    });
    const { saveArtistProfile } = await import("./actions");
    await saveArtistProfile("art1", fd({ status: "CO_OWNER", bio: "x" }));
    // self-target is allowed without the OWNER gate...
    expect(requireRole).not.toHaveBeenCalled();
    expect(artistUpdate).toHaveBeenCalled();
    // ...but the owner-only status field is dropped.
    const data = artistUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("status");
  });

  it("saveArtistProfile ignores an invalid status value", async () => {
    getCurrentUser.mockResolvedValue({
      id: "o1",
      role: "OWNER",
      artistId: "ownArt",
    });
    const { saveArtistProfile } = await import("./actions");
    await saveArtistProfile("art2", fd({ status: "HACKER", bio: "x" }));
    const data = artistUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("status");
  });

  it("saveArtistProfile throws when unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { saveArtistProfile } = await import("./actions");
    await expect(saveArtistProfile("art2", fd({ bio: "x" }))).rejects.toThrow(
      "Unauthorized",
    );
    expect(artistUpdate).not.toHaveBeenCalled();
  });

  it("regenerateFeed mints a fresh token for the artist's feed", async () => {
    const { regenerateFeed } = await import("./actions");
    await regenerateFeed();
    expect(feedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { artistId: "art1" },
        update: { token: "NEWTOKEN" },
      }),
    );
  });

  it("removeOwnPasskey only deletes a passkey owned by the current user", async () => {
    const { removeOwnPasskey } = await import("./actions");
    await removeOwnPasskey(fd({ credentialId: "p1" }));
    expect(authFindFirst).toHaveBeenCalledWith({
      where: { id: "p1", userId: "u1" },
    });
    expect(authDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("removeOwnPasskey refuses to delete another user's passkey", async () => {
    authFindFirst.mockResolvedValue(null);
    const { removeOwnPasskey } = await import("./actions");
    await removeOwnPasskey(fd({ credentialId: "other" }));
    expect(authDelete).not.toHaveBeenCalled();
  });
});
