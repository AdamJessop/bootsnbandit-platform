import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";
import {
  deleteConnection,
  findConnectionByExternalId,
  getConnection,
  listChannelConnections,
  touchConnectionEvent,
  upsertChannelConnection,
} from "./channel-connections";

/**
 * The ONE module that decrypts a page token. Everything else — the panel, the
 * webhook route, the send path — takes what this returns, so the encryption
 * boundary is a single file wide and a page component physically cannot leak
 * a token: the type it is handed has no such field.
 */
const PAGE_ID = uid("page");
const IG_ID = uid("ig");
const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789";
});

afterAll(async () => {
  if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SECRET;
  if (await dbReachable()) {
    await testDb().channelConnection.deleteMany({
      where: { externalId: { in: [PAGE_ID, IG_ID] } },
    });
  }
  await closeTestDb();
});

describe("channel connections", () => {
  it("stores the token encrypted and hands it back decrypted", async () => {
    if (!(await dbReachable())) return;
    const row = await upsertChannelConnection({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      igAccountId: IG_ID,
      name: "Boots 'n' Bandit",
      accessToken: "EAAG_synthetic_page_token",
    });
    expect(row).toMatchObject({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      igAccountId: IG_ID,
      active: true,
    });
    // The listing shape carries no token at all — it is what the panel renders.
    expect(row).not.toHaveProperty("accessToken");

    const stored = await testDb().channelConnection.findUnique({
      where: { externalId: PAGE_ID },
      select: { accessToken: true },
    });
    expect(stored?.accessToken).not.toContain("EAAG_synthetic_page_token");
    expect(stored?.accessToken.startsWith("v1:")).toBe(true);

    const live = await findConnectionByExternalId(PAGE_ID);
    expect(live?.accessToken).toBe("EAAG_synthetic_page_token");
    expect(await getConnection(live!.id)).toMatchObject({
      accessToken: "EAAG_synthetic_page_token",
    });
  });

  it("re-connecting the same page replaces the token and reactivates it", async () => {
    if (!(await dbReachable())) return;
    const first = await findConnectionByExternalId(PAGE_ID);
    await testDb().channelConnection.update({
      where: { id: first!.id },
      data: { active: false },
    });

    await upsertChannelConnection({
      channel: "messenger",
      externalId: PAGE_ID,
      pageId: PAGE_ID,
      name: "Boots 'n' Bandit (renamed)",
      accessToken: "EAAG_second_token",
      webhookSubscribedAt: new Date("2026-09-08T09:00:00Z"),
    });

    const again = await findConnectionByExternalId(PAGE_ID);
    expect(again).toMatchObject({
      id: first!.id,
      name: "Boots 'n' Bandit (renamed)",
      active: true,
      accessToken: "EAAG_second_token",
    });
    expect(again?.webhookSubscribedAt?.toISOString()).toBe(
      "2026-09-08T09:00:00.000Z",
    );
  });

  it("records the last event seen", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    await touchConnectionEvent(row!.id, new Date("2026-09-08T11:22:33Z"));
    const mine = (await listChannelConnections()).find(
      (c) => c.externalId === PAGE_ID,
    );
    expect(mine?.lastEventAt?.toISOString()).toBe("2026-09-08T11:22:33.000Z");
  });

  it("returns null for an unknown page rather than throwing", async () => {
    if (!(await dbReachable())) return;
    expect(await findConnectionByExternalId("not-a-page")).toBeNull();
    expect(await getConnection("not-an-id")).toBeNull();
  });

  it("survives an undecryptable token instead of taking the inbox down", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    await testDb().channelConnection.update({
      where: { id: row!.id },
      data: { accessToken: "v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA" },
    });
    expect(await findConnectionByExternalId(PAGE_ID)).toBeNull();
    // The row is still LISTED, so the panel can tell the owner to reconnect.
    expect(
      (await listChannelConnections()).some((c) => c.externalId === PAGE_ID),
    ).toBe(true);
  });

  it("deletes a connection idempotently", async () => {
    if (!(await dbReachable())) return;
    const row = await testDb().channelConnection.findUnique({
      where: { externalId: PAGE_ID },
      select: { id: true },
    });
    expect(await deleteConnection(row!.id)).toBe(1);
    expect(await deleteConnection(row!.id)).toBe(0);
  });
});
