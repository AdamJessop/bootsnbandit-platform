import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload } from "./session";

/**
 * getCurrentUser must re-check the User row on every call: sessions are
 * stateless sliding 30-day JWEs, so deactivating (or deleting) a staff member
 * has to take effect immediately — not when their cookie expires — and role /
 * artist link / email / name come from the row, not the cookie, so promotions,
 * demotions and profile links apply on the next request. Fails closed.
 */

const readSessionCookie = vi.fn<() => Promise<SessionPayload | null>>();
const userFindUnique = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));
vi.mock("./cookies", () => ({
  readSessionCookie: () => readSessionCookie(),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } },
}));

const { getCurrentUser, requireRole } = await import("./index");

const PAYLOAD: SessionPayload = {
  sub: "user_1",
  email: "sarah@bootsnbandit.co.uk",
  role: "ARTIST",
  displayName: "Sarah",
  artistId: "artist_1",
};

const ROW = {
  active: true,
  email: "sarah@bootsnbandit.co.uk",
  role: "ARTIST",
  displayName: "Sarah",
  artist: { id: "artist_1" },
};

beforeEach(() => {
  readSessionCookie.mockReset();
  userFindUnique.mockReset();
  redirect.mockClear();
});

describe("getCurrentUser", () => {
  it("returns null without touching the DB when there is no session cookie", async () => {
    readSessionCookie.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns the session user when the user row is still active", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue(ROW);
    const user = await getCurrentUser();
    expect(user).toMatchObject({
      id: "user_1",
      email: "sarah@bootsnbandit.co.uk",
      role: "ARTIST",
    });
    // One indexed (PK) lookup only.
    expect(userFindUnique).toHaveBeenCalledOnce();
    expect(userFindUnique.mock.calls[0][0]).toMatchObject({
      where: { id: "user_1" },
    });
  });

  it("reads role + artist link from the DB, not the (stale) cookie", async () => {
    // Cookie minted while Sarah was an unlinked artist; since then she was
    // promoted to owner, linked to a profile and had her email corrected.
    readSessionCookie.mockResolvedValue({ ...PAYLOAD, artistId: null });
    userFindUnique.mockResolvedValue({
      ...ROW,
      role: "OWNER",
      email: "sarah@example.com",
      displayName: "Sarah B",
      artist: { id: "artist_9" },
    });
    expect(await getCurrentUser()).toEqual({
      id: "user_1",
      email: "sarah@example.com",
      role: "OWNER",
      displayName: "Sarah B",
      artistId: "artist_9",
    });
    // Still one query: role and artist link ride the same PK lookup.
    expect(userFindUnique).toHaveBeenCalledOnce();
    expect(userFindUnique.mock.calls[0][0]).toMatchObject({
      select: { active: true, role: true, artist: { select: { id: true } } },
    });
  });

  it("drops a stale artist link when the profile has been unlinked", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue({ ...ROW, artist: null });
    expect((await getCurrentUser())?.artistId).toBeNull();
  });

  it("returns null when the user has been deactivated (fails closed)", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue({ active: false });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when the user row no longer exists (fails closed)", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireRole", () => {
  it("redirects a deactivated user to /sign-in", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue({ active: false });
    await expect(requireRole()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
  });

  it("redirects a demoted owner away from owner routes immediately", async () => {
    // The cookie still says OWNER; the DB says ARTIST.
    readSessionCookie.mockResolvedValue({ ...PAYLOAD, role: "OWNER" });
    userFindUnique.mockResolvedValue({ ...ROW, role: "ARTIST" });
    await expect(requireRole("OWNER")).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("returns an active user", async () => {
    readSessionCookie.mockResolvedValue(PAYLOAD);
    userFindUnique.mockResolvedValue(ROW);
    const user = await requireRole("ARTIST");
    expect(user.id).toBe("user_1");
    expect(redirect).not.toHaveBeenCalled();
  });
});
