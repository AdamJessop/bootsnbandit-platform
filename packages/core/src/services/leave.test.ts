import { afterAll, describe, expect, it } from "vitest";
import { createLeave, listLeave, setLeaveStatus } from "./leave";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("leave service (DB)", () => {
  const created: string[] = [];
  let artistId: string;

  afterAll(async () => {
    if (created.length)
      await db().leave.deleteMany({ where: { id: { in: created } } });
    await closeTestDb();
  });

  it("createLeave records a date range, listLeave returns it, setLeaveStatus updates", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    artistId = artist.id;

    const leave = await createLeave({
      artistId,
      startDate: new Date("2099-09-01T00:00:00Z"),
      endDate: new Date("2099-09-07T23:59:59Z"),
      reason: `Holiday ${uid()}`,
      status: "pending",
    });
    created.push(leave.id);
    expect(leave.status).toBe("pending");

    const list = await listLeave({
      artistId,
      from: new Date("2099-08-01T00:00:00Z"),
      to: new Date("2099-10-01T00:00:00Z"),
    });
    expect(list.some((l) => l.id === leave.id)).toBe(true);

    const approved = await setLeaveStatus(leave.id, "approved");
    expect(approved.status).toBe("approved");
  });
});
