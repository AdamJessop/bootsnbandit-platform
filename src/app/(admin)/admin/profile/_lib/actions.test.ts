import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();
const artistUpdate = vi.fn();
const feedUpsert = vi.fn();
const feedUpdate = vi.fn();
const authFindFirst = vi.fn();
const authDelete = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
}));
vi.mock("@/lib/auth/tokens", () => ({ generateToken: () => "NEWTOKEN" }));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@/lib/db", () => ({
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
    revalidatePath.mockReset();
    artistUpdate.mockReset().mockResolvedValue({});
    feedUpsert.mockReset().mockResolvedValue({ token: "NEWTOKEN" });
    feedUpdate.mockReset().mockResolvedValue({ token: "NEWTOKEN" });
    authFindFirst.mockReset().mockResolvedValue({ id: "p1", userId: "u1" });
    authDelete.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.resetModules());

  it("saveProfile updates only the signed-in user's own artist row", async () => {
    const { saveProfile } = await import("./actions");
    await saveProfile(fd({ bio: "Hello", insta: "@me", styles: "Fineline, Bold" }));
    expect(artistUpdate).toHaveBeenCalledWith({
      where: { id: "art1" },
      data: expect.objectContaining({
        bio: "Hello",
        insta: "@me",
        styles: ["Fineline", "Bold"],
      }),
    });
  });

  it("saveProfile throws if the user has no linked artist", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "ARTIST", artistId: null });
    const { saveProfile } = await import("./actions");
    await expect(saveProfile(fd({ bio: "x" }))).rejects.toThrow();
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
