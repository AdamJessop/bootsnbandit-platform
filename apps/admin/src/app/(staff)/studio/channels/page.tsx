import { AlertTriangle, CheckCircle2, Mail, Inbox, XCircle } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
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

/**
 * Studio › Channels (owner-only). The operational view of the email channel:
 * what address customers reach us on, whether the two secrets are actually
 * configured, when we last received anything, and which inbound events failed
 * — with a one-click replay. Meta channels join this page in Phase 3.
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

export default async function ChannelsPage() {
  await requireRole("OWNER");

  const domain = inboundEmailDomain();
  const secretSet = Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim());
  const apiKeySet = Boolean(process.env.RESEND_API_KEY?.trim());
  const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const webhookUrl = `${origin || "https://<admin-origin>"}/api/webhooks/resend`;

  const [lastInbound, failures, openFailures] = await Promise.all([
    prisma.enquiryMessage.findFirst({
      where: { direction: "inbound", channel: "email" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    listRecentWebhookFailures({ provider: "resend" }),
    countOpenWebhookFailures({ provider: "resend" }),
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
                    {DATE.format(f.createdAt)}
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
