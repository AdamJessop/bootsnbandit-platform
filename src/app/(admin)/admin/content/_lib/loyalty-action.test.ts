import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const upsert = vi.fn();
const revalidatePath = vi.fn();
const requireRole = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: { loyaltyConfig: { upsert } } }));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("saveLoyalty", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ id: "l1" });
    revalidatePath.mockReset();
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
  });
  afterEach(() => vi.resetModules());

  it("upserts the config keyed by name with parsed perks", async () => {
    const { saveLoyalty } = await import("./loyalty-action");
    await saveLoyalty(
      fd({
        name: "Bandit Pass",
        stampsPerVisit: "1",
        rewardThreshold: "8",
        spendPerStamp: "5000",
        perksText: "2 | Birthday | \n8 | Free | ",
        active: "on",
      }),
    );
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    const arg = upsert.mock.calls[0][0] as {
      where: { name: string };
      create: { perks: unknown[] };
    };
    expect(arg.where.name).toBe("Bandit Pass");
    expect(Array.isArray(arg.create.perks)).toBe(true);
    expect(arg.create.perks).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalled();
  });
});
