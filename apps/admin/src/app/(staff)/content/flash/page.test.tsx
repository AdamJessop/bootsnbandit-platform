import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CrudField } from "../_components/CrudSection";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
const prisma = vi.hoisted(() => ({
  flash: { findMany: vi.fn() },
  artist: { findMany: vi.fn() },
}));
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

const ACTIVE = [
  { id: "a1", name: "Sarah Boots" },
  { id: "a2", name: "Calum Rhodes" },
];

function seed(
  rows: Record<string, unknown>[],
  extra = [{ id: "a9", name: "Old Hand" }],
) {
  prisma.flash.findMany.mockResolvedValue(rows);
  prisma.artist.findMany.mockImplementation(
    async (args: { where?: { active?: boolean; id?: { in: string[] } } }) =>
      args.where?.active ? ACTIVE : extra,
  );
}

describe("FlashContentPage", () => {
  it("renders the flash editor with rows, the artist name and a £ price", async () => {
    seed([
      {
        id: "f1",
        title: "Dagger",
        artistId: "a1",
        pricePence: 13000,
        sizeCm: "8",
        status: "available",
        sortOrder: 0,
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Flash");
    expect(html).toContain("Dagger");
    // Table shows the artist's name (not the id) and the price in pounds.
    expect(html).toContain("Sarah Boots");
    expect(html).toContain("£130");
    expect(html).not.toContain("Artist ID");
    expect(html).not.toContain("Price (pence)");
    expect(prisma.artist.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps a deactivated artist selectable for the rows that still reference them", async () => {
    seed([
      {
        id: "f2",
        title: "Moth",
        artistId: "a9",
        status: "retired",
        sortOrder: 1,
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Old Hand (inactive)");
  });

  it("edits the drop's end as UK-time text, not the old free-text deadline", async () => {
    seed([
      {
        id: "f3",
        title: "Swallow",
        artistId: "a1",
        status: "available",
        sortOrder: 2,
        endsAt: new Date("2026-11-14T18:00:00Z"),
      },
    ]);
    // Capture what the page hands the generic editor.
    const seen: { fields?: CrudField[]; rows?: Record<string, unknown>[] } = {};
    vi.resetModules();
    vi.doMock("../_components/CrudSection", () => ({
      CrudSection: (p: typeof seen) => {
        Object.assign(seen, p);
        return null;
      },
    }));
    const { default: Page } = await import("./page");
    renderToStaticMarkup(await Page());
    vi.doUnmock("../_components/CrudSection");

    const names = seen.fields!.map((f) => f.name);
    expect(names).toContain("endsAt");
    expect(names).not.toContain("deadline");
    const endsAt = seen.fields!.find((f) => f.name === "endsAt")!;
    expect(endsAt.placeholder).toMatch(/YYYY-MM-DD/);
    expect(seen.rows![0].endsAt).toBe("2026-11-14 18:00");
  });
});
