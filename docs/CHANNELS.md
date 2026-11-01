# Channels — email, Messenger and Instagram

The enquiry inbox is two-way on email: replies from customers land back on the
same enquiry thread, and staff replies go out wearing the assigned artist's
name. This is the setup and operations runbook. The live status view is
**Studio › Channels** (owner-only) in the admin app.

Facebook Messenger and Instagram are covered in **[Meta channels](#meta-channels-messenger--instagram)** below.

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

**Owner alerts.** Every brand-new enquiry — web form, flash claim, Inkling,
or an email / Messenger / Instagram message that opens a new thread (never a
reply on an open one) — emails each active OWNER a short alert with a button
to `${ADMIN_ORIGIN}/enquiries/<id>`. It goes to the owner's own `User.email`;
any owner address on `INBOUND_EMAIL_DOMAIN` or the `EMAIL_FROM` host is
skipped, because mail to the studio domain lands back in this inbox. So an
owner signed in as `studio@<domain>` gets no alert until their staff account
uses a personal address. The send is fire-and-forget and logged to MessageLog
as `enquiry_alert` with no customer attached.

`RESEND_API_KEY` must also be set: inbound bodies and attachments are fetched
from the Resend API with it, so inbound email does not work without it.

`INBOUND_EMAIL_DOMAIN` must be a bare hostname — no `@`, no scheme, no path. An
invalid value is treated as unset (one warning logged, not a crash), so a typo
here silently turns inbound email off rather than failing loudly.

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

Failed events older than 90 days are pruned automatically by the hourly cron
(`WEBHOOK_FAILURE_RETENTION_DAYS`) — nothing to delete by hand.

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

### Sender verification

Inbound mail's DMARC/SPF+DKIM verdict is recorded per message and shown on the
thread as an **"Unverified sender"** badge when it fails — a label for staff
attention, never a filter; a failed check does not stop the message landing.

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

---

# Meta channels (Messenger + Instagram)

Messenger and Instagram DMs land on the same enquiry threads as email, and
staff reply to them from the same composer. Everything is **off until three
environment variables are set** — the webhook answers `503`, Studio › Channels
says "not configured", and replies quietly fall back to email.

## How it works

1. A customer messages the studio's Facebook Page or Instagram account.
2. Meta POSTs the event to `https://<admin-origin>/api/webhooks/meta`, signed
   `X-Hub-Signature-256: sha256=<HMAC-SHA256 of the raw body with META_APP_SECRET>`.
3. Admin verifies the signature, matches `entry[].id` to a connected Page or
   IG account, resolves the sender's PSID/IGSID to a `CustomerIdentity`
   (fetching their display name from Graph the first time), threads the message
   with the same 30-day rule email uses, and records it.
4. A staff reply goes back out through `POST /{page-id}/messages` with the
   Page's stored (encrypted) access token.
5. If a staff member replies from Meta's own inbox instead, the echo comes back
   on the `message_echoes` field and is recorded on the thread as an outbound
   message from "Meta inbox", so the admin thread stays complete.

**The 24-hour rule.** Meta only permits a business to message a person within
24 hours of that person's last message. Past it the composer refuses with
*"Messenger/Instagram only allows replies within 24 hours of the customer's
last message — email them instead."* There is no way around this; it is policy,
not a limit we chose.

## One-time setup

Everything below is done once, by the studio owner, in a browser. Budget an
afternoon: business verification and App Review are Meta's timelines, not ours.

### 1. Prerequisites

- A **Facebook Page** for the studio.
- An **Instagram professional account** (Business or Creator) **linked to that
  Page** (Instagram app → Settings → Account type and tools → *Share to other
  apps* / Page linking). Without the link there are no Instagram DMs to receive.
- A **Meta Business Portfolio** (business.facebook.com) that owns the Page.
- Admin rights on all three, from the same Facebook account.

### 2. Create the app

1. <https://developers.facebook.com/apps> → **Create app**.
2. Use case: **Other** → app type **Business** → attach it to the Business
   Portfolio that owns the Page.
3. Note the **App ID** and, under *App settings → Basic*, the **App secret**
   (click *Show*). These become `META_APP_ID` and `META_APP_SECRET`.

### 3. Add the products

Add both, from the app dashboard:

- **Messenger** (adds *Messenger API settings*).
- **Instagram** (adds *Instagram API setup with Facebook login*).

### 4. Permissions

The Connect flow requests exactly these; App Review must approve the same set:

| Permission | Why |
| --- | --- |
| `pages_messaging` | send and receive Messenger messages |
| `pages_manage_metadata` | subscribe the app to the Page's webhooks |
| `pages_show_list` | list the Pages the connecting account manages |
| `instagram_basic` | read the linked Instagram business account |
| `instagram_manage_messages` | send and receive Instagram DMs |
| `business_management` | required for review of the above |

### 5. Choose a verify token and set the variables

The verify token is a shared secret **you invent** — Meta echoes it back during
the subscription handshake so the endpoint knows the request is yours.

```bash
openssl rand -hex 32
```

In Coolify, on the compose resource's Environment Variables (admin only — the
web and reception apps have no Meta surface):

