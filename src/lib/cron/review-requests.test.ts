import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the review-requests cron job. Sessions whose `reviewRequestAt`
 * has passed and which have no prior `review_request` MessageLog get a Review
 * row + a review_request email. Idempotent via the MessageLog dedupe.
 */

const sessionFindMany = vi.fn();
const messageCount = vi.fn();
const reviewCreate = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    session: { findMany: (...a: unknown[]) => sessionFindMany(...a) },
    messageLog: { count: (...a: unknown[]) => messageCount(...a) },
    review: { create: (...a: unknown[]) => reviewCreate(...a) },
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { runReviewRequests } = await import("./review-requests");

function session(id: string) {
  return {
    id,
    reviewRequestAt: new Date(Date.now() - 3600_000),
    booking: {
      id: `bk-${id}`,
      customerId: `c-${id}`,
      customer: { name: "Ada Lovelace", email: "ada@x.test" },
      artist: { name: "Marnie" },
    },
  };
}

beforeEach(() => {
  sessionFindMany.mockReset();
  messageCount.mockReset();
  reviewCreate.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ id: "m1", status: "sent" });
  reviewCreate.mockResolvedValue({ id: "r1", token: "tok" });
});

describe("runReviewRequests", () => {
  it("creates a pending Review and emails the request when due", async () => {
    sessionFindMany.mockResolvedValue([session("s1")]);
    messageCount.mockResolvedValue(0);
    const res = await runReviewRequests();

    expect(reviewCreate).toHaveBeenCalledOnce();
    const created = reviewCreate.mock.calls[0][0] as {
      data: { status: string; bookingId: string; token: string };
    };
    expect(created.data.status).toBe("pending");
    expect(created.data.bookingId).toBe("bk-s1");
    expect(created.data.token).toBeTruthy();

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0] as {
      type: string;
      data: { reviewToken: string };
    };
    expect(arg.type).toBe("review_request");
    expect(arg.data.reviewToken).toBe("tok");
    expect(res.sent).toBe(1);
  });

  it("is idempotent: skips sessions that already have a review_request", async () => {
    sessionFindMany.mockResolvedValue([session("s1")]);
    messageCount.mockResolvedValue(1);
    const res = await runReviewRequests();
    expect(reviewCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
  });
});
