import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * sendEmail must:
 *  - never throw when RESEND_API_KEY is absent
 *  - return status 'skipped' in log-only mode
 *  - ALWAYS write a MessageLog row (mocked here)
 *  - map our public `skipped` status to the DB `logged` enum value
 */

const createMock = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    messageLog: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

const recordOutbound = vi.hoisted(() => vi.fn(async () => ({ id: "em_1" })));
vi.mock("@bnb/core/services/enquiry-messages", () => ({ recordOutbound }));

const resendSend = vi.hoisted(() =>
  vi.fn(async () => ({ data: { id: "re_123" }, error: null })),
);
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

describe("sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockImplementation(
      async ({ data }: { data: { id?: string } }) => ({
        id: data.id ?? "log_test",
        ...data,
      }),
    );
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns 'skipped' and writes a MessageLog when no API key is set", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");

    const result = await sendEmail({
      to: "ada@example.com",
      type: "confirmation",
      customerId: "cust_1",
      relatedBookingId: "book_1",
      data: { customerName: "Ada", artistName: "Marnie", date: "Sat 5 Jul" },
    });

    expect(result.status).toBe("skipped");
    expect(result.id).toBeTruthy();

    expect(createMock).toHaveBeenCalledOnce();
    const arg = createMock.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.customerId).toBe("cust_1");
    expect(arg.data.relatedBookingId).toBe("book_1");
    expect(arg.data.type).toBe("confirmation");
    expect(arg.data.channel).toBe("email");
    expect(arg.data.subject).toBeTruthy();
    expect(arg.data.body).toContain("<html");
    // public 'skipped' maps to DB enum 'logged'
    expect(arg.data.status).toBe("logged");
    expect(arg.data.sentAt).toBeNull();
  });

  it("treats an empty-string API key as absent (skipped, never throws)", async () => {
    process.env.RESEND_API_KEY = "";
    const { sendEmail } = await import("./index");

    const result = await sendEmail({
      to: "ada@example.com",
      type: "enquiry_ack",
      data: { customerName: "Ada", subjectIdea: "Floral piece" },
    });

    expect(result.status).toBe("skipped");
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("does not throw even when the MessageLog write fails", async () => {
    delete process.env.RESEND_API_KEY;
    createMock.mockRejectedValueOnce(new Error("db down"));
    const { sendEmail } = await import("./index");

    await expect(
      sendEmail({
        to: "ada@example.com",
        type: "reminder",
        data: { customerName: "Ada", artistName: "Cal", date: "Tomorrow" },
      }),
    ).resolves.toMatchObject({ status: expect.any(String) });
  });

  it("sends staff_reply like any other type, including the MessageLog write", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");

    const result = await sendEmail({
      to: "ada@example.com",
      type: "staff_reply",
      customerId: "cust_1",
      data: {
        customerName: "Ada",
        subject: "About your snake design",
        body: "First line.\n\nSecond paragraph.",
      },
    });

    expect(result.status).toBe("skipped");
    expect(createMock).toHaveBeenCalledOnce();
    const arg = createMock.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.type).toBe("staff_reply");
    expect(arg.data.customerId).toBe("cust_1");
    expect(arg.data.subject).toBe("About your snake design");
    expect(arg.data.body).toContain("First line.");
    expect(arg.data.body).toContain("Second paragraph.");
  });

  it("renders the correct template body for the given type", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");

    await sendEmail({
      to: "ada@example.com",
      type: "receipt",
      data: {
        customerName: "Ada",
        amountPence: 12500,
        bankRef: "BNB-1042",
        lineItems: [{ label: "Session", amountPence: 12500 }],
      },
    });

    const arg = createMock.mock.calls[0][0] as { data: { body: string } };
    expect(arg.data.body).toContain("£125.00");
    expect(arg.data.body).toContain("BNB-1042");
  });
});

describe("sendEmail enquiry threading", () => {
  it("records an outbound email message when an enquiryId is given", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");
    recordOutbound.mockClear();
    await sendEmail({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      enquiryId: "e1",
      authorUserId: "u1",
      data: { customerName: "Amy", body: "Tuesday works!" },
    });
    expect(recordOutbound).toHaveBeenCalledTimes(1);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      enquiryId: "e1",
      customerId: "c1",
      channel: "email",
      deliveryStatus: "logged",
      fromAddress: "amy@example.com",
      // The staff member who sent it — otherwise the thread shows no author.
      authorUserId: "u1",
      // Nothing left the building, so there is no provider id to thread on.
      externalId: null,
    });
  });

  it("stores the provider message id as the outbound externalId when sent", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    recordOutbound.mockClear();
    resendSend.mockClear();
    try {
      const { sendEmail } = await import("./index");
      await sendEmail({
        to: "amy@example.com",
        type: "staff_reply",
        enquiryId: "e1",
        data: { customerName: "Amy", body: "Tuesday works!" },
      });
    } finally {
      delete process.env.RESEND_API_KEY;
    }
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      externalId: "re_123",
      deliveryStatus: "sent",
    });
  });

  it("records no author for an automatic (unattributed) email", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");
    recordOutbound.mockClear();
    await sendEmail({
      to: "amy@example.com",
      type: "enquiry_ack",
      enquiryId: "e1",
      data: { customerName: "Amy", subjectIdea: "Snake" },
    });
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      authorUserId: null,
    });
  });

  it("records nothing when no enquiryId is given", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("./index");
    recordOutbound.mockClear();
    await sendEmail({
      to: "amy@example.com",
      type: "reminder",
      data: { customerName: "Amy" },
    });
    expect(recordOutbound).not.toHaveBeenCalled();
  });
});
