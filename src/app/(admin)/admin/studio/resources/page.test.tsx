import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    chair: {
      findMany: vi.fn(async () => [
        { id: "c1", name: "Chair One", active: true, sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../../content/_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("ResourcesPage", () => {
  it("renders the chairs editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Resources");
    expect(html).toContain("Chair One");
  });
});
