/**
 * Pure parsing helpers for the Loyalty (Bandit Pass) editor. Kept free of
 * server-only imports so the form coercion + perks-ladder parsing is unit
 * testable. Perks are stored as the `LoyaltyConfig.perks` JSON column.
 */

export interface LoyaltyPerk {
  stamps: number;
  title: string;
  desc: string;
}

export interface LoyaltyFormValues {
  name: string;
  stampsPerVisit: number;
  spendPerStamp: number | null;
  rewardThreshold: number;
  rewardDesc: string | null;
  expiryMonths: number | null;
  messaging: string | null;
  perks: LoyaltyPerk[];
  active: boolean;
}

/** Parse a `stamps | title | desc` textarea into a sorted perk ladder. */
export function parsePerksText(text: string): LoyaltyPerk[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawStamps, title = "", desc = ""] = line
        .split("|")
        .map((p) => p.trim());
      const stamps = Number(rawStamps);
      if (!Number.isFinite(stamps)) return null;
      return { stamps, title, desc };
    })
    .filter((p): p is LoyaltyPerk => p !== null)
    .sort((a, b) => a.stamps - b.stamps);
}

/** Render a perk ladder back into editable `stamps | title | desc` lines. */
export function perksToText(perks: LoyaltyPerk[]): string {
  return perks.map((p) => `${p.stamps} | ${p.title} | ${p.desc}`).join("\n");
}

function num(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** Coerce the loyalty form's FormData into typed, validated values. */
export function parseLoyaltyForm(fd: FormData): LoyaltyFormValues {
  const name = str(fd, "name");
  if (!name) throw new Error("Scheme name is required");

  return {
    name,
    stampsPerVisit: num(fd, "stampsPerVisit") ?? 1,
    spendPerStamp: num(fd, "spendPerStamp"),
    rewardThreshold: num(fd, "rewardThreshold") ?? 8,
    rewardDesc: str(fd, "rewardDesc"),
    expiryMonths: num(fd, "expiryMonths"),
    messaging: str(fd, "messaging"),
    perks: parsePerksText(
      typeof fd.get("perksText") === "string"
        ? (fd.get("perksText") as string)
        : "",
    ),
    active: fd.get("active") === "on" || fd.get("active") === "true",
  };
}
