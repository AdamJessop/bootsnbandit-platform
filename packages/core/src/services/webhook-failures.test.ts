import { afterAll, describe, expect, it } from "vitest";
import {
  countOpenWebhookFailures,
  getWebhookFailure,
  listRecentWebhookFailures,
  markWebhookFailureRetried,
  recordWebhookFailure,
  setWebhookFailureError,
} from "./webhook-failures";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

/**
 * WebhookFailure is the audit trail behind the Channels panel: every inbound
 * event we could not process is stored whole so it can be replayed, and the
 * recorder itself must never throw (it runs in the catch block of a webhook
 * that has to answer 200).
 */
describe("webhook failures (DB)", () => {
  const ids: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (ids.length)
        await db().webhookFailure.deleteMany({ where: { id: { in: ids } } });
    }
    await closeTestDb();
  });

  it("stores the whole payload and reads it back for a retry", async () => {
    if (!(await dbReachable())) return;
    const externalId = uid("email");
    const payload = { type: "email.received", data: { email_id: externalId } };
    const id = await recordWebhookFailure({
      provider: "resend",
      externalId,
      payload,
      error: "boom",
    });
    expect(id).toBeTruthy();
    ids.push(id as string);

    const stored = await getWebhookFailure(id as string);
    expect(stored?.provider).toBe("resend");
    expect(stored?.payload).toEqual(payload);
  });

  it("lists recent failures newest first and counts only un-retried ones", async () => {
    if (!(await dbReachable())) return;
    const marker = uid("ext");
    const older = await recordWebhookFailure({
      provider: "resend",
      externalId: `${marker}-a`,
      payload: { n: 1 },
      error: "first",
    });
    const newer = await recordWebhookFailure({
      provider: "resend",
      externalId: `${marker}-b`,
      payload: { n: 2 },
      error: "second",
    });
    ids.push(older as string, newer as string);

    const rows = await listRecentWebhookFailures({ provider: "resend" });
    const mine = rows.filter((r) => r.externalId?.startsWith(marker));
    expect(mine.map((r) => r.externalId)).toEqual([
      `${marker}-b`,
      `${marker}-a`,
    ]);
    expect(mine[0].retriedAt).toBeNull();

    const before = await countOpenWebhookFailures({ provider: "resend" });
    await markWebhookFailureRetried(newer as string);
    const after = await countOpenWebhookFailures({ provider: "resend" });
    expect(after).toBe(before - 1);
    const reread = await listRecentWebhookFailures({ provider: "resend" });
    expect(
      reread.find((r) => r.id === newer)?.retriedAt,
    ).toBeInstanceOf(Date);
  });

  it("records a fresh error message on a failed retry", async () => {
    if (!(await dbReachable())) return;
    const id = await recordWebhookFailure({
      provider: "resend",
      payload: { n: 3 },
      error: "first attempt",
    });
    ids.push(id as string);
    await setWebhookFailureError(id as string, "second attempt");
    const rows = await listRecentWebhookFailures({ provider: "resend" });
    expect(rows.find((r) => r.id === id)?.error).toBe("second attempt");
  });

  it("never throws when the write itself fails", async () => {
    if (!(await dbReachable())) return;
    // A payload Postgres' jsonb cannot hold (a NUL byte in a string) — the
    // recorder must swallow it, because it runs inside a webhook catch block.
    const id = await recordWebhookFailure({
      provider: "resend",
      payload: { bad: " " },
      error: "unstorable",
    });
    if (id) ids.push(id);
    expect(id === null || typeof id === "string").toBe(true);
  });
});
