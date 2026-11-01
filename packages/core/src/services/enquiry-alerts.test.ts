import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const sendEmail = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: { user: { findMany }, artist: { findUnique } },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail }));

const {
  alertRecipients,
  alertSummary,
  enquiryAdminUrl,
  notifyOwnersOfNewEnquiry,
  SUMMARY_MAX,
} = await import("./enquiry-alerts");

const ENV_KEYS = [
  "ADMIN_ORIGIN",
  "INBOUND_EMAIL_DOMAIN",
  "EMAIL_FROM",
] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.ADMIN_ORIGIN = "https://admin.example.com/";
  process.env.INBOUND_EMAIL_DOMAIN = "bootsnbandit.com";
  process.env.EMAIL_FROM = "Boots n Bandit <studio@bootsnbandit.com>";
  findMany.mockReset();
  findUnique.mockReset();
  sendEmail.mockReset().mockResolvedValue({ id: "m1", status: "sent" });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("alertRecipients", () => {
  it("keeps each owner's own address once and drops the studio's domain", () => {
    expect(
      alertRecipients(
        [
          { email: "owner@gmail.com" },
          { email: "OWNER@gmail.com" },
          { email: "studio@bootsnbandit.com" },
          { email: "calum@mail.bootsnbandit.com" },
          { email: "partner@outlook.com" },
          { email: "  " },
        ],
        "bootsnbandit.com",
      ),
    ).toEqual(["owner@gmail.com", "partner@outlook.com"]);
  });

  it("still drops the EMAIL_FROM host when no inbound domain is configured", () => {
    expect(
      alertRecipients(
        [{ email: "studio@bootsnbandit.com" }, { email: "me@gmail.com" }],
        null,
      ),
    ).toEqual(["me@gmail.com"]);
  });
});

describe("alertSummary", () => {
  it("takes the first non-blank line, flattened", () => {
    expect(alertSummary("\n\n  Swallow   on the\twrist \nmore detail")).toBe(
      "Swallow on the wrist",
    );
  });

  it("cuts a long line to one short line with an ellipsis", () => {
    const out = alertSummary("x".repeat(400)) ?? "";
    expect(Array.from(out)).toHaveLength(SUMMARY_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("is null for nothing at all", () => {
    expect(alertSummary("  \n ")).toBeNull();
    expect(alertSummary(null)).toBeNull();
  });
});

describe("enquiryAdminUrl", () => {
  it("links to the enquiry page on ADMIN_ORIGIN", () => {
    expect(enquiryAdminUrl("enq_1")).toBe(
      "https://admin.example.com/enquiries/enq_1",
    );
  });

  it("falls back to the local admin dev server when ADMIN_ORIGIN is unset", () => {
    delete process.env.ADMIN_ORIGIN;
    expect(enquiryAdminUrl("enq_1")).toBe(
      "http://localhost:3001/enquiries/enq_1",
    );
  });
});

describe("notifyOwnersOfNewEnquiry", () => {
  it("emails every active owner's own address, not the studio's", async () => {
    findMany.mockResolvedValue([
      { email: "owner@gmail.com" },
      { email: "studio@bootsnbandit.com" },
    ]);
    findUnique.mockResolvedValue({ name: "Calum" });

    await notifyOwnersOfNewEnquiry({
      enquiryId: "enq_1",
      customerName: "Robin",
      channel: "instagram",
      preferredArtistId: "art_1",
      summary: "Swallow on the wrist\nand a bit more",
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { role: "OWNER", active: true },
      select: { email: true },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toBe("owner@gmail.com");
    expect(call.type).toBe("enquiry_alert");
    expect(call.data).toEqual({
      customerName: "Robin",
      channelLabel: "Instagram",
      artistName: "Calum",
      summary: "Swallow on the wrist",
      enquiryUrl: "https://admin.example.com/enquiries/enq_1",
    });
    // Staff mail: never mirrored onto the customer's thread or timeline.
    expect(call.enquiryId).toBeUndefined();
    expect(call.customerId).toBeUndefined();
  });

  it("uses a given artist name without looking it up", async () => {
    findMany.mockResolvedValue([{ email: "owner@gmail.com" }]);
    await notifyOwnersOfNewEnquiry({
      enquiryId: "enq_2",
      customerName: "Robin",
      channel: "web",
      artistName: "Marnie",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(sendEmail.mock.calls[0][0].data.artistName).toBe("Marnie");
  });

  it("sends nothing when no owner has a usable address", async () => {
    findMany.mockResolvedValue([{ email: "studio@bootsnbandit.com" }]);
    await notifyOwnersOfNewEnquiry({
      enquiryId: "enq_3",
      customerName: "Robin",
      channel: "email",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never rejects — a database or send failure is logged and swallowed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("db down"));
    await expect(
      notifyOwnersOfNewEnquiry({
        enquiryId: "enq_4",
        customerName: "Robin",
        channel: "web",
      }),
    ).resolves.toBeUndefined();

    findMany.mockResolvedValue([{ email: "owner@gmail.com" }]);
    sendEmail.mockRejectedValue(new Error("resend down"));
    await expect(
      notifyOwnersOfNewEnquiry({
        enquiryId: "enq_5",
        customerName: "Robin",
        channel: "web",
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
