# Subdomain isolation: staff vs. customer

Boots 'n' Bandit runs as two Next.js apps in one npm-workspaces monorepo, sharing
the `@bnb/core` domain package and a single Postgres database, but isolated from
each other at the **origin** level so staff and customer sessions can never overlap.

| Concern        | Public web app (`apps/web`)            | Staff admin app (`apps/admin`)                 |
| -------------- | -------------------------------------- | ---------------------------------------------- |
| Origin (prod)  | `bootsnbandit.<tld>` + `www`           | `admin.bootsnbandit.<tld>`                     |
| Origin (dev)   | `http://localhost:3000`                | `http://localhost:3001`                        |
| Audience       | Customers / public                     | Staff (owner + artists)                        |
| Auth           | none today (future customer auth)      | WebAuthn passkeys only                         |
| Installable PWA| no (manifest intentionally absent)     | yes (manifest + service worker at root scope)  |

## Cookies

The staff session cookie is **host-only** and isolated three ways:

1. **No `Domain=` attribute.** Set in `@bnb/core` `auth/cookies.ts`
   (`writeSessionCookie`), the cookie is host-only — bound to the exact origin
   that set it. It is sent **only** to the admin origin and is never broadcast to
   the apex/www web app or any sibling subdomain. (Setting `Domain=` to the
   eTLD+1 would leak it across subdomains — we never do this.)
2. **Distinct name.** The cookie name is env-driven via `SESSION_COOKIE`
   (`auth/config.ts`), set to `bb_admin_session` for the admin app. A future
   customer auth on the web app MUST use its own distinct name (e.g.
   `bb_customer_session`) so the two can never be confused.
3. **`HttpOnly` + `SameSite=Lax` + `Secure` (prod).** No JS access, CSRF-safe on
   top-level navigations, TLS-only off localhost.

The cookie name is read from env consistently in **all** paths: set, read, and
clear (`auth/cookies.ts`) and the admin Edge `middleware.ts` presence check — so
they stay in lockstep. The web app never reads or writes the staff cookie.

## WebAuthn RP-ID

WebAuthn is origin-bound. The Relying Party ID (`RP_ID`) and expected origin
(`APP_ORIGIN`) come from env (`auth/config.ts`):

- **Dev:** `RP_ID=localhost`, `APP_ORIGIN=http://localhost:3001` — passkeys work
  against the admin app on `localhost:3001`.
- **Prod:** `RP_ID=admin.bootsnbandit.<tld>`, `APP_ORIGIN` = its full https origin.

> Changing `RP_ID` **invalidates existing passkeys** (a credential registered
> under one RP-ID is not offered for another). After a change you must re-enrol:
>
> - **Dev:** `npm run admin:link` mints a one-time enrolment URL
>   (`/sign-in?invite=<token>`) against `APP_ORIGIN`; open it on the admin app,
>   register a passkey, and sign in.
> - **Prod:** issue fresh staff invites and have each staff member re-register.

## PWA scope

Only the **admin** app is installable. Its `manifest.webmanifest`, `sw.js`, and
icons live at the admin root scope (`apps/admin/public`) and `apps/admin` ships a
`manifest` link + `appleWebApp` metadata in its root layout. The **web** app ships
no installable-app manifest (`apps/web` root layout omits `metadata.manifest`,
asserted by a test), so customers never get a staff-app install prompt.

## Deployment shape

Each app is its own host/Vercel project with its own env, pointed at the same
shared Postgres. See the deploy section in `docs/PROJECT-BRIEF.md`.
