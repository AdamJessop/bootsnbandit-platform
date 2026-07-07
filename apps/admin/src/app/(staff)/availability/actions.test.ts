import { afterAll, describe, expect, it, vi } from "vitest";
import {
  closeTestDb,
  dbReachable,
  testDb,
  uid,
} from "@bnb/core/services/testdb";

/**
 * Leave approval (H2). Owners approve/reject pending leave; artists cannot.
 * Integration (dockerised Postgres, skipped when unreachable): approving a
 * pending request flips its status and — via bookings.checkConflict — the
 * approved range then blocks the calendar, where pending did not.
 */

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "o@x",
    role: "OWNER" as const,
    displayName: "Owner",
  })),
}));

const { requireRole } = await import("@bnb/core/auth");
const asArtist = () =>
  vi.mocked(requireRole).mockResolvedValueOnce({
    id: "a1",
    email: "artist@x",
    role: "ARTIST" as const,
    displayName: "Artist",
    artistId: "art_self",
  });

const { setLeaveStatusAction } = await import("./actions");
const { checkConflict } = await import("@bnb/core/services/bookings");

// A far-future window no other suite books into.
const WINDOW = {
  startDate: new Date("2099-11-15T00:00:00Z"),
  endDate: new Date("2099-11-22T00:00:00Z"),
};
const probe = (artistId: string) => ({
  artistId,
  start: new Date("2099-11-17T10:00:00Z"),
  end: new Date("2099-11-17T12:00:00Z"),
});

describe("setLeaveStatusAction", () => {
  const leaves: string[] = [];

  afterAll(async () => {
    if (leaves.length) {
      await testDb().leave.deleteMany({ where: { id: { in: leaves } } });
    }
    await closeTestDb();
  });

  it("blocks an artist from approving leave (no owner role)", async () => {
    asArtist();
    const res = await setLeaveStatusAction({
      leaveId: "irrelevant",
      status: "approved",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/only owners/i);
  });

  it("rejects an invalid status payload", async () => {
    const res = await setLeaveStatusAction({
      leaveId: "irrelevant",
      status: "sneaky" as never,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid/i);
  });

  it("owner approves pending leave; approved leave then blocks the calendar", async () => {
    if (!(await dbReachable())) return;
    const artist = await testDb().artist.findFirstOrThrow();
    const leave = await testDb().leave.create({
      data: {
        artistId: artist.id,
        ...WINDOW,
        status: "pending",
        reason: `Approve me ${uid()}`,
      },
    });
    leaves.push(leave.id);

    // Pending leave does not block the calendar…
    expect(await checkConflict(probe(artist.id))).toBeNull();

    const res = await setLeaveStatusAction({
      leaveId: leave.id,
      status: "approved",
    });
    expect(res).toEqual({ ok: true });

    const updated = await testDb().leave.findUniqueOrThrow({
      where: { id: leave.id },
    });
    expect(updated.status).toBe("approved");

    // …approved leave does.
    expect(await checkConflict(probe(artist.id))).toEqual({
      kind: "leave",
      id: leave.id,
    });
  });

  it("artist cannot resolve a pending request (status unchanged)", async () => {
    if (!(await dbReachable())) return;
    const artist = await testDb().artist.findFirstOrThrow();
    const leave = await testDb().leave.create({
      data: {
        artistId: artist.id,
        startDate: new Date("2099-12-01T00:00:00Z"),
        endDate: new Date("2099-12-03T00:00:00Z"),
        status: "pending",
        reason: `Still pending ${uid()}`,
      },
    });
    leaves.push(leave.id);

    asArtist();
    const res = await setLeaveStatusAction({
      leaveId: leave.id,
      status: "approved",
    });
    expect(res.ok).toBe(false);

    const unchanged = await testDb().leave.findUniqueOrThrow({
      where: { id: leave.id },
    });
    expect(unchanged.status).toBe("pending");
  });

  it("owner can reject a pending request", async () => {
    if (!(await dbReachable())) return;
    const artist = await testDb().artist.findFirstOrThrow();
    const leave = await testDb().leave.create({
      data: {
        artistId: artist.id,
        startDate: new Date("2099-12-10T00:00:00Z"),
        endDate: new Date("2099-12-12T00:00:00Z"),
        status: "pending",
      },
    });
    leaves.push(leave.id);

    const res = await setLeaveStatusAction({
      leaveId: leave.id,
      status: "rejected",
    });
    expect(res).toEqual({ ok: true });
    const updated = await testDb().leave.findUniqueOrThrow({
      where: { id: leave.id },
    });
    expect(updated.status).toBe("rejected");
  });
});
