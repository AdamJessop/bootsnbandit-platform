import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const prisma = vi.hoisted(() => ({
  artist: { findMany: vi.fn() },
  tattooStyle: { findMany: vi.fn() },
  siteSettings: { findFirst: vi.fn() },
  flash: { findUnique: vi.fn() },
}));
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("./enquire.module.css", () => ({ default: {} }));

const { default: EnquirePage } = await import("./page");

function seedDb({ enquiriesOpen = true } = {}) {
  prisma.artist.findMany.mockResolvedValue([
    {
      id: "cku1",
      slug: "sarah",
      name: "Sarah Boots",
      status: "CO_OWNER",
      booksStatus: "open",
    },
    {
      id: "cku2",
      slug: "calum",
      name: "Calum Rhodes",
      status: "RESIDENT",
      booksStatus: "closed",
    },
  ]);
  prisma.tattooStyle.findMany.mockResolvedValue([{ name: "Fine-line" }]);
  prisma.siteSettings.findFirst.mockResolvedValue({ enquiriesOpen });
  prisma.flash.findUnique.mockResolvedValue(null);
}

const render = async (sp: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await EnquirePage({ searchParams: Promise.resolve(sp) }),
  );

describe("EnquirePage", () => {
  it("renders the wizard when enquiries are open", async () => {
    seedDb();
    const html = await render();
    expect(html).toContain("Pick your artist");
    expect(html).not.toContain("Books are closed");
  });

  it("preselects an artist linked by slug (artist-detail links)", async () => {
    seedDb();
    const html = await render({ artist: "calum", wait: "1" });
    // The closed-books artist is kept (not dropped) and the waitlist note shows.
    expect(html).toContain("waitlist");
  });

  it("pre-selects and locks the flash design's artist for a flash claim", async () => {
    seedDb();
    prisma.flash.findUnique.mockResolvedValue({
      id: "f1",
      title: "Pearl Shell",
      artistId: "cku2",
      pricePence: 13000,
      sizeCm: "~11cm",
    });
    const html = await render({ flash: "f1", artist: "sarah" });
    expect(prisma.flash.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "f1" } }),
    );
    // The flash artist (Calum, books closed) wins over the ?artist= seed and
    // the picker collapses to just him — no "match me" or other artists.
    expect(html).toContain("Your artist");
    expect(html).toContain("Calum Rhodes");
    expect(html).not.toContain("No preference");
    expect(html).not.toContain("Sarah Boots");
    expect(html).toContain("waitlist");
    expect(html).toContain("Pearl Shell");
    expect(html).toContain("£130");
  });

  it("falls back to the normal wizard when the flash id is unknown", async () => {
    seedDb();
    const html = await render({ flash: "nope" });
    expect(html).toContain("Pick your artist");
    expect(html).toContain("No preference");
    expect(html).not.toContain("flash claim");
  });

  it("renders the books-closed notice instead of the wizard when the toggle is off", async () => {
    seedDb({ enquiriesOpen: false });
    const html = await render();
    expect(html).toContain("Books are closed");
    expect(html).not.toContain("Pick your artist");
  });
});
