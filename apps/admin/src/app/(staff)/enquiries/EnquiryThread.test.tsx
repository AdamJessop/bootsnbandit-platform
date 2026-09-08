import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnquiryThread, type ThreadItem } from "./EnquiryThread";

const base: ThreadItem = {
  id: "m1",
  direction: "inbound",
  channel: "web",
  authorName: null,
  fromName: "Amy",
  subject: "Peony on the forearm",
  bodyText: "Peony on the forearm please",
  deliveryStatus: "logged",
  createdAtISO: "2026-09-01T10:00:00Z",
  attachments: [],
  senderVerified: null,
};

describe("EnquiryThread", () => {
  it("renders nothing for an empty thread", () => {
    expect(EnquiryThread({ items: [] })).toBeNull();
  });

  it("labels each bubble by direction, channel and author", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          base,
          {
            ...base,
            id: "m2",
            direction: "outbound",
            channel: "email",
            authorName: "Sarah North",
            fromName: null,
            bodyText: "Tuesday works!",
            deliveryStatus: "sent",
            createdAtISO: "2026-09-02T10:00:00Z",
          },
          {
            ...base,
            id: "m3",
            direction: "internal",
            channel: "note",
            authorName: "Sarah North",
            fromName: null,
            bodyText: "Chased on Instagram too.",
            createdAtISO: "2026-09-03T10:00:00Z",
          },
        ]}
      />,
    );
    expect(html).toContain("Peony on the forearm please");
    expect(html).toContain("Tuesday works!");
    expect(html).toContain("Chased on Instagram too.");
    expect(html).toContain("Amy");
    expect(html).toContain("Sarah North");
    expect(html).toContain("Web form");
    expect(html).toContain("Email");
    expect(html).toContain("Internal note");
  });

  it("shows inline attachments through the admin route and links out for the rest", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          {
            ...base,
            attachments: [
              {
                id: "a1",
                mime: "image/png",
                size: 1024,
                filename: "ref.png",
                url: null,
                hasBytes: true,
              },
              {
                id: "a2",
                mime: "application/pdf",
                size: 0,
                filename: "brief.pdf",
                url: "https://f.test/brief.pdf",
                hasBytes: false,
              },
              {
                id: "a3",
                mime: "application/zip",
                size: 0,
                filename: null,
                url: null,
                hasBytes: false,
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("/api/attachments/a1");
    expect(html).toContain("https://f.test/brief.pdf");
    expect(html).toContain("brief.pdf");
    // Unreachable attachment is named but not linked.
    expect(html).not.toContain("/api/attachments/a3");
  });
});

describe("channel and verification badges", () => {
  it("names Messenger and Instagram bubbles with their own icon", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          { ...base, id: "m1", channel: "messenger", bodyText: "hiya" },
          { ...base, id: "m2", channel: "instagram", bodyText: "the moth?" },
        ]}
      />,
    );
    expect(html).toContain("Messenger");
    expect(html).toContain("Instagram");
    // Two distinct lucide icons, one per bubble. lucide-react dropped brand
    // icons (no Facebook/Instagram glyph in this dependency's icon set), so
    // Messenger and Instagram use generic chat/photo icons instead.
    expect(html).toContain("lucide-message-circle");
    expect(html).toContain("lucide-camera");
  });

  it("badges an inbound email whose sender did not authenticate", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          { ...base, id: "m1", channel: "email", senderVerified: false },
        ]}
      />,
    );
    expect(html).toContain("Unverified sender");
  });

  it("says nothing when the sender authenticated, or when nobody checked", () => {
    for (const senderVerified of [true, null]) {
      const html = renderToStaticMarkup(
        <EnquiryThread
          items={[{ ...base, id: "m1", channel: "email", senderVerified }]}
        />,
      );
      expect(html).not.toContain("Unverified sender");
    }
  });

  it("never badges an outbound message, whatever the column says", () => {
    const html = renderToStaticMarkup(
      <EnquiryThread
        items={[
          {
            ...base,
            id: "m1",
            direction: "outbound",
            channel: "email",
            senderVerified: false,
          },
        ]}
      />,
    );
    expect(html).not.toContain("Unverified sender");
  });
});
