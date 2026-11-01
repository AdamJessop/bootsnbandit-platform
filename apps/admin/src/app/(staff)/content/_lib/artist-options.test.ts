import { describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ artist: { findMany: vi.fn() } }));
vi.mock("@bnb/core/db", () => ({ prisma }));

const { artistField, loadArtistOptions } = await import("./artist-options");

describe("loadArtistOptions", () => {
  it("lists active artists and only queries again for unknown referenced ids", async () => {
    prisma.artist.findMany
      .mockResolvedValueOnce([{ id: "a1", name: "Sarah Boots" }])
      .mockResolvedValueOnce([{ id: "a9", name: "Old Hand" }]);
    const out = await loadArtistOptions(["a1", null, "a9", "a9", undefined]);
    expect(out).toEqual([
      { id: "a1", name: "Sarah Boots" },
      { id: "a9", name: "Old Hand (inactive)" },
    ]);
    expect(prisma.artist.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.artist.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: { in: ["a9"] } } }),
    );
  });

  it("skips the second query when every referenced artist is active", async () => {
    prisma.artist.findMany.mockReset();
    prisma.artist.findMany.mockResolvedValueOnce([
      { id: "a1", name: "Sarah Boots" },
    ]);
    await loadArtistOptions(["a1", null]);
    expect(prisma.artist.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("artistField", () => {
  it("builds a select with a blank 'No artist' option first", () => {
    const f = artistField([{ id: "a1", name: "Sarah Boots" }], {
      hideInTable: true,
    });
    expect(f.type).toBe("select");
    expect(f.hideInTable).toBe(true);
    expect(f.options).toEqual([
      { value: "", label: "No artist" },
      { value: "a1", label: "Sarah Boots" },
    ]);
  });
});
