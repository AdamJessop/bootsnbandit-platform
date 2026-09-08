import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_TOTAL_BYTES,
  parseResendInbound,
  resendInboundDeps,
  type ResendAttachmentLink,
  type ResendInboundDeps,
  type ResendInboundEmail,
} from "./email-parse";
import { MAX_INLINE_ATTACHMENT_BYTES } from "../assets";

/** A valid 8-byte PNG signature followed by filler, so sniffImageMime passes. */
function png(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function email(
  attachments: ResendInboundEmail["attachments"],
): ResendInboundEmail {
  return {
    id: "em_budget_1",
    to: ["enq-abcd1234@mail.example.test"],
    from: "Amy Rowe <amy@example.test>",
    created_at: "2026-09-08T10:00:00.000Z",
    subject: "Photos",
    cc: null,
    bcc: null,
    reply_to: null,
    html: null,
    text: "Some references",
    headers: {},
    message_id: "budget@example.test",
    attachments,
  };
}

function meta(
  id: string,
  size: number,
): ResendInboundEmail["attachments"][number] {
  return {
    id,
    filename: `${id}.png`,
    size,
    content_type: "image/png",
    content_id: null,
    content_disposition: "attachment",
  };
}

function link(id: string, size: number): ResendAttachmentLink {
  return {
    id,
    filename: `${id}.png`,
    size,
    content_type: "image/png",
    download_url: `https://dl.example.test/${id}`,
  };
}

const EVENT = {
  type: "email.received",
  data: { email_id: "em_budget_1" },
};

describe("inline attachment budget", () => {
  it("stops downloading once the budget can no longer fit another attachment", async () => {
    // Three 8 MB images: the budget (16 MB) affords two.
    const ids = ["a1", "a2", "a3"];
    const metas = ids.map((id) => meta(id, MAX_INLINE_ATTACHMENT_BYTES));
    const downloaded: string[] = [];
    const deps: ResendInboundDeps = {
      async getEmail() {
        return email(metas);
      },
      async listAttachments() {
        return ids.map((id) => link(id, MAX_INLINE_ATTACHMENT_BYTES));
      },
      async download(url) {
        downloaded.push(url);
        return png(MAX_INLINE_ATTACHMENT_BYTES);
      },
    };

    const parsed = await parseResendInbound(EVENT, deps);

    expect(downloaded).toHaveLength(2);
    expect(parsed.attachments.filter((a) => a.bytes)).toHaveLength(2);
    // The third is still reachable, as a link.
    expect(parsed.attachments[2]).toMatchObject({
      url: "https://dl.example.test/a3",
    });
    expect(parsed.attachments[2].bytes).toBeUndefined();
  });

  it("prices an attachment that declares no size at the full per-file cap", async () => {
    // Three attachments that declare NOTHING (size 0) and each stream 8 MB.
    // Charging the budget only for what already arrived makes every fresh
    // attachment look free, so a size-less mail bomb is pulled down in full.
    const ids = ["c1", "c2", "c3"];
    const downloaded: string[] = [];
    const deps: ResendInboundDeps = {
      async getEmail() {
        return email(ids.map((id) => meta(id, 0)));
      },
      async listAttachments() {
        return ids.map((id) => link(id, 0));
      },
      async download(url, maxBytes) {
        downloaded.push(url);
        return png(Math.min(MAX_INLINE_ATTACHMENT_BYTES, maxBytes));
      },
    };

    const parsed = await parseResendInbound(EVENT, deps);

    expect(downloaded).toHaveLength(2);
    expect(parsed.attachments[2].bytes).toBeUndefined();
    expect(parsed.attachments[2]).toMatchObject({
      url: "https://dl.example.test/c3",
    });
  });

  it("never inlines a 9 MB body behind a declared size of zero", async () => {
    // The real streaming download, over an injected fetch: the per-file cap is
    // enforced on the bytes seen, so a lying `size: 0` still cannot store more
    // than MAX_INLINE_ATTACHMENT_BYTES — it stores nothing and keeps the link.
    const body = png(9 * 1024 * 1024);
    const fetchImpl = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          },
        }),
      )) as unknown as typeof fetch;

    const parsed = await parseResendInbound(EVENT, {
      async getEmail() {
        return email([meta("d1", 0)]);
      },
      async listAttachments() {
        return [link("d1", 0)];
      },
      download: resendInboundDeps(fetchImpl).download,
    });

    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].bytes).toBeUndefined();
    expect(parsed.attachments[0].url).toBe("https://dl.example.test/d1");
  });

  it("caps a lying Content-Length at the remaining budget, not the per-file cap", async () => {
    // 8 MB + 7 MB fills 15 MB of the 16 MB budget. The third attachment
    // DECLARES a single byte, so nothing but what is left of the budget can
    // bound what it actually streams.
    const ids = ["b1", "b2", "b3"];
    const sizes = [
      MAX_INLINE_ATTACHMENT_BYTES,
      MAX_INLINE_TOTAL_BYTES - MAX_INLINE_ATTACHMENT_BYTES - 1024 * 1024,
      1,
    ];
    const caps: number[] = [];
    const deps: ResendInboundDeps = {
      async getEmail() {
        return email(ids.map((id, i) => meta(id, sizes[i])));
      },
      async listAttachments() {
        return ids.map((id, i) => link(id, sizes[i]));
      },
      async download(_url, maxBytes) {
        // The third one wants to send a full 8 MB however little it declared;
        // a real `download` cuts the stream at `maxBytes`, so this returns no
        // more than it was allowed either.
        const declared = sizes[caps.length];
        const wants = declared > 1 ? declared : MAX_INLINE_ATTACHMENT_BYTES;
        caps.push(maxBytes);
        return png(Math.min(wants, maxBytes));
      },
    };

    await parseResendInbound(EVENT, deps);

    expect(caps[0]).toBe(MAX_INLINE_ATTACHMENT_BYTES);
    // 8 MB of budget still left, so the per-file cap is the binding one.
    expect(caps[1]).toBe(MAX_INLINE_ATTACHMENT_BYTES);
    // 16 MB budget − 15 MB spent = 1 MB left, so the stream is cut there.
    expect(caps[2]).toBe(1024 * 1024);
  });
});