| Var | Value |
| --- | --- |
| `META_APP_ID` | the App ID from step 2 |
| `META_APP_SECRET` | the App secret from step 2 |
| `META_VERIFY_TOKEN` | the random string you just generated |
| `META_GRAPH_VERSION` | optional; defaults to `v21.0`. Set it only when Meta deprecates that version |

`SESSION_SECRET` must be **at least 32 characters** — the Page access tokens
are encrypted with a key derived from it, and a shorter secret is refused
outright. Redeploy before continuing: the next step calls back into the app.

### 6. Register the webhook

1. App dashboard → **Messenger → Messenger API settings → Webhooks** →
   **Configure**.
2. Callback URL: `https://<admin-origin>/api/webhooks/meta`
   (Studio › Channels prints the exact URL for the deployed environment.)
3. Verify token: the `META_VERIFY_TOKEN` you set.
4. **Verify and save.** Meta immediately GETs the URL; a failure here is almost
   always a wrong token, a typo in the URL, or a redeploy that has not finished.
5. Subscribe the fields **`messages`**, **`message_echoes`**,
   **`messaging_postbacks`**. Nothing else is consumed.
6. Repeat under **Instagram → Configure webhooks**, with the same callback URL
   and verify token, subscribing the same fields.

### 7. Connect the Page

1. Open **Studio › Channels** in the admin app as the owner.
2. Press **Connect a Facebook Page** and complete the Facebook dialog,
   granting access to the studio Page (and its Instagram account).
   **Select only the studio Page.** Every Page you tick becomes a connection
   here, subscribed to our webhook — tick a personal or client Page and this
   inbox starts receiving its messages too.
3. You land back on the panel with each Page and Instagram account listed,
   marked **Subscribed**.

Connecting stores a long-lived Page access token, encrypted with a key derived
from `SESSION_SECRET`. **Rotating `SESSION_SECRET` makes every stored token
unreadable** — the panel keeps showing the connections and replies fall back to
email; press **Connect** again to re-store them.

### 8. Test before App Review

A new app is in **development mode**: only people with a role on it can message
the Page and have it reach the webhook.

1. App dashboard → **App roles → Roles** → add your own Facebook account (and
   any tester) as **Administrator** or **Tester**; accept the invitation.
2. From that account, message the studio Page. Within seconds the enquiry
   appears in the admin inbox with a Messenger badge, and Studio › Channels
   shows a fresh **Last event received**.
3. Reply from the composer. It should arrive in Messenger from the Page.
4. Send an image; it renders inline in the thread.
5. Repeat by DMing the Instagram account.

### 9. Go live

