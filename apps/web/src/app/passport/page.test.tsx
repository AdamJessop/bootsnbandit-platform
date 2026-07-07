import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const requireCustomer = vi.fn();
vi.mock("@/lib/customer-auth", () => ({
  requireCustomer: (...a: unknown[]) => requireCustomer(...a),
}));

const customerFindUnique = vi.fn();
const bookingFindMany = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: {
    customer: { findUnique: (...a: unknown[]) => customerFindUnique(...a) },
    booking: { findMany: (...a: unknown[]) => bookingFindMany(...a) },
  },
}));

vi.mock("../_data", () => ({
  getLoyaltyConfig: vi.fn(async () => ({
    name: "Bandit Pass",
    rewardThreshold: 8,
    rewardDesc: "Free small tattoo.",
    perks: [
      { stamps: 2, title: "Birthday treat", desc: "10% off." },
      { stamps: 8, title: "Free small tattoo", desc: "On the house." },
    ],
  })),
}));

vi.mock("./actions", () => ({ requestCancellationAction: vi.fn() }));
vi.mock("@/app/account/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("./passport.module.css", () => ({ default: {} }));

const SESSION = { sub: "cust_1", email: "c@example.com", name: "A. Collector" };

beforeEach(() => {
  vi.clearAllMocks();
  requireCustomer.mockResolvedValue(SESSION);
  customerFindUnique.mockResolvedValue({
    id: "cust_1",
    name: "A. Collector",
    loyaltyStamps: 4,
    loyaltyTier: 2,
    createdAt: new Date("2024-01-05T00:00:00.000Z"),
  });
  bookingFindMany.mockResolvedValue([
    {
      id: "up1",
      style: "Ornamental snake",
      type: "session",
      status: "confirmed",
      start: new Date("2099-08-01T11:00:00.000Z"),
      cancelRequestedAt: null,
      artist: { name: "Sarah" },
    },
    {
      id: "past1",
      style: "Blackwork moth",
      type: "session",
      status: "completed",
      start: new Date("2024-03-01T11:00:00.000Z"),
      cancelRequestedAt: null,
      artist: { name: "Calum" },
    },
  ]);
});

describe("PassportPage (gated)", () => {
  it("gates on requireCustomer", async () => {
    const { default: PassportPage } = await import("./page");
    await PassportPage();
    expect(requireCustomer).toHaveBeenCalled();
  });

  it("renders the signed-in customer's real loyalty data and bookings", async () => {
    const { default: PassportPage } = await import("./page");
    const html = renderToStaticMarkup(await PassportPage());
    // Real card data, not the old sample constants.
    expect(html).toContain("A. Collector");
    expect(html).toContain("4/8");
    expect(html).not.toContain("Level 2 · Outlaw"); // old hardcoded sample
    // Loyalty ladder from config.
    expect(html).toContain("Birthday treat");
    // Bookings split.
    expect(html).toContain("Ornamental snake");
    expect(html).toContain("Blackwork moth");
    // Sign out control present.
    expect(html).toContain("Sign out");
  });
});
