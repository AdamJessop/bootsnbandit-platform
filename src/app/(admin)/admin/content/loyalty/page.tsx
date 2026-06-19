import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  LoyaltyEditor,
  type LoyaltyEditorValues,
} from "../_components/LoyaltyEditor";
import { saveLoyalty } from "../_lib/loyalty-action";
import { parsePerksText, type LoyaltyPerk } from "../_lib/loyalty-form";

/** Loyalty (Bandit Pass) editor page (J7). Owner-only. */
export const dynamic = "force-dynamic";

function readPerks(raw: unknown): LoyaltyPerk[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (p): p is { stamps: number; title?: unknown; desc?: unknown } =>
          !!p && typeof (p as { stamps?: unknown }).stamps === "number",
      )
      .map((p) => ({
        stamps: p.stamps,
        title: String(p.title ?? ""),
        desc: String(p.desc ?? ""),
      }));
  }
  return [];
}

export default async function LoyaltyContentPage() {
  await requireRole("OWNER");
  const cfg = await prisma.loyaltyConfig.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const values: LoyaltyEditorValues = {
    name: cfg?.name ?? "Bandit Pass",
    stampsPerVisit: cfg?.stampsPerVisit ?? 1,
    spendPerStamp: cfg?.spendPerStamp ?? null,
    rewardThreshold: cfg?.rewardThreshold ?? 8,
    rewardDesc: cfg?.rewardDesc ?? null,
    expiryMonths: cfg?.expiryMonths ?? null,
    messaging: cfg?.messaging ?? null,
    perks: cfg ? readPerks(cfg.perks) : parsePerksText(""),
    active: cfg?.active ?? true,
  };

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Loyalty (Bandit Pass)
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Configure stamps, thresholds, perks and messaging.
      </p>
      <LoyaltyEditor values={values} action={saveLoyalty} />
    </main>
  );
}