1. **Business verification** — Business Portfolio → *Security Center* → verify
   the business (documents; Meta's timeline, often days).
2. **App Review** — request the six permissions above with a screencast of the
   Connect flow and of a message arriving and being replied to. Explain the use
   plainly: "a tattoo studio replying to customer enquiries in its own admin".
3. Switch the app from **Development** to **Live**.
4. Message the Page from an account with **no** role on the app and confirm it
   still lands. Until this passes, only testers reach the inbox.

**Go-live checklist:** app Live · business verified · six permissions approved ·
both webhook subscriptions saved with all three fields · Page (and Instagram)
connected and Subscribed in Studio › Channels · a non-tester message arrives ·
a reply sends · Studio › Channels shows no failed events.

## Operations

### Where things are visible

Studio › Channels lists every connection with its channel, when it was
connected, whether the webhook subscription succeeded, and **Last event
received** — the liveness signal. (There is deliberately no "send yourself a
test message" button: sending needs a PSID, which does not exist until someone
messages the Page.)

A connection whose stored token no longer decrypts (`SESSION_SECRET` was
rotated) is listed with **Reconnect required — stored token can't be read**.
Until it is reconnected, every inbound message on it becomes a failed event
reading *"Connection … has an unreadable access token"*, and replies fall back
to email. Press **Connect a Facebook Page** again to re-store the token, then
**Retry** the failed events.

### Disconnecting

**Disconnect** first asks Facebook to unsubscribe the app from that Page, then
removes the connection. Thread history stays, and replies on those threads fall
back to email. The unsubscribe is skipped when another active connection still
uses the same Page — an Instagram connection rides on its Page's token, so
unsubscribing would take that one down too; disconnect both to unsubscribe.

If Facebook refuses the unsubscribe the panel says **"Removed here, but Facebook
may still deliver — remove the app from the Page in Business Settings"**
(`meta_warning=unsubscribe_failed`). Finish it by hand, or Meta keeps POSTing
events this studio no longer has a connection for:

1. **Business Settings → Accounts → Pages →** the Page → **Connected assets /
   Business Apps**.
2. Remove this app from the Page.

Alternatively, from a shell with that Page's token:

```bash
curl -i -X DELETE "https://graph.facebook.com/v21.0/<page id>/subscribed_apps" \
  -d "access_token=<page token>"
```

### Failed events

Identical to email: a correctly-signed event we could not process is stored
whole and the endpoint answers `200` — Meta retries and eventually *disables* a
webhook that keeps erroring, so a 5xx would take the channel down. One row is
written **per event**, so **Retry** replays exactly what broke.

| Error | Cause |
| --- | --- |
| `Meta refused the message: Invalid OAuth access token` | the Page token was revoked — press Connect again |
| `Meta refused the message: … outside of allowed window` | the 24-hour window shut mid-send |
| `Connection … has an unreadable access token` | `SESSION_SECRET` changed — press Connect again, then Retry |
| `Deferred: the delivery exceeded its processing budget` | the delivery ran past 10 s; nothing is lost — press Retry |
| `Stored payload is not a replayable Meta event` | a signed body that was not JSON; check the delivery in the app dashboard |
| `No active Facebook Page or Instagram connection matches this event` | the Page was disconnected — reconnect it, then Retry |

### Panel messages

The connect and disconnect flows come back with a slug in the URL, which the
panel turns into a sentence. The slugs, for reading logs and support requests:

| Slug | Means |
| --- | --- |
| `meta_error=not_configured` | `META_APP_ID`, `META_APP_SECRET` or `APP_ORIGIN` is unset |
| `meta_error=session_secret` | `SESSION_SECRET` is under 32 characters, so a page token cannot be stored |
| `meta_error=bad_state` / `no_code` | the connect attempt did not carry our single-use nonce — start again |
| `meta_error=access_denied` | cancelled at Facebook |
| `meta_error=no_pages` | that account manages no Page this app can use |
| `meta_error=exchange_failed` | Facebook rejected the code exchange — check the redirect URI |
| `meta_warning=subscribe_failed` | connected, but the webhook subscription failed — press Connect again |
| `meta_warning=unsubscribe_failed` | disconnected here, but Facebook may still deliver — see [Disconnecting](#disconnecting) |

### "Reconnect recommended" on a connection

Studio › Channels flags any connection that has received no event for 30 days
(or, for a Page that has never received one, 30 days since it was connected).
It is a hint, not a fault: a quiet Page in a quiet month looks the same as an
expired token. Press **Connect a Facebook Page** and re-authorise; that
replaces the stored token, refreshes the Page name and re-subscribes the
webhook. If the studio genuinely had no DMs for a month, ignore it.

The panel does **not** call Graph's `/debug_token` to check the token directly:
that endpoint takes the token as a URL query parameter, and page tokens must
never appear in a URL (query strings are written to access logs). "Reconnect
required — the stored token can't be read" is the one hard failure we can
detect locally.

### What is deliberately dropped

- **Delivery and read receipts** — not conversation.
- **`messaging_postbacks`** — subscribed so the field exists for later, but
  ignored: we ship no menu or Get Started button, so a postback can only be
  Meta's own default entry point.
- **Echoes of messages we sent ourselves** — recognised by their `mid` and
  skipped, so a reply is never recorded twice.
- **Events for a Page nobody connected** — logged as `unknown_page`.

### Attachments

Images are fetched **only** from Meta's own CDN hosts (`*.fbcdn.net`,
`*.cdninstagram.com`, `lookaside.fbsbx.com`) over https, capped at 8 MB each
and 16 MB per message, and stored under their **sniffed** mime. Everything else
— video, audio, files, and any image from an unexpected host — is kept as a
link. One message also gets a total of 8 seconds to fetch its images; past that
the remaining ones are kept as links rather than holding the delivery open.
**Meta's attachment URLs expire**; anything worth keeping should be saved at
the time.

### Testing the endpoint by hand

```bash
APP_SECRET='…'
BODY='{"object":"page","entry":[{"id":"<connected page id>","time":1788000000000,"messaging":[{"sender":{"id":"<a psid>"},"recipient":{"id":"<page id>"},"timestamp":1788000000000,"message":{"mid":"m_manual_test_1","text":"hello"}}]}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" -r | cut -d' ' -f1)"
curl -i -X POST https://<admin-origin>/api/webhooks/meta \
  -H 'content-type: application/json' -H "x-hub-signature-256: $SIG" -d "$BODY"
```

The handshake can be checked the same way:

```bash
curl -i "https://<admin-origin>/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=12345"
# → 200 with the body 12345
```

| Verb | Response | Meaning |
| --- | --- | --- |
| POST | `200` `{"ok":true,"outcomes":[…]}` | processed; `ok:false` means at least one event became a failed event |
| POST | `401` | the signature or `META_APP_SECRET` is wrong |
| POST | `413` | the body is over 1 MiB |
| POST | `503` | `META_APP_SECRET` is unset |
| GET | `200` with the challenge echoed | the handshake succeeded |
| GET | `403` | wrong `hub.mode`/`hub.verify_token`, a missing `hub.challenge`, or a `hub.challenge` over 512 characters |
| GET | `503` | `META_VERIFY_TOKEN` is unset |

A delivery that runs past its 10-second processing budget answers `200` with
the remaining events stored as failed events reading *"Deferred: the delivery
exceeded its processing budget — press Retry."* — press **Retry** on each.

## Local development

Meta will not deliver to `localhost`. Point a tunnel (`cloudflared`, `ngrok`) at
`http://localhost:3001`, register that URL as the callback on a **second,
development** Meta app, and set that app's id/secret/verify token locally.
Outbound needs a real Page token, so most work is done against the
`ingestMetaEvent` and `sendMetaMessage` suites instead.
