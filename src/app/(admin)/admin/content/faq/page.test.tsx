import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    faq: {
      findMany: vi.fn(async () => [
        { id: "q1", question: "Do you take walk-ins?", answer: "Yes", sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("FaqContentPage", () => {
  it("renders the FAQ editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("FAQ");
    expect(html).toContain("Do you take walk-ins?");
  });
});
