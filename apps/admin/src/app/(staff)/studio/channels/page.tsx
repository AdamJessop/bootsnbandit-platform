import { AlertTriangle, CheckCircle2, Mail, Inbox, XCircle } from "lucide-react";
// lucide-react dropped brand/social-logo icons a while back — there is no
// Facebook or Instagram glyph in this dependency's icon set — so Messenger
// and Instagram are represented with generic chat/photo icons instead.
import { Camera, Link2, MessageCircle } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { listChannelConnections } from "@bnb/core/services/channel-connections";
import {
  inboundEmailDomain,
  outboundAddressFor,
} from "@bnb/core/services/channels/email-format";
import {
  countOpenWebhookFailures,
  listRecentWebhookFailures,
  WEBHOOK_FAILURE_WINDOW_DAYS,
} from "@bnb/core/services/webhook-failures";
import { retryWebhookFailureAction } from "./actions";
import { connectMetaAction, disconnectMetaAction } from "./meta-actions";

/**
 * Studio › Channels (owner-only). The operational view of the channels
 * customers reach us on: email, Messenger and Instagram — whether each is
 * configured, when we last received anything, and which inbound events
 * failed — with a one-click replay.
 *
 * Setup steps live in docs/CHANNELS.md; this page only reports state.
 */
export const dynamic = "force-dynamic";

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-bb-teal" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-bb-gold" />
      )}
      <span className="text-text-secondary">{children}</span>
    </span>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/London",
});

// The OAuth callback can echo back ANY slug matching `[a-z_]{1,40}` — Facebook's
// own `error` value passes through unedited when it happens to fit that shape
// (see api/meta/oauth/callback/route.ts). Only these known slugs get their own
// sentence; anything else — however innocuous-looking — falls through to the
// generic message below rather than ever being printed verbatim.
const META_FLASH: Record<string, string> = {
  not_configured:
    "Meta is not configured — set META_APP_ID, META_APP_SECRET and META_VERIFY_TOKEN.",
  bad_state: "That connection attempt could not be completed — start again.",
  no_code: "That connection attempt could not be completed — start again.",
  no_pages:
    "Connected, but no Facebook Pages were available to add — check the account manages at least one Page, then try again.",
  access_denied: "The connection was cancelled at Facebook.",
  exchange_failed:
    "Facebook rejected the connection — check the app's redirect URI, then try again.",
};
const META_ERROR_FALLBACK =
  "Facebook returned an error while connecting — try again or check the app settings.";

const META_WARNING_FLASH: Record<string, string> = {
  subscribe_failed:
    "One or more Pages could not be subscribed to the webhook — press Connect again.",
};
const META_WARNING_FALLBACK =
  "The connection finished with a warning — check the list above.";

