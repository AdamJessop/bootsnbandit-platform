# Channels — inbound and outbound email

The enquiry inbox is two-way on email: replies from customers land back on the
same enquiry thread, and staff replies go out wearing the assigned artist's
name. This is the setup and operations runbook. The live status view is
**Studio › Channels** (owner-only) in the admin app.

Facebook Messenger and Instagram are Phase 3 and are not covered here.

## How it works

1. A staff reply is sent by Resend as
   `"Sarah at Boots 'n' Bandit" <enquiries@<INBOUND_EMAIL_DOMAIN>>` with
   `Reply-To: enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>` and the `In-Reply-To` /
   `References` of the last inbound message.
2. The customer hits reply. Their mail client uses the Reply-To, so the message
   arrives addressed to that enquiry's own token.
3. Resend receives it (the domain's MX points at Resend) and POSTs an
   `email.received` event to `https://<admin-origin>/api/webhooks/resend`,
   signed with `RESEND_WEBHOOK_SECRET`.
4. Admin verifies the signature, fetches the full email from the Resend API,
   strips the quoted history, resolves the customer and the enquiry from the
   token, and records an inbound message with its attachments.

An email that arrives **without** a token (someone mailing the studio address
directly) still lands: the sender's address resolves to a customer, and the
Phase-1 threading rule attaches it to their most recent open enquiry from the
last 30 days, or opens a new one.

## One-time setup

### 1. Choose the domain

Use a dedicated subdomain, not the apex — `mail.bootsnbandit.co.uk`. Its MX
record points at Resend, which you do not want to do to the domain that
receives your normal business mail.

### 2. Verify the domain in Resend

1. Resend dashboard → **Domains** → **Add Domain** → enter the subdomain,
   pick the region closest to the studio (`eu-west-1`).
2. Enable **Receiving** for the domain (the capability that adds the inbound
   MX record).
3. Add every DNS record Resend lists at your DNS provider:
   - **DKIM** (CNAME or TXT) — outbound signing.
   - **SPF** (TXT, and an MX for the return path) — outbound.
   - **Receiving** (MX, priority 10) — this is the inbound one. Without it,
     replies bounce.
4. Wait for the dashboard to show the domain **verified** and receiving
   **enabled**. DNS propagation is usually minutes, occasionally hours.

### 3. Create the webhook

1. Resend dashboard → **Webhooks** → **Add Webhook**.
2. Endpoint: `https://<admin-origin>/api/webhooks/resend`
   (Studio › Channels prints the exact URL for the deployed environment.)
3. Events: **`email.received`** only. The delivery/bounce events are not
   consumed and would just create noise.
4. Copy the **signing secret** (`whsec_…`). It is shown once.

### 4. Set the secrets

In Coolify, on the compose resource's Environment Variables:

| Var                     | Set on         | Value                                                                      |
| ----------------------- | -------------- | -------------------------------------------------------------------------- |
| `INBOUND_EMAIL_DOMAIN`  | admin **and web** | the verified subdomain, e.g. `mail.bootsnbandit.co.uk` (no `@`, no scheme) |
| `RESEND_WEBHOOK_SECRET` | admin only     | the `whsec_…` signing secret from step 3                                   |

The web app never *receives* mail — the webhook lives on admin — but it sends
the enquiry acknowledgement, and that ack needs the same
`Reply-To: enq-<token>@<domain>` a staff reply gets. Without the var on web, a
customer replying to their acknowledgement mails `EMAIL_FROM`, which has no
inbound MX, and the reply is lost. Reception neither sends nor receives
enquiry mail and needs neither var.

`RESEND_API_KEY` must also be set: inbound bodies and attachments are fetched
from the Resend API with it, so inbound email does not work without it.

Redeploy, then open **Studio › Channels** and confirm all three rows are green.

### 5. Smoke test

1. From a personal mailbox, send a message to
   `enq-anything@<INBOUND_EMAIL_DOMAIN>` — no such token exists, so it should
   create a **new** enquiry from your address.
2. Open it in the admin inbox and reply. Check the received mail shows the
   artist's name on the From line and a `enq-<token>@…` Reply-To.
3. Reply from your mail client. Within seconds the same enquiry should show
   your reply as an inbound bubble and flip to **Customer replied**.
4. Attach a photo and repeat: the image renders inline in the thread; a PDF
   shows as a download link.

## Operations

### Failed events

Studio › Channels lists inbound events that were correctly signed but could
not be processed (a Resend API blip, a database error). The endpoint always
answers `200` for these — returning `5xx` makes Resend retry the same broken
event in a loop — and stores the whole event so it can be replayed.

**Retry** replays the stored event through exactly the same code path as a live
delivery, and is safe to press repeatedly: processing is idempotent on the
Resend email id, so an event that did land is a no-op.

If a retry fails again, the row keeps the newest error message. Common causes:

| Error                              | Cause                                                |
| ---------------------------------- | ---------------------------------------------------- |
| `RESEND_API_KEY is not configured` | the key is missing on the admin service              |
| `Resend inbound fetch failed …`    | the API key lacks access, or Resend was down         |
| `has an unparseable From header`   | genuinely malformed mail; nothing to do              |
| `Malformed JSON body …`            | a signed request whose body was not JSON — report it |

### What is deliberately dropped

- **Auto-replies and bulk mail** (`Auto-Submitted`, `Precedence: bulk`,
  `X-Autoreply`) — an out-of-office is not the customer replying, and would
  otherwise flip the thread to _Customer replied_ and badge the inbox.
- **Mail from our own send domain** — loops, forwards and mailer-daemons.
- **Anything but `email.received`** — other event types are ignored, not failed.

### Attachments

Images up to 8 MB are copied into Postgres and served by the staff-gated
`/api/attachments/[id]`; the stored mime is the one sniffed from the actual
bytes, never the sender's declared `Content-Type`. Everything else (and any
image that fails the sniff) is stored as a **link to Resend's download URL**,
which **expires** — an old thread's PDF link will eventually 404. Anything that
must be kept should be downloaded and attached to the booking at the time.

