import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type { CronJobResult } from "./reminders";

/**
 * Loyalty-rewards cron job (P12).
 *
 * Emails customers who have crossed the active LoyaltyConfig `rewardThreshold`
 * (stamps) and have NOT yet received a `loyalty_reward` email. Idempotent: the
 * loyalty_reward MessageLog dedupe means each crossing is announced once.
 *
 * (The per-session stamp award + perk-unlock emails already fire at completion;
 * this is the safety-net sweep for threshold crossings that slipped through.)
 */
export async function runLoyaltyRewards(): Promise<CronJobResult> {
  const config = await prisma.loyaltyConfig.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!config) {
    return { job: "loyalty_rewards", sent: 0, skipped: 0 };
  }

  const threshold = config.rewardThreshold;
  const customers = await prisma.customer.findMany({
    where: {
      loyaltyStamps: { gte: threshold },
      email: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      loyaltyStamps: true,
      loyaltyTier: true,
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const c of customers) {
    const email = c.email?.trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    // Idempotency: skip if this customer was already sent a loyalty reward.
    const existing = await prisma.messageLog.count({
      where: { customerId: c.id, type: "loyalty_reward" },
    });
    if (existing > 0) {
      skipped += 1;
      continue;
    }

    await sendEmail({
      to: email,
      type: "loyalty_reward",
      customerId: c.id,
      data: {
        customerName: c.name,
        rewardLabel: config.rewardDesc ?? "a Bandit Pass reward",
        stamps: c.loyaltyStamps,
        tierLabel: `Tier ${c.loyaltyTier}`,
      },
    });
    sent += 1;
  }

  return { job: "loyalty_rewards", sent, skipped };
}
