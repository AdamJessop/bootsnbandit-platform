import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  awardStamp,
  tierForStamps,
  tierLabel,
  type LoyaltyPerk,
} from "./loyalty";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const PERKS: LoyaltyPerk[] = [
  { stamps: 2, title: "Birthday treat", desc: "" },
  { stamps: 4, title: "Early flash access", desc: "" },
  { stamps: 6, title: "Priority booking", desc: "" },
  { stamps: 8, title: "Free small tattoo", desc: "" },
];

describe("tierForStamps", () => {
  it("counts reached perk thresholds", () => {
    expect(tierForStamps(0, PERKS)).toBe(0);
    expect(tierForStamps(2, PERKS)).toBe(1);
    expect(tierForStamps(5, PERKS)).toBe(2);
    expect(tierForStamps(8, PERKS)).toBe(4);
    expect(tierForStamps(99, PERKS)).toBe(4);
  });
});

describe("tierLabel", () => {
  it("names the tier after its perk on the configured ladder", () => {
    expect(tierLabel(1, PERKS)).toBe("Level 1 · Birthday treat");
    expect(tierLabel(2, PERKS)).toBe("Level 2 · Early flash access");
    expect(tierLabel(4, PERKS)).toBe("Level 4 · Free small tattoo");
  });

  it("falls back to the scheme name below the first perk", () => {
    expect(tierLabel(0, PERKS)).toBe("Bandit Pass");
    expect(tierLabel(0, PERKS, "Outlaw Card")).toBe("Outlaw Card");
  });

  it("never says a bare 'Tier N', even with no perks configured", () => {
    expect(tierLabel(3, [])).toBe("Level 3");
    expect(tierLabel(3, [])).not.toContain("Tier");
  });
});

describe("awardStamp (DB)", () => {
  const db = () => testDb();
  let customerId: string;

  beforeAll(async () => {
    if (!(await dbReachable())) return;
    const c = await db().customer.create({
      data: { name: `Loyalty ${uid()}`, loyaltyStamps: 1, loyaltyTier: 0 },
    });
    customerId = c.id;
  });

  afterAll(async () => {
    if (customerId) {
      await db().customer.delete({ where: { id: customerId } });
    }
    await closeTestDb();
  });

  it("increments stamps and recomputes tier, flagging unlocked perks", async () => {
    if (!(await dbReachable())) return;
    // 1 → 2 crosses the first perk threshold.
    const r = await awardStamp(customerId);
    expect(r.loyaltyStamps).toBe(2);
    expect(r.loyaltyTier).toBeGreaterThanOrEqual(1);
    expect(r.unlockedPerks.some((p) => p.stamps === 2)).toBe(true);

    const persisted = await db().customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { loyaltyStamps: true, loyaltyTier: true },
    });
    expect(persisted.loyaltyStamps).toBe(2);
  });
});
