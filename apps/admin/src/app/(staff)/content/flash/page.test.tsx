import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
});
