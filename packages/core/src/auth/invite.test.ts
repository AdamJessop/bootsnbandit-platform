import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * mintStaffInvite must never silently change an existing user's role: owners
 * re-invite people for a new phone, and the old upsert wrote the form's
 * default (ARTIST) over an owner. Pending-invite listing backs the owner's
 * "Copy link" / "Resend" fallback. Prisma is mocked — no DB.
 */

const userUpsert = vi.fn();
const inviteCreate = vi.fn();
const inviteFindMany = vi.fn();
const inviteFindUnique = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    user: { upsert: (...a: unknown[]) => userUpsert(...a) },
    staffInvite: {
      create: (...a: unknown[]) => inviteCreate(...a),
      findMany: (...a: unknown[]) => inviteFindMany(...a),
      findUnique: (...a: unknown[]) => inviteFindUnique(...a),
    },
  },
}));

const { mintStaffInvite, listPendingInvites, findPendingInvite } =
  await import("./invite");

const NOW = new Date("2026-11-01T09:00:00Z");

beforeEach(() => {
  process.env.APP_ORIGIN = "https://admin.example.com";
  userUpsert.mockReset();
  inviteCreate.mockReset().mockResolvedValue({});
  inviteFindMany.mockReset();
  inviteFindUnique.mockReset();
});

describe("mintStaffInvite", () => {
  it("creates a new user as ARTIST by default", async () => {
    userUpsert.mockResolvedValue({ id: "u1", role: "ARTIST" });
    const res = await mintStaffInvite({ email: " New@Example.com " });
    const arg = userUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ email: "new@example.com" });
    expect(arg.create).toMatchObject({ role: "ARTIST", displayName: "new" });
    expect(res.role).toBe("ARTIST");
    expect(res.url).toBe(
      `https://admin.example.com/sign-in?invite=${res.token}`,
    );
  });

  it("keeps an existing owner's role on a re-invite with no role picked", async () => {
    userUpsert.mockResolvedValue({ id: "u1", role: "OWNER" });
    const res = await mintStaffInvite({ email: "sarah@example.com" });
    // The update leaves role alone...
    expect(userUpsert.mock.calls[0][0].update).toEqual({});
    // ...and the invite records the role they actually have.
    expect(res.role).toBe("OWNER");
    expect(inviteCreate.mock.calls[0][0].data).toMatchObject({
      email: "sarah@example.com",
      role: "OWNER",
      userId: "u1",
    });
  });

  it("changes an existing user's role only when one is explicitly given", async () => {
    userUpsert.mockResolvedValue({ id: "u1", role: "OWNER" });
    await mintStaffInvite({ email: "calum@example.com", role: "OWNER" });
    expect(userUpsert.mock.calls[0][0].update).toEqual({ role: "OWNER" });
  });

  it("expires the invite after 7 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      userUpsert.mockResolvedValue({ id: "u1", role: "ARTIST" });
      const res = await mintStaffInvite({ email: "a@example.com" });
      expect(res.expiresAt.getTime() - NOW.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("listPendingInvites", () => {
  it("asks only for unredeemed, unexpired invites and keeps the newest per email", async () => {
    inviteFindMany.mockResolvedValue([
      {
        id: "i2",
        token: "tok2",
        email: "a@example.com",
        role: "ARTIST",
        userId: "u1",
        expiresAt: new Date("2026-11-08"),
        createdAt: new Date("2026-11-01"),
      },
      {
        id: "i1",
        token: "tok1",
        email: "a@example.com",
        role: "ARTIST",
        userId: "u1",
        expiresAt: new Date("2026-11-05"),
        createdAt: new Date("2026-10-29"),
      },
    ]);
    const res = await listPendingInvites(NOW);
    expect(inviteFindMany.mock.calls[0][0]).toMatchObject({
      where: { redeemedAt: null, expiresAt: { gt: NOW } },
      orderBy: { createdAt: "desc" },
    });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: "i2",
      url: "https://admin.example.com/sign-in?invite=tok2",
    });
  });
});

describe("findPendingInvite", () => {
  const row = {
    id: "i1",
    token: "tok1",
    email: "a@example.com",
    role: "ARTIST",
    userId: "u1",
    expiresAt: new Date("2026-11-05"),
    createdAt: new Date("2026-10-29"),
    redeemedAt: null,
  };

  it("returns a live invite with its link", async () => {
    inviteFindUnique.mockResolvedValue(row);
    expect(await findPendingInvite("i1", NOW)).toMatchObject({
      email: "a@example.com",
      url: "https://admin.example.com/sign-in?invite=tok1",
    });
  });

  it("returns null for a used, expired or missing invite", async () => {
    inviteFindUnique.mockResolvedValue({ ...row, redeemedAt: NOW });
    expect(await findPendingInvite("i1", NOW)).toBeNull();
    inviteFindUnique.mockResolvedValue({
      ...row,
      expiresAt: new Date("2026-10-31"),
    });
    expect(await findPendingInvite("i1", NOW)).toBeNull();
    inviteFindUnique.mockResolvedValue(null);
    expect(await findPendingInvite("i1", NOW)).toBeNull();
  });
});
