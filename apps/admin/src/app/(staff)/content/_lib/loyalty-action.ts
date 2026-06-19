"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import { parseLoyaltyForm } from "./loyalty-form";

/**
 * Save the Bandit Pass loyalty config (J7). Owner-only. There is a single
 * scheme keyed by its unique `name`, so we upsert; the perks ladder is written
 * to the `perks` JSON column.
 */
export async function saveLoyalty(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const v = parseLoyaltyForm(fd);
  const data = {
    name: v.name,
    stampsPerVisit: v.stampsPerVisit,
    spendPerStamp: v.spendPerStamp,
    rewardThreshold: v.rewardThreshold,
    rewardDesc: v.rewardDesc,
    expiryMonths: v.expiryMonths,
    messaging: v.messaging,
    // perks ladder -> Prisma Json column.
    perks: v.perks as unknown as Prisma.InputJsonValue,
    active: v.active,
  };
  await prisma.loyaltyConfig.upsert({
    where: { name: v.name },
    create: data,
    update: data,
  });
  revalidatePath("/content/loyalty");
}
