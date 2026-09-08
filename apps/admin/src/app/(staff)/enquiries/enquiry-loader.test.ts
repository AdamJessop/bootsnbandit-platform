import { describe, expect, it, vi } from "vitest";

// The loader's only collaborators are core services; stub them so the maths
// (reachability, unread flags, thread mapping) runs without a database.
vi.mock("@bnb/core/services/enquiry-messages", () => ({
  unreadCountsFor: vi.fn(async () => ({ total: 1, enquiryIds: ["e1"] })),
  listThreadsFor: vi.fn(
    async (ids: string[]) =>
      new Map(
        ids.map((id) => [
          id,
          [
            {
              id: `${id}-m1`,
              direction: "inbound",
              channel: "email",
              authorName: null,
              fromName: "Dec",
              subject: "Half sleeve",
              bodyText: "Hello",
              deliveryStatus: "logged",
              senderVerified: false,
              createdAt: new Date("2026-09-08T06:13:00Z"),
              attachments: [
                { id: "a1", mime: "image/png", size: 1, filename: "x.png", url: null, hasBytes: true },
              ],
            },
          ],
        ]),
      ),
  ),
}));
vi.mock("@bnb/core/services/channel-connections", () => ({
  listChannelConnections: vi.fn(async () => []),
}));
vi.mock("@bnb/core/services/channels/email", () => ({
  ENQUIRY_EMAIL_CONTEXT_SELECT: { id: true, customerId: true, contactName: true, contactEmail: true, subject: true },
  toEnquiryEmailContext: (e: { contactEmail: string | null }) => ({
    contactEmail: e.contactEmail,
    lastInboundChannel: "email",
    lastInboundAt: new Date("2026-09-08T06:13:00Z"),
    lastInboundConnectionId: null,
    lastInboundFromAddress: e.contactEmail,
  }),
}));
vi.mock("@bnb/core/services/channels/meta", () => ({
  META_SEND_WINDOW_MS: 24 * 3600_000,
}));

import { buildEnquiryItems, type EnquiryRow } from "./enquiry-loader";

const ROW = {
  id: "e1",
  customerId: "c1",
  contactName: "Dec Rowntree",
  contactEmail: "dec@example.test",
  subject: "Half sleeve",
  style: "Blackwork",
  placement: "Upper arm",
  size: "Large",
  budgetPence: 60000,
  description: "Ornamental",
  moodboard: [],
  moodboardData: null,
  status: "new",
  source: "web",
  channel: "email",
  preferredArtistId: "a1",
  createdAt: new Date("2026-09-08T06:00:00Z"),
  lastMessageAt: new Date("2026-09-08T06:13:00Z"),
} as unknown as EnquiryRow;

describe("buildEnquiryItems", () => {
  it("maps a row to what the page renders: names, unread, thread, reply options", async () => {
    const [item] = await buildEnquiryItems(
      [ROW],
      { userId: "u1", role: "OWNER", artistId: null },
      [{ id: "a1", name: "Sarah North" }],
    );
    expect(item.preferredArtistName).toBe("Sarah North");
    expect(item.unread).toBe(true);
    expect(item.createdAtISO).toBe("2026-09-08T06:00:00.000Z");
    expect(item.thread).toHaveLength(1);
    expect(item.thread[0].attachments[0]).toMatchObject({ id: "a1", hasBytes: true });
    // Email is reachable (an address is on file); Meta channels are not.
    const email = item.replyOptions.find((o) => o.channel === "email");
    expect(email?.available).toBe(true);
    expect(item.defaultReplyChannel).toBe("email");
  });

  it("leaves the artist name null when nobody has it", async () => {
    const [item] = await buildEnquiryItems(
      [{ ...ROW, preferredArtistId: null }],
      { userId: "u1", role: "OWNER", artistId: null },
      [],
    );
    expect(item.preferredArtistName).toBeNull();
  });
});
