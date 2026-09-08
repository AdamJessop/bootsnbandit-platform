import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildTimeline } from "./timeline-builder";

/**
 * The detail page is an async Server Component. Its timeline assembly is the
 * pure buildTimeline transform, asserted here and in timeline-builder.test.ts.
 * The one thing that cannot be asserted purely is the VISIBILITY of the rows
 * it is given, so that part renders the page against a stand-in prisma that
 * actually applies the `where` it is handed — a page that stopped scoping its
 * enquiries would return both rows and fail below.
 */
describe("CustomerDetailPage timeline", () => {
  it("produces an empty stream for a customer with no history", () => {
    expect(
      buildTimeline({
        enquiries: [],
        bookings: [],
        sessions: [],
        messages: [],
        loyalty: { stamps: 0, tier: 0 },
      }),
    ).toEqual([]);
  });
});

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("./actions", () => ({
  linkIdentityAction: vi.fn(),
  loadLinkableIdentitiesAction: vi.fn(),
  saveCustomerNotes: vi.fn(),
  sendManualEmail: vi.fn(),
}));

const findFirst = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: { customer: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

const { requireRole } = await import("@bnb/core/auth");

/** An enquiry belonging to `mine`, and one belonging to another artist. */
const ENQUIRIES = [
  {
    id: "e-mine",
    createdAt: new Date("2026-09-02T10:00:00.000Z"),
    style: "fine line",
    status: "new" as const,
    preferredArtistId: "art-mine",
  },
  {
    id: "e-theirs",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    style: "traditional",
    status: "new" as const,
    preferredArtistId: "art-theirs",
  },
];

/**
 * Enough of a Prisma to prove the point: it applies the `where` the page put
 * on its `enquiries` include, in the exact shape `visibleEnquiryWhere`
 * produces. No `where` at all means no filtering — which is the regression.
 */
function matches(
  row: { preferredArtistId: string | null },
  where: { OR?: { preferredArtistId: string | null }[] } | undefined,
): boolean {
  if (!where?.OR) return true;
  return where.OR.some((c) => c.preferredArtistId === row.preferredArtistId);
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockImplementation(
    (args: {
      include: { enquiries?: { where?: { OR?: { preferredArtistId: string | null }[] } } };
    }) => ({
      id: "c1",
      name: "Amy Rowe",
      email: "amy@example.test",
      phone: null,
      notes: null,
      marketingConsent: false,
      loyaltyStamps: 0,
      loyaltyTier: 0,
      enquiries: ENQUIRIES.filter((e) => matches(e, args.include.enquiries?.where)),
      bookings: [],
      messages: [],
      identities: [],
      enquiryMessages: [],
    }),
  );
});

describe("CustomerDetailPage enquiry visibility", () => {
  it("shows an artist only the enquiries they could open in the inbox", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u2",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "art-mine",
    } as never);

    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: "c1" }) }),
    );

    // The timeline links each enquiry into the inbox by id.
    expect(html).toContain("e-mine");
    // Another artist's lead is not on this record, and neither is its link.
    expect(html).not.toContain("e-theirs");
    expect(html).not.toContain("traditional");
  });

  it("shows an owner every enquiry on the record", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u1",
      email: "o@x",
      role: "OWNER",
      displayName: "Owner",
    } as never);

    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: "c1" }) }),
    );

    expect(html).toContain("e-mine");
    expect(html).toContain("e-theirs");
  });
});
