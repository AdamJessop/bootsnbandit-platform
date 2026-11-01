import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { connectionHealth } from "@bnb/core/services/channel-connections";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("./actions", () => ({ retryWebhookFailureAction: vi.fn() }));
vi.mock("./meta-actions", () => ({
  connectMetaAction: vi.fn(),
  disconnectMetaAction: vi.fn(),
}));
const listChannelConnections = vi.fn();
vi.mock("@bnb/core/services/channel-connections", async (importOriginal) => {
  // `connectionHealth` is pure and has no DB dependency — keep the real
  // implementation so the page renders its actual hint, and mock only the
  // one call that talks to Postgres.
  const actual =
    await importOriginal<typeof import("@bnb/core/services/channel-connections")>();
  return {
    ...actual,
    listChannelConnections: (...a: unknown[]) => listChannelConnections(...a),
  };
});

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
  listChannelConnections.mockResolvedValue([]);
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("ChannelsPage", () => {
  it("shows the inbound address pattern, the webhook URL and a healthy config", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({}));
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
    const html = renderToStaticMarkup(await Page({}));
    expect(html).toContain("INBOUND_EMAIL_DOMAIN");
    expect(html).toContain("RESEND_WEBHOOK_SECRET");
    expect(html).toContain("Not set");
    // The owner-facing row says it in plain words.
    expect(html).toContain("Customer replies can&#x27;t reach the inbox yet");
  });

  it("keeps env var names out of the owner's view, in collapsed Technical details", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Customer replies come back into the inbox");
    expect(html).toContain("Sending email works");
    // Every env var name (and the webhook URLs) lives inside a <details>
    // that is closed by default.
    const outside = html.replace(/<details[\s\S]*?<\/details>/g, "");
    for (const name of [
      "INBOUND_EMAIL_DOMAIN",
      "RESEND_WEBHOOK_SECRET",
      "RESEND_API_KEY",
      "META_APP_ID",
      "META_APP_SECRET",
      "META_VERIFY_TOKEN",
      "/api/webhooks/",
    ]) {
      expect(outside).not.toContain(name);
      expect(html).toContain(name);
    }
    expect(html).toContain("<summary");
    expect(html).toContain("Technical details");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
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
    const html = renderToStaticMarkup(await Page({}));
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
    const html = renderToStaticMarkup(await Page({}));
    expect(html).toContain("Nothing received yet");
  });
});

