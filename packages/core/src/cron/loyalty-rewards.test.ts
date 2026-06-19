import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the loyalty-rewards cron job. Customers who have crossed the
 * active LoyaltyConfig reward threshold and have not yet been emailed a reward
 * get a `loyalty_reward` email. Idempotent via the loyalty_reward MessageLog.
 */

const configFindFirst = vi.fn();
const customerFindMany = vi.fn();
const messageCount = vi.fn();
const sendEmail = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    loyaltyConfig: { findFirst: (...a: unknown[]) => configFindFirst(...a) },
    customer: { findMany: (...a: unknown[]) => customerFindMany(...a) },
    messageLog: { count: (...a: unknown[]) => messageCount(...a) },
  },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { runLoyaltyRewards } = await import("./loyalty-rewards");

beforeEach(() => {
  configFindFirst.mockReset();
  customerFindMany.mockReset();
  messageCount.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ id: "m1", status: "sent" });
  configFindFirst.mockResolvedValue({
    rewardThreshold: 8,
    rewardDesc: "Free small tattoo",
    active: true,
  });
});

describe("runLoyaltyRewards", () => {
  it("emails customers who crossed the threshold with no prior reward", async () => {
    customerFindMany.mockResolvedValue([
      { id: "c1", name: "Ada", email: "ada@x.test", loyaltyStamps: 8, loyaltyTier: 4 },
    ]);
    messageCount.mockResolvedValue(0);
    const res = await runLoyaltyRewards();
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0] as {
      type: string;
      data: { rewardLabel: string; stamps: number };
    };
    expect(arg.type).toBe("loyalty_reward");
    expect(arg.data.rewardLabel).toBe("Free small tattoo");
    expect(arg.data.stamps).toBe(8);
    expect(res.sent).toBe(1);
  });

  it("is idempotent: skips customers already emailed a reward", async () => {
    customerFindMany.mockResolvedValue([
      { id: "c1", name: "Ada", email: "ada@x.test", loyaltyStamps: 8, loyaltyTier: 4 },
    ]);
    messageCount.mockResolvedValue(1);
    const res = await runLoyaltyRewards();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
  });

  it("no-ops when loyalty is unconfigured/inactive", async () => {
    configFindFirst.mockResolvedValue(null);
    const res = await runLoyaltyRewards();
    expect(customerFindMany).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
  });
});
