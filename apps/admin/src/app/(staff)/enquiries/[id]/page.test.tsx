import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const findFirst = vi.fn();
vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "sarah@x.test",
    role: "OWNER",
    displayName: "Sarah",
    artistId: null,
  })),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    enquiry: { findFirst: (...args: unknown[]) => findFirst(...args) },
    artist: { findMany: vi.fn(async () => [{ id: "a1", name: "Sarah North" }]) },
  },
}));
vi.mock("../enquiry-loader", () => ({
  INBOX_SELECT: { id: true },
  buildEnquiryItems: vi.fn(async (rows: { id: string }[]) =>
    rows.map((r) => ({ id: r.id, contactName: "Priya Kaur" })),
  ),
}));
vi.mock("./EnquiryPage", () => ({
  EnquiryPage: ({ item }: { item: { contactName: string } }) => (
    <div data-testid="page">{item.contactName}</div>
  ),
}));

import EnquiryDetailPage from "./page";

describe("EnquiryDetailPage", () => {
  it("renders the quiet notice, never the thread, for an id outside the viewer's scope", async () => {
    findFirst.mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(
      await EnquiryDetailPage({ params: Promise.resolve({ id: "nope" }) }),
    );
    expect(html).toContain("That enquiry isn");
    expect(html).toContain('href="/enquiries"');
    expect(html).not.toContain('data-testid="page"');
  });

  it("hands a visible enquiry to the page", async () => {
    findFirst.mockResolvedValueOnce({ id: "e1" });
    const html = renderToStaticMarkup(
      await EnquiryDetailPage({ params: Promise.resolve({ id: "e1" }) }),
    );
    expect(html).toContain('data-testid="page"');
    expect(html).toContain("Priya Kaur");
  });
});