describe("ChannelsPage — Meta", () => {
  /**
   * Relative to now, not pinned to a date in 2026. `connectionHealth` starts
   * printing "Reconnect recommended" 30 days after the later of `connectedAt`
   * and `lastEventAt` — a fixed fixture is a suite that passes today and
   * fails, for no reason anyone changed, a month from now.
   */
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms);
  const CONNECTED_AT = ago(3 * DAY);
  const LAST_EVENT_AT = ago(2 * HOUR);
  const DATE = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

  const CONNECTIONS = [
    {
      id: "c1",
      channel: "messenger" as const,
      externalId: "102938475610293",
      pageId: "102938475610293",
      igAccountId: "17841400000000000",
      name: "Boots 'n' Bandit",
      active: true,
      webhookSubscribedAt: CONNECTED_AT,
      lastEventAt: LAST_EVENT_AT,
      connectedAt: CONNECTED_AT,
      tokenReadable: true,
    },
    {
      id: "c2",
      channel: "instagram" as const,
      externalId: "17841400000000000",
      pageId: "102938475610293",
      igAccountId: "17841400000000000",
      name: "Boots 'n' Bandit (@bootsnbandit)",
      active: true,
      webhookSubscribedAt: null,
      lastEventAt: null,
      connectedAt: CONNECTED_AT,
      tokenReadable: true,
    },
  ];

  function metaConfigured() {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
  }

  it("says Meta is not configured, and does not offer Connect", async () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_VERIFY_TOKEN;
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("META_APP_ID");
    expect(html).toContain("META_VERIFY_TOKEN");
    expect(html).toContain("docs/CHANNELS.md");
    expect(html).not.toContain("Connect a Facebook Page");
  });

  it("shows the webhook URL and a Connect button once configured", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("https://admin.bootsnbandit.test/api/webhooks/meta");
    expect(html).toContain("Connect a Facebook Page");
    expect(html).toContain("No Pages connected yet");
    // Never the values themselves.
    expect(html).not.toContain("1234567890");
  });

  it("lists each connection with its last event and subscription state", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    listChannelConnections.mockResolvedValue(CONNECTIONS);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Boots &#x27;n&#x27; Bandit");
    expect(html).toContain("Messenger");
    expect(html).toContain("Instagram");
    expect(html).toContain(DATE.format(LAST_EVENT_AT));
    expect(html).toContain(DATE.format(CONNECTED_AT));
    expect(html).toContain("Nothing received yet");
    expect(html).toContain("Not subscribed");
    // A page connected three days ago has nothing to be nagged about.
    expect(html).not.toContain("Reconnect recommended");
    expect(html).toContain("Disconnect");
    // Page id on every row, IG account id on the instagram row too.
    expect(html).toContain("102938475610293");
    expect(html).toContain("17841400000000000");
  });

  it("shows the flash from a finished connect", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const ok = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ meta_connected: "3" }) }),
    );
    expect(ok).toContain("Connected 3");
    const bad = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ meta_error: "bad_state" }) }),
    );
    expect(bad).toContain("could not be completed");
  });

  it("maps an unrecognised meta_error slug to a generic message, never the raw slug", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ meta_error: "some_unknown_slug" }),
      }),
    );
    expect(html).toContain(
      "Facebook returned an error while connecting — try again or check the app settings.",
    );
    expect(html).not.toContain("some_unknown_slug");
  });

  it("maps an unrecognised meta_warning slug to a generic message, never the raw slug", async () => {
    process.env.META_APP_ID = "1234567890";
    process.env.META_APP_SECRET = "synthetic";
    process.env.META_VERIFY_TOKEN = "synthetic";
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          meta_connected: "2",
          meta_warning: "some_unknown_warning",
        }),
      }),
    );
    expect(html).toContain(
      "The connection finished with a warning — check the list above.",
    );
    expect(html).not.toContain("some_unknown_warning");
  });

  it("flags a connection whose stored token can no longer be read", async () => {
    metaConfigured();
    listChannelConnections.mockResolvedValue([
      { ...CONNECTIONS[0], tokenReadable: false },
      CONNECTIONS[1],
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );
    // Otherwise the row is indistinguishable from a healthy one while every
    // message on it silently fails.
    expect(html).toContain("Reconnect required");
    expect(html).toContain("stored token can&#x27;t be read");
    // Only the affected row is flagged.
    expect(html.match(/Reconnect required/g)).toHaveLength(1);
  });

  it("explains a short SESSION_SECRET and a failed unsubscribe", async () => {
    metaConfigured();
    const { default: Page } = await import("./page");
    const short = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ meta_error: "session_secret" }),
      }),
    );
    expect(short).toContain("SESSION_SECRET must be at least 32 characters");

    // Disconnect redirects with a warning and NO connected count, so the
    // warning has to stand on its own.
    const unsub = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ meta_warning: "unsubscribe_failed" }),
      }),
    );
    expect(unsub).toContain("Facebook may still deliver");
  });

  it("lists failed events from both providers, naming which is which", async () => {
    countOpenWebhookFailures.mockResolvedValue(1);
    listRecentWebhookFailures.mockResolvedValue([
      {
        id: "wf1",
        provider: "meta",
        externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
        error: "Graph is down",
        createdAt: new Date("2026-09-08T09:00:00Z"),
        retriedAt: null,
      },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Graph is down");
    expect(html).toContain("meta");
    // No provider filter any more — the panel owns both channels.
    expect(listRecentWebhookFailures).toHaveBeenCalledWith({ openOnly: true });
    expect(countOpenWebhookFailures).toHaveBeenCalledWith();
  });
});

/**
 * The panel is an async Server Component; its new decision is the pure health
 * verdict it renders, asserted here at the same boundary as the rest of the
 * file.
 */
describe("Channels panel connection health", () => {
  it("warns about a connection that has gone quiet", () => {
    expect(
      connectionHealth({
        tokenReadable: true,
        lastEventAt: new Date(Date.now() - 40 * 86_400_000),
        connectedAt: new Date(Date.now() - 200 * 86_400_000),
      }).level,
    ).toBe("quiet");
  });

  it("says nothing about a live one", () => {
    expect(
      connectionHealth({
        tokenReadable: true,
        lastEventAt: new Date(),
        connectedAt: new Date(),
      }),
    ).toEqual({ level: "ok", message: null });
  });
});
