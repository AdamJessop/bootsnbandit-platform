import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    aftercareStage: {
      findMany: vi.fn(async () => [
        { id: "ac1", order: 1, title: "First 24 hours", body: "Keep it clean" },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("AftercareContentPage", () => {
  it("renders the aftercare editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Aftercare");
    expect(html).toContain("First 24 hours");
  });
});
