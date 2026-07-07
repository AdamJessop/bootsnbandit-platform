import { prisma } from "@bnb/core/db";

/**
 * Bandit Pass loyalty — stamp award + tier computation.
 *
 * One stamp per completed piece (per LoyaltyConfig.stampsPerVisit). Tier is the
 * count of perk thresholds the customer has reached (perks ladder unlocks at
 * 2/4/6/8 stamps in the seed). Called by `sessions.completeSession`.
 */

export interface LoyaltyPerk {
  stamps: number;
  title: string;
  desc: string;
}

export interface AwardStampResult {
  customerId: string;
  loyaltyStamps: number;
  loyaltyTier: number;
  /** Perk thresholds newly reached by this award (for reward emails). */
  unlockedPerks: LoyaltyPerk[];
}

function parsePerks(raw: unknown): LoyaltyPerk[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is { stamps: number; title?: unknown; desc?: unknown } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { stamps?: unknown }).stamps === "number",
    )
    .map((p) => ({
      stamps: p.stamps,
      title: String(p.title ?? ""),
      desc: String(p.desc ?? ""),
    }))
    .sort((a, b) => a.stamps - b.stamps);
}

/** Tier = number of perk thresholds the stamp count has reached. */
export function tierForStamps(stamps: number, perks: LoyaltyPerk[]): number {
  return perks.filter((p) => stamps >= p.stamps).length;
}

/**
 * Award loyalty stamp(s) to a customer per the active LoyaltyConfig and
 * recompute their tier. Returns the new totals + any perks newly unlocked.
 */
export async function awardStamp(
  customerId: string,
): Promise<AwardStampResult> {
  const config = await prisma.loyaltyConfig.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  const increment = config?.stampsPerVisit ?? 1;
  const perks = parsePerks(config?.perks);

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { loyaltyStamps: true },
  });

  const before = customer.loyaltyStamps;
  const after = before + increment;
  const tier = tierForStamps(after, perks);

  await prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyStamps: after, loyaltyTier: tier },
  });

  const unlockedPerks = perks.filter(
    (p) => p.stamps > before && p.stamps <= after,
  );

  return {
    customerId,
    loyaltyStamps: after,
    loyaltyTier: tier,
    unlockedPerks,
  };
}
