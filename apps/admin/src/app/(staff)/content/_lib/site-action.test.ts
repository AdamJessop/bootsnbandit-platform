import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const upsert = vi.fn();
const revalidatePath = vi.fn();
const requireRole = vi.fn();

vi.mock("@bnb/core/db", () => ({ prisma: { siteSettings: { upsert } } }));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("saveSite", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ id: "s1" });
    revalidatePath.mockReset();
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
  });
  afterEach(() => vi.resetModules());

  it("upserts SiteSettings keyed by studio name with ticker lines", async () => {
    const { saveSite } = await import("./site-action");
    await saveSite(
      fd({
        studioName: "Boots 'n' Bandit",
        tickerText: "Walk-ins welcome\nFlash Friday",
        enquiriesOpen: "on",
      }),
    );
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    const arg = upsert.mock.calls[0][0] as {
      where: { studioName: string };
      create: { tickerLines: string[]; enquiriesOpen: boolean };
    };
    expect(arg.where.studioName).toBe("Boots 'n' Bandit");
    expect(arg.create.tickerLines).toEqual([
      "Walk-ins welcome",
      "Flash Friday",
    ]);
    expect(arg.create.enquiriesOpen).toBe(true);
    expect(revalidatePath).toHaveBeenCalled();
  });
});
