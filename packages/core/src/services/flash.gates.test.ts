import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the claimFlash gates that run before anything is reserved:
 * the drop's `endsAt` and the CMS `enquiriesOpen` switch. The DB-backed
 * happy paths live in flash.test.ts; here prisma is mocked so the refusals
 * are pinned without a database.
 */

const settingsFindFirst = vi.fn();
const flashFindUniqueOrThrow = vi.fn();
const flashUpdateMany = vi.fn();
const createEnquiry = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    siteSettings: { findFirst: (...a: unknown[]) => settingsFindFirst(...a) },
    flash: {
      findUniqueOrThrow: (...a: unknown[]) => flashFindUniqueOrThrow(...a),
      updateMany: (...a: unknown[]) => flashUpdateMany(...a),
    },
  },
}));
vi.mock("./enquiries", () => ({
  createEnquiry: (...a: unknown[]) => createEnquiry(...a),
}));

const {
  claimFlash,
  isFlashLive,
  FlashClaimsClosedError,
  FlashEndedError,
  FlashUnavailableError,
} = await import("./flash");

const NOW = new Date("2026-11-14T12:00:00Z");

function flash(over: Record<string, unknown> = {}) {
  return {
    id: "f1",
    title: "Pearl Shell",
    artistId: "a1",
    pricePence: 13000,
    total: 3,
    claimed: 0,
    status: "available",
    endsAt: null,
    ...over,
  };
}

beforeEach(() => {
  settingsFindFirst.mockReset();
  flashFindUniqueOrThrow.mockReset();
  flashUpdateMany.mockReset();
  createEnquiry.mockReset();
  settingsFindFirst.mockResolvedValue({ enquiriesOpen: true });
  createEnquiry.mockResolvedValue({ id: "e1", source: "flash" });
});

describe("isFlashLive", () => {
  it("is live with no end date or one still ahead", () => {
    expect(isFlashLive(null, NOW)).toBe(true);
    expect(isFlashLive(new Date("2026-11-14T12:00:01Z"), NOW)).toBe(true);
  });

  it("is over at and after the end time", () => {
    expect(isFlashLive(NOW, NOW)).toBe(false);
    expect(isFlashLive(new Date("2026-11-13T00:00:00Z"), NOW)).toBe(false);
  });
});

describe("claimFlash gates", () => {
  it("refuses a claim after the drop's endsAt, before reserving a copy", async () => {
    flashFindUniqueOrThrow.mockResolvedValue(
      flash({ endsAt: new Date("2026-11-14T11:59:00Z") }),
    );
    const claim = claimFlash({ flashId: "f1", contactName: "Late" }, NOW);
    await expect(claim).rejects.toBeInstanceOf(FlashEndedError);
    await expect(claim).rejects.toThrow(/drop has ended/);
    expect(flashUpdateMany).not.toHaveBeenCalled();
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a claim while the studio's enquiries switch is off", async () => {
    settingsFindFirst.mockResolvedValue({ enquiriesOpen: false });
    flashFindUniqueOrThrow.mockResolvedValue(flash());
    const claim = claimFlash({ flashId: "f1", contactName: "Keen" }, NOW);
    await expect(claim).rejects.toBeInstanceOf(FlashClaimsClosedError);
    await expect(claim).rejects.toThrow(/books are closed/);
    expect(flashUpdateMany).not.toHaveBeenCalled();
  });

  it("maps both refusals onto FlashUnavailableError (409 at the API)", () => {
    expect(new FlashEndedError()).toBeInstanceOf(FlashUnavailableError);
    expect(new FlashClaimsClosedError()).toBeInstanceOf(FlashUnavailableError);
  });

  it("claims a drop that ends in the future, guarding endsAt in the update", async () => {
    flashFindUniqueOrThrow
      .mockResolvedValueOnce(
        flash({ endsAt: new Date("2026-11-15T18:00:00Z") }),
      )
      .mockResolvedValueOnce(flash({ claimed: 1 }));
    flashUpdateMany.mockResolvedValue({ count: 1 });
    const res = await claimFlash(
      { flashId: "f1", contactName: "Phone Only", contactPhone: "07123456789" },
      NOW,
    );
    expect(res.enquiry.id).toBe("e1");
    const where = flashUpdateMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ endsAt: null }, { endsAt: { gt: NOW } }]);
    expect(createEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        contactEmail: null,
        contactPhone: "07123456789",
        source: "flash",
      }),
    );
  });

  it("still claims when there is no settings row (fresh install)", async () => {
    settingsFindFirst.mockResolvedValue(null);
    flashFindUniqueOrThrow
      .mockResolvedValueOnce(flash())
      .mockResolvedValueOnce(flash({ claimed: 1 }));
    flashUpdateMany.mockResolvedValue({ count: 1 });
    await expect(
      claimFlash({ flashId: "f1", contactName: "First" }, NOW),
    ).resolves.toBeDefined();
  });
});