export default async function ChannelsPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireRole("OWNER");
  const flash = await searchParams;
  const one = (key: string): string | null => {
    const value = flash[key];
    return typeof value === "string" ? value : null;
  };

  const domain = inboundEmailDomain();
  const secretSet = Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim());
  const apiKeySet = Boolean(process.env.RESEND_API_KEY?.trim());
  const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const webhookUrl = `${origin || "https://<admin-origin>"}/api/webhooks/resend`;

  const metaAppId = Boolean(process.env.META_APP_ID?.trim());
  const metaSecret = Boolean(process.env.META_APP_SECRET?.trim());
  const metaVerify = Boolean(process.env.META_VERIFY_TOKEN?.trim());
  const metaConfigured = metaAppId && metaSecret && metaVerify;
  const metaWebhookUrl = `${origin || "https://<admin-origin>"}/api/webhooks/meta`;

  const [lastInbound, failures, openFailures, connections] = await Promise.all([
    prisma.enquiryMessage.findFirst({
      where: { direction: "inbound", channel: "email" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    listRecentWebhookFailures({ openOnly: true }),
    countOpenWebhookFailures(),
    listChannelConnections(),
  ]);

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Channels
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        How customers reach the inbox, and whether it is working. Setup steps
        are in <code>docs/CHANNELS.md</code>.
      </p>

      <section className="mb-8 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Mail className="h-4 w-4" /> Email (Resend)
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-text-muted">Inbound address</dt>
          <dd className="text-text-secondary">
            {domain ? (
              <code className="break-all">{`enq-<token>@${domain}`}</code>
            ) : (
              <span className="text-text-muted">
                Not set — every reply lands nowhere.
              </span>
            )}
          </dd>

          <dt className="text-text-muted">Replies sent from</dt>
          <dd className="text-text-secondary">
            {domain ? (
              <code className="break-all">{outboundAddressFor(domain)}</code>
            ) : (
              <span className="text-text-muted">
                The default studio address (no reply token).
              </span>
            )}
          </dd>

          <dt className="text-text-muted">Webhook URL</dt>
          <dd className="text-text-secondary">
            <code className="break-all">{webhookUrl}</code>
          </dd>

          <dt className="text-text-muted">Last inbound email</dt>
          <dd className="text-text-secondary">
            {lastInbound ? (
              DATE.format(lastInbound.createdAt)
            ) : (
              <span className="text-text-muted">Nothing received yet.</span>
            )}
          </dd>
        </dl>

        <ul className="mt-4 space-y-2 border-t border-border-default pt-4">
          <li>
            <Status ok={Boolean(domain)}>
              <code>INBOUND_EMAIL_DOMAIN</code>{" "}
              {domain ? `= ${domain}` : "— Not set"}
            </Status>
          </li>
          <li>
            <Status ok={secretSet}>
              <code>RESEND_WEBHOOK_SECRET</code>{" "}
              {secretSet
                ? "— set (inbound deliveries are verified)"
                : "— Not set; the webhook answers 503"}
            </Status>
          </li>
          <li>
            <Status ok={apiKeySet}>
              <code>RESEND_API_KEY</code>{" "}
              {apiKeySet
                ? "— set (inbound bodies and outbound sends work)"
                : "— Not set; inbound bodies cannot be fetched"}
            </Status>
          </li>
        </ul>
      </section>

      <section className="mb-8 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <MessageCircle className="h-4 w-4" /> Messenger &amp; Instagram (Meta)
        </h2>

        {one("meta_connected") ? (
          <p className="mb-3 text-sm text-bb-teal">
            Connected {one("meta_connected")} destination
            {one("meta_connected") === "1" ? "" : "s"}.
            {one("meta_warning")
              ? ` ${META_WARNING_FLASH[one("meta_warning") ?? ""] ?? META_WARNING_FALLBACK}`
              : ""}
          </p>
        ) : null}
        {one("meta_error") ? (
          <p className="mb-3 text-sm text-bb-gold">
            {META_FLASH[one("meta_error") ?? ""] ?? META_ERROR_FALLBACK}
          </p>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-text-muted">Webhook URL</dt>
          <dd className="text-text-secondary">
            <code className="break-all">{metaWebhookUrl}</code>
          </dd>
          <dt className="text-text-muted">Subscribed fields</dt>
          <dd className="text-text-secondary">
            <code>messages, message_echoes, messaging_postbacks</code>
          </dd>
        </dl>

        <ul className="mt-4 space-y-2 border-t border-border-default pt-4">
          <li>
            <Status ok={metaAppId}>
              <code>META_APP_ID</code> {metaAppId ? "— set" : "— Not set"}
            </Status>
          </li>
          <li>
            <Status ok={metaSecret}>
              <code>META_APP_SECRET</code>{" "}
              {metaSecret
                ? "— set (inbound deliveries are verified)"
                : "— Not set; the webhook answers 503"}
            </Status>
          </li>
          <li>
            <Status ok={metaVerify}>
              <code>META_VERIFY_TOKEN</code>{" "}
              {metaVerify
                ? "— set (the subscription handshake works)"
                : "— Not set; Meta cannot verify the webhook"}
            </Status>
          </li>
        </ul>

        {metaConfigured ? (
          <>
            {connections.length > 0 ? (
              <ul className="mt-4 divide-y divide-border-default border-t border-border-default">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-text-primary">
                        {c.channel === "instagram" ? (
                          <Camera className="h-4 w-4" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {c.channel === "instagram" ? "Instagram" : "Messenger"} ·
                        Connected {DATE.format(c.connectedAt)} ·{" "}
                        {c.webhookSubscribedAt ? "Subscribed" : "Not subscribed"}{" "}
                        · Last event received{" "}
                        {c.lastEventAt
                          ? DATE.format(c.lastEventAt)
                          : "— Nothing received yet"}
                      </span>
                    </span>
                    <form action={disconnectMetaAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center rounded-md border border-border-default px-3 text-sm text-text-secondary transition-colors hover:border-bb-crimson/50"
                      >
                        Disconnect
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-text-muted">
                No Pages connected yet.
              </p>
            )}

            <form action={connectMetaAction} className="mt-4">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border-default px-4 text-sm text-text-secondary transition-colors hover:border-bb-teal/50"
              >
                <Link2 className="h-4 w-4" /> Connect a Facebook Page
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Not configured. Create the Meta app and set the three variables
            first — the steps are in <code>docs/CHANNELS.md</code>.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Inbox className="h-4 w-4" /> Failed events
        </h2>
        <p className="mb-3 flex items-center gap-2 text-sm">
          {openFailures > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 text-bb-gold" />
              <span className="text-text-secondary">
                {openFailures} failed events in the last{" "}
                {WEBHOOK_FAILURE_WINDOW_DAYS} days — fix the cause, then retry.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-bb-teal" />
              <span className="text-text-secondary">
                No failed events in the last {WEBHOOK_FAILURE_WINDOW_DAYS} days.
              </span>
            </>
          )}
        </p>

        {failures.length > 0 ? (
          <ul className="divide-y divide-border-default">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-text-secondary">{f.error}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {f.provider} · {DATE.format(f.createdAt)}
                    {f.externalId ? ` · ${f.externalId}` : ""}
                    {f.retriedAt ? ` · Retried ${DATE.format(f.retriedAt)}` : ""}
                  </span>
                </span>
                <form action={retryWebhookFailureAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md border border-border-default px-3 text-sm text-text-secondary transition-colors hover:border-bb-crimson/50"
                  >
                    Retry
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