### Rotating the signing secret

Create a second webhook endpoint in Resend pointing at the same URL, set
`RESEND_WEBHOOK_SECRET` to the new secret, redeploy, confirm inbound still
arrives, then delete the old endpoint. (Resend can send both signatures during
an overlap; the verifier accepts any matching `v1,` entry in the header.)

### Testing the endpoint by hand

Signed requests only. From a checkout with the secret to hand:

```bash
SECRET='whsec_…'
BODY='{"type":"email.received","data":{"email_id":"<a real Resend email id>"}}'
node -e '
const {createHmac}=require("node:crypto");
const [secret,body]=process.argv.slice(1);
const id="msg_manual", ts=Math.floor(Date.now()/1000);
const key=Buffer.from(secret.replace(/^whsec_/,""),"base64");
const sig=createHmac("sha256",key).update(`${id}.${ts}.${body}`).digest("base64");
console.log(`${id} ${ts} v1,${sig}`);
' "$SECRET" "$BODY"
# → paste the three values into:
curl -i -X POST https://<admin-origin>/api/webhooks/resend \
  -H 'content-type: application/json' \
  -H 'svix-id: msg_manual' -H 'svix-timestamp: <ts>' -H 'svix-signature: v1,<sig>' \
  -d "$BODY"
```

Expected: `200` with `{"ok":true,"status":"recorded"|"duplicate"|"ignored",…}`.
`401` means the signature, the secret or the clock is wrong (the timestamp
tolerance is five minutes). `503` means `RESEND_WEBHOOK_SECRET` is unset.

## Local development

Inbound needs a public URL, so either point a tunnel (`cloudflared`, `ngrok`)
at `http://localhost:3001` and register that as a second Resend webhook, or
skip inbound locally and exercise `ingestResendEvent` through its test suite.
Outbound works locally with `RESEND_API_KEY` unset — sends are logged, not
delivered, and still appear on the thread.
