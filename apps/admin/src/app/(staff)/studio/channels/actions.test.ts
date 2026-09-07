import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retrying a stored webhook failure replays the exact event through the same
 * ingest path the live webhook uses. Owner-only, and never throws out of the
 * server action — a second failure is written back onto the row instead.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  getWebhookFailure: vi.fn(),
  markWebhookFailureRetried: vi.fn(),
  setWebhookFailureError: vi.fn(),
}));
vi.mock("@bnb/core/services/channels/email-inbound", () => ({
  ingestResendEvent: vi.fn(),
}));

const { requireRole } = await import("@bnb/core/auth");
const {
  getWebhookFailure,
  markWebhookFailureRetried,
  setWebhookFailureError,
} = await import("@bnb/core/services/webhook-failures");
const { ingestResendEvent } = await import(
  "@bnb/core/services/channels/email-inbound"
);
const { retryWebhookFailureAction } = await import("./actions");

const EVENT = { type: "email.received", data: { email_id: "abc" } };

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    email: "o@x",
    role: "OWNER",
    displayName: "Owner",
  } as never);
  vi.mocked(getWebhookFailure).mockResolvedValue({
    id: "wf1",
    provider: "resend",
    payload: EVENT,
  });
  vi.mocked(ingestResendEvent).mockResolvedValue({
    status: "recorded",
    enquiryId: "e1",
    messageId: "m1",
    createdEnquiry: false,
  });
});

describe("retryWebhookFailureAction", () => {
  it("requires an owner", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    await expect(retryWebhookFailureAction(form("wf1"))).rejects.toThrow();
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("replays the stored payload and marks the row retried", async () => {
    await retryWebhookFailureAction(form("wf1"));
    expect(ingestResendEvent).toHaveBeenCalledWith(EVENT);
    expect(markWebhookFailureRetried).toHaveBeenCalledWith("wf1");
    expect(setWebhookFailureError).not.toHaveBeenCalled();
  });

  it("records the new error and leaves the row open when the replay fails", async () => {
    vi.mocked(ingestResendEvent).mockRejectedValue(new Error("still broken"));
    await expect(retryWebhookFailureAction(form("wf1"))).resolves.toBeUndefined();
    expect(setWebhookFailureError).toHaveBeenCalledWith("wf1", "still broken");
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
  });

  it("does nothing for a missing row, a missing id or a foreign provider", async () => {
    await retryWebhookFailureAction(new FormData());
    vi.mocked(getWebhookFailure).mockResolvedValue(null);
    await retryWebhookFailureAction(form("gone"));
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf2",
      provider: "meta",
      payload: EVENT,
    });
    await retryWebhookFailureAction(form("wf2"));
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });
});
