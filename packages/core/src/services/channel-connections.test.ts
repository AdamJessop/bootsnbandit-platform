import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";
import {
  deleteConnection,
  findConnectionByExternalId,
  getConnection,
  listChannelConnections,
  lookupConnectionByExternalId,
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
const BAD_PAGE_ID = uid("badpage");
const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789";
});

afterAll(async () => {
  if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SECRET;
  if (await dbReachable()) {
    await testDb().channelConnection.deleteMany({
      where: { externalId: { in: [PAGE_ID, IG_ID, BAD_PAGE_ID] } },
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
      tokenReadable: true,
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

  it("never moves the last event seen backwards", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    // A replayed / out-of-order delivery must not make a live connection look
    // stale on the panel.
    await touchConnectionEvent(row!.id, new Date("2026-09-01T00:00:00Z"));
    const mine = (await listChannelConnections()).find(
      (c) => c.externalId === PAGE_ID,
    );
    expect(mine?.lastEventAt?.toISOString()).toBe("2026-09-08T11:22:33.000Z");

    await touchConnectionEvent(row!.id, new Date("2026-09-09T00:00:00Z"));
    const later = (await listChannelConnections()).find(
      (c) => c.externalId === PAGE_ID,
    );
    expect(later?.lastEventAt?.toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });

  it("returns null for an unknown page rather than throwing", async () => {
    if (!(await dbReachable())) return;
    expect(await findConnectionByExternalId("not-a-page")).toBeNull();
    expect(await getConnection("not-an-id")).toBeNull();
  });

  it("tells 'no row' apart from 'row we cannot read'", async () => {
    if (!(await dbReachable())) return;
    // Nothing at all.
    expect(await lookupConnectionByExternalId("not-a-page")).toEqual({
      kind: "none",
    });

    // A usable row.
    const ok = await lookupConnectionByExternalId(PAGE_ID);
    expect(ok.kind).toBe("ok");
    expect(ok.kind === "ok" && ok.connection.accessToken).toBe(
      "EAAG_second_token",
    );
    expect(ok.kind === "ok" && ok.connection.tokenReadable).toBe(true);

    // A row whose token will never decrypt again.
    await upsertChannelConnection({
      channel: "messenger",
      externalId: BAD_PAGE_ID,
      pageId: BAD_PAGE_ID,
      name: "Rotated secret",
      accessToken: "EAAG_will_be_corrupted",
    });
    await testDb().channelConnection.update({
      where: { externalId: BAD_PAGE_ID },
      data: { accessToken: "v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = await lookupConnectionByExternalId(BAD_PAGE_ID);
    spy.mockRestore();
    expect(bad.kind).toBe("unreadable");
    expect(bad.kind === "unreadable" && bad.row.externalId).toBe(BAD_PAGE_ID);
    // The unreadable shape carries the row, never a token field.
    expect(bad.kind === "unreadable" && bad.row).not.toHaveProperty(
      "accessToken",
    );
    expect(bad.kind === "unreadable" && bad.row.tokenReadable).toBe(false);
  });

  it("survives an undecryptable token instead of taking the inbox down", async () => {
    if (!(await dbReachable())) return;
    const row = await findConnectionByExternalId(PAGE_ID);
    await testDb().channelConnection.update({
      where: { id: row!.id },
      data: { accessToken: "v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await findConnectionByExternalId(PAGE_ID)).toBeNull();
    // The row is still LISTED, so the panel can tell the owner to reconnect —
    // and it is flagged as unreadable so the panel can say which one.
    const listed = (await listChannelConnections()).find(
      (c) => c.externalId === PAGE_ID,
    );
    spy.mockRestore();
    expect(listed).toBeDefined();
    expect(listed?.tokenReadable).toBe(false);
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
