# CRM Cron Automations

The studio's relationship lifecycle (BACKOFHOUSE-IA "every step") is driven by
idempotent cron jobs that read booking/session state and send the right email at
the right time. There is **no live scheduler dependency** — the jobs are plain
functions exposed behind one HTTP endpoint that any external scheduler can hit.

## Endpoint

```
POST /api/cron/run
```

Guarded by the `CRON_SECRET` environment variable. The caller must present the
secret in **either**:

- header `x-cron-secret: <secret>`, or
- header `Authorization: Bearer <secret>`.

Responses:

| Status | Meaning |
| ------ | ------- |
| `200`  | Ran all jobs; body is the summary (see below). |
| `401`  | Missing/incorrect secret. |
| `503`  | `CRON_SECRET` is not configured on the server. |

Summary body:

```json
{
  "ranAt": "2026-06-19T09:00:00.000Z",
  "jobs": [
    { "job": "reminders", "sent": 2, "skipped": 5 },
    { "job": "review_requests", "sent": 1, "skipped": 0 },
    { "job": "loyalty_rewards", "sent": 0, "skipped": 3 }
  ],
  "totalSent": 3,
  "totalSkipped": 8
}
```

## Jobs

All jobs live in `src/lib/cron/*.ts` and are unit-tested. **Every job is
idempotent** — it dedupes by checking for an existing `MessageLog` of that type
for the booking/customer before sending, so the sweep is safe to run as often as
you like (hourly is recommended).

1. **reminders** (`reminders.ts`) — `confirmed` bookings starting within the
   next ~48h (covers the T-48h and T-24h windows) with reminders opted-in →
   `reminder` email. Skips any booking that already has a `reminder` log.
2. **review_requests** (`review-requests.ts`) — `Session`s whose
   `reviewRequestAt <= now` with no prior `review_request` log → create a
   pending `Review` (capability token) and send the `/review/<token>` link.
3. **loyalty_rewards** (`loyalty-rewards.ts`) — customers who have crossed the
   active `LoyaltyConfig.rewardThreshold` and have never received a
   `loyalty_reward` email → reward email. (The per-session stamp award + perk
   emails already fire at session completion; this is the safety-net sweep.)

> Receipt and aftercare emails fire synchronously at session completion
> (`lib/services/sessions.ts`), so they are not part of the sweep.

## Scheduling

### System cron (self-hosted)

Run hourly. Example `crontab -e` line:

```cron
0 * * * * curl -fsS -X POST https://bootsnbandit.co.uk/api/cron/run \
  -H "x-cron-secret: $CRON_SECRET" > /dev/null
```

### Vercel Cron

Add to `vercel.json` (the schedule hits the route; Vercel automatically sends the
project's `CRON_SECRET` as a Bearer token when the env var is set):

```json
{
  "crons": [{ "path": "/api/cron/run", "schedule": "0 * * * *" }]
}
```

If you prefer to pin the auth yourself, set `CRON_SECRET` in the Vercel project
env and verify the incoming `Authorization: Bearer` header (already supported by
the route).

### Local testing

```bash
curl -X POST http://localhost:3000/api/cron/run \
  -H "x-cron-secret: $CRON_SECRET"
```
