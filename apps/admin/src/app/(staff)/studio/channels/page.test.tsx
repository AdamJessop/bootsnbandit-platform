import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("./actions", () => ({ retryWebhookFailureAction: vi.fn() }));

const findFirst = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: { enquiryMessage: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

const listRecentWebhookFailures = vi.fn();
const countOpenWebhookFailures = vi.fn();
vi.mock("@bnb/core/services/webhook-failures", () => ({
  WEBHOOK_FAILURE_WINDOW_DAYS: 7,
  listRecentWebhookFailures: (...a: unknown[]) =>
    listRecentWebhookFailures(...a),
  countOpenWebhookFailures: (...a: unknown[]) => countOpenWebhookFailures(...a),
}));

const ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INBOUND_EMAIL_DOMAIN = "mail.bootsnbandit.test";
  process.env.RESEND_WEBHOOK_SECRET = "whsec_x";
  process.env.RESEND_API_KEY = "re_x";
  process.env.APP_ORIGIN = "https://admin.bootsnbandit.test";
  findFirst.mockResolvedValue({
    createdAt: new Date("2026-09-08T09:14:01.902Z"),
  });
  listRecentWebhookFailures.mockResolvedValue([]);
  countOpenWebhookFailures.mockResolvedValue(0);
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("ChannelsPage", () => {
  it("shows the inbound address pattern, the webhook URL and a healthy config", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Channels");
    expect(html).toContain("enq-&lt;token&gt;@mail.bootsnbandit.test");
    expect(html).toContain("enquiries@mail.bootsnbandit.test");
    expect(html).toContain(
      "https://admin.bootsnbandit.test/api/webhooks/resend",
    );
    expect(html).toContain("No failed events");
    expect(html).toContain("8 September 2026");
  });

  it("flags missing configuration instead of pretending email works", async () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    delete process.env.RESEND_WEBHOOK_SECRET;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("INBOUND_EMAIL_DOMAIN");
    expect(html).toContain("RESEND_WEBHOOK_SECRET");
    expect(html).toContain("Not set");
  });

  it("lists only open failed events, with a retry button", async () => {
    // listRecentWebhookFailures({ openOnly: true }) is the DB-level filter,
    // so a retried row is never in the fixture the panel renders from.
    countOpenWebhookFailures.mockResolvedValue(2);
    listRecentWebhookFailures.mockResolvedValue([
      {
        id: "wf1",
        provider: "resend",
        externalId: "9f1c2f7a",
        error: "Resend 500",
        createdAt: new Date("2026-09-08T09:20:00.000Z"),
        retriedAt: null,
      },
      {
        id: "wf2",
        provider: "resend",
        externalId: null,
        error: "Malformed JSON body",
        createdAt: new Date("2026-09-07T09:20:00.000Z"),
        retriedAt: null,
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(listRecentWebhookFailures).toHaveBeenCalledWith(
      expect.objectContaining({ openOnly: true }),
    );
    expect(html).toContain("2 failed events");
    expect(html).toContain("Resend 500");
    expect(html).toContain("9f1c2f7a");
    expect(html).toContain('value="wf1"');
    expect(html).toContain('value="wf2"');
    expect(html).toContain("Retry");
  });

  it("says so when no inbound email has ever arrived", async () => {
    findFirst.mockResolvedValue(null);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Nothing received yet");
  });
});
