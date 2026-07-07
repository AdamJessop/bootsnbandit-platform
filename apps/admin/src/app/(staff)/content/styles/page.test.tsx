import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    tattooStyle: {
      findMany: vi.fn(async () => [
        { id: "s1", name: "Traditional", sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("StylesContentPage", () => {
  it("renders the styles editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Styles");
    expect(html).toContain("Traditional");
  });
});
