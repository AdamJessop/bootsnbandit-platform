# Meta App Review — Boots n Bandit Inbox

App ID `1658465976014778`, published (Live) 2026-11-01 with **Standard Access**.
Standard Access only covers people with a role on the app (or, per Meta's
Instagram docs, a role on a Business Portfolio that has claimed the app).
Meta's docs disagree on whether messages from ordinary customers to the
studio's *own* Page are delivered under Standard Access — test that first
(step 1); only if it fails do steps 2–4.

## 1. Test before reviewing

1. Owner (with an app role) connects the Page in **Studio › Channels**.
2. From a Facebook account with **no role on the app**, message the Page and
   DM the Instagram account.
3. If both arrive in the admin inbox, Advanced Access is not needed. Stop here.

## 2. Business Portfolio + verification

- The studio's Business Portfolio (business.facebook.com) must own the Page
  and the Instagram account.
- Connect the app to it: App settings → Basic → *Business portfolio*, or
  transfer ownership from Adam's account.
- Security Center → **Start verification**. Documents: Companies House / sole
  trader proof, utility bill or bank statement with the studio address. Domain
  or email verification can use `studio@bootsnbandit.com` (now receiving).

## 3. Settings already done

- Privacy policy URL `https://staging.bootsnbandit.com/privacy`
- Data deletion instructions `https://staging.bootsnbandit.com/data-deletion`
- App domains `staging.bootsnbandit.com`, `admin.bootsnbandit.com`
- Category: Business and pages · Contact `me@adamjessop.net`
- **Still to do:** upload the 1024×1024 app icon. Update all URLs when the
  site moves from `staging.` to the apex domain.

## 4. Submission text (one per permission)

Screencast for all: owner signs in to admin → Studio › Channels → Connect a
Facebook Page → Facebook dialog (select only the studio Page) → back on
Channels showing *Subscribed* → customer sends a Messenger message → it
appears in the admin inbox → staff reply from the composer → reply arrives in
Messenger. Repeat the message/reply part for an Instagram DM.

**pages_messaging** — Boots 'n' Bandit is a tattoo studio. Customers message
our Facebook Page to enquire about tattoos. This permission lets our own
staff admin receive those messages and reply to them from the same inbox we
use for email enquiries. Replies are sent only by a human staff member, only
in response to a customer's message, within the 24-hour window. No automated
or promotional messages are sent.

**instagram_manage_messages** — The same as above for Instagram Direct
messages sent to the studio's Instagram professional account, which is linked
to our Page. Staff read and reply to DMs from our admin inbox.

**instagram_basic** — Used only to read the ID and username of the Instagram
professional account linked to our Page, so the admin can show which account
is connected and match incoming DMs to it.

**pages_manage_metadata** — Used once at connection time to subscribe our app
to the Page's `messages`, `message_echoes` and `messaging_postbacks`
webhooks, and to unsubscribe when staff disconnect the Page.

**pages_show_list** — Used during connection to list the Pages the signed-in
studio owner manages so they can pick the studio's Page.

**business_management** — Required by Meta alongside the Page and Instagram
permissions for a Page owned by a Business Portfolio; we make no Business
Manager API calls beyond what connecting the Page requires.

**Business Asset User Profile Access** — Used to read the sender's name when
a customer first messages the Page, so staff see who they are replying to.
We store the name and the page-scoped ID with the conversation; nothing else.
