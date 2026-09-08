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
vi.mock("@bnb/core/services/channels/meta-inbound", () => ({
  ingestMetaEvent: vi.fn(),
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
const { ingestMetaEvent } = await import(
  "@bnb/core/services/channels/meta-inbound"
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

  it("refuses to mark retried a payload that was never a replayable event", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf3",
      provider: "resend",
      payload: { raw: "not json" },
    });
    vi.mocked(ingestResendEvent).mockResolvedValue({
      status: "ignored",
      reason: "unsupported_event",
    });
    await retryWebhookFailureAction(form("wf3"));
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
    expect(setWebhookFailureError).toHaveBeenCalledWith(
      "wf3",
      expect.stringContaining("not a replayable"),
    );
  });
});

describe("retryWebhookFailureAction on a meta failure", () => {
  const STORED = {
    object: "page",
    entry: [
      {
        id: "102938475610293",
        time: 1788000000000,
        messaging: [
          {
            sender: { id: "7213456789012345" },
            recipient: { id: "102938475610293" },
            timestamp: 1788000000000,
            message: { mid: "m_AbC0dEf1GhI2jKl3MnO4pQ", text: "hiya" },
          },
        ],
      },
    ],
  };

  it("replays the stored event through the SAME ingest the webhook uses", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf1",
      provider: "meta",
      payload: STORED,
    });
    vi.mocked(ingestMetaEvent).mockResolvedValue({
      status: "recorded",
      direction: "inbound",
      enquiryId: "e1",
      messageId: "m1",
      createdEnquiry: false,
    } as never);

    const fd = new FormData();
    fd.set("id", "wf1");
    await retryWebhookFailureAction(fd);

    expect(ingestMetaEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ingestMetaEvent).mock.calls[0][0]).toMatchObject({
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      channel: "messenger",
    });
    expect(markWebhookFailureRetried).toHaveBeenCalledWith("wf1");
  });

  it("does not declare victory on a payload that holds no event", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf2",
      provider: "meta",
      payload: { raw: "not json at all" },
    });
    const fd = new FormData();
    fd.set("id", "wf2");
    await retryWebhookFailureAction(fd);

    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
    expect(setWebhookFailureError).toHaveBeenCalledWith(
      "wf2",
      expect.stringContaining("not a replayable Meta event"),
    );
  });

  it("writes the new error back when the replay fails again", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf3",
      provider: "meta",
      payload: STORED,
    });
    vi.mocked(ingestMetaEvent).mockRejectedValue(new Error("Graph is down"));
    const fd = new FormData();
    fd.set("id", "wf3");
    await retryWebhookFailureAction(fd);
    expect(setWebhookFailureError).toHaveBeenCalledWith("wf3", "Graph is down");
  });

  it("ignores a provider it does not know how to replay", async () => {
    vi.mocked(getWebhookFailure).mockResolvedValue({
      id: "wf4",
      provider: "stripe",
      payload: {},
    });
    const fd = new FormData();
    fd.set("id", "wf4");
    await retryWebhookFailureAction(fd);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(markWebhookFailureRetried).not.toHaveBeenCalled();
  });
});
