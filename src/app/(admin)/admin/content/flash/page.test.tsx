import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    flash: {
      findMany: vi.fn(async () => [
        { id: "f1", title: "Dagger", sizeCm: "8", status: "available", sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("FlashContentPage", () => {
  it("renders the flash editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Flash");
    expect(html).toContain("Dagger");
  });
});
