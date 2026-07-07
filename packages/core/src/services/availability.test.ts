import { afterAll, describe, expect, it } from "vitest";
import { listAvailabilityRules, setAvailabilityRules } from "./availability";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("availability service (DB)", () => {
  let artistId: string;
  const created: string[] = [];

  afterAll(async () => {
    if (artistId)
      await db().availabilityRule.deleteMany({ where: { artistId } });
    await closeTestDb();
    void created;
  });

  it("setAvailabilityRules replaces the artist's weekly pattern", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    artistId = artist.id;

    await setAvailabilityRules(artistId, [
      { weekday: 2, startTime: "10:00", endTime: "18:00" },
      { weekday: 3, startTime: "10:00", endTime: "18:00" },
    ]);
    let rules = await listAvailabilityRules(artistId);
    expect(rules.length).toBe(2);

    // Replace with a single rule — old ones removed.
    await setAvailabilityRules(artistId, [
      { weekday: 4, startTime: "12:00", endTime: "20:00" },
    ]);
    rules = await listAvailabilityRules(artistId);
    expect(rules.length).toBe(1);
    expect(rules[0].weekday).toBe(4);
    expect(rules[0].startTime).toBe("12:00");
    void uid;
  });
});
