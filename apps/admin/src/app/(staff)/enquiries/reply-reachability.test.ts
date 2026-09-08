import { describe, expect, it } from "vitest";
import {
  reachabilityFrom,
  replyChannelOptions,
  defaultComposerChannel,
} from "./reply-reachability";

/**
 * The behaviour these cover is the join between "what did the customer write
 * on?" and "can we still reach that Page?" — two facts that used to be one,
 * which made a disconnected Page look like a thread that was never on Meta.
 */

const WINDOW_MS = 86_400_000;
const NOW = Date.parse("2026-09-08T12:00:00.000Z");
/** The customer wrote three hours ago, so the window is still open. */
const RECENT = new Date("2026-09-08T09:00:00.000Z");
/** …and this one wrote two days ago, so it shut yesterday morning. */
const STALE = new Date("2026-09-06T09:00:00.000Z");

function messengerHint(input: Parameters<typeof reachabilityFrom>[0]): string {
  const reach = reachabilityFrom(input);
  return replyChannelOptions(reach, NOW).find((o) => o.channel === "messenger")!
    .hint;
}

const LIVE_MESSENGER = {
  contactEmail: "amy@example.test",
  lastInboundChannel: "messenger" as const,
  lastInboundAt: RECENT,
  metaTargetReady: true,
  metaWindowMs: WINDOW_MS,
};

describe("reachabilityFrom", () => {
  it("reads the Meta channel off the last inbound message", () => {
    expect(reachabilityFrom(LIVE_MESSENGER)).toEqual({
      contactEmail: "amy@example.test",
      metaChannel: "messenger",
      metaTargetReady: true,
      metaWindowClosesAtISO: "2026-09-09T09:00:00.000Z",
    });
  });

  it("keeps the Meta channel when the Page behind it is gone", () => {
    // The distinction the hints depend on: the conversation exists, the
    // connection does not.
    const reach = reachabilityFrom({
      ...LIVE_MESSENGER,
      metaTargetReady: false,
    });
    expect(reach.metaChannel).toBe("messenger");
    expect(reach.metaTargetReady).toBe(false);
  });

  it("has no Meta channel — and no live target — for an email thread", () => {
    const reach = reachabilityFrom({
      ...LIVE_MESSENGER,
      lastInboundChannel: "email",
      // Even a caller that got this wrong cannot conjure a Meta target onto a
      // thread with no Meta message.
      metaTargetReady: true,
    });
    expect(reach.metaChannel).toBeNull();
    expect(reach.metaTargetReady).toBe(false);
  });

  it("has no window when the customer has never written", () => {
    expect(
      reachabilityFrom({ ...LIVE_MESSENGER, lastInboundAt: null })
        .metaWindowClosesAtISO,
    ).toBeNull();
  });
});

describe("the three reasons Messenger is refused", () => {
  it("says there is no conversation when nothing arrived on Meta", () => {
    expect(
      messengerHint({
        ...LIVE_MESSENGER,
        lastInboundChannel: "email",
        metaTargetReady: false,
      }),
    ).toBe("No Messenger conversation on this thread.");
  });

  it("says the Page is not connected when the conversation exists but the connection does not", () => {
    expect(messengerHint({ ...LIVE_MESSENGER, metaTargetReady: false })).toBe(
      "That Page is not connected — reconnect it in Studio › Channels.",
    );
  });

  it("names the closing time when the Page is live but the window has shut", () => {
    // `Sept?` because en-GB's short month is "Sep" on older ICU and "Sept" on
    // newer — the assertion is about naming the day, not the spelling.
    expect(messengerHint({ ...LIVE_MESSENGER, lastInboundAt: STALE })).toMatch(
      /^The 24-hour reply window closed at 07 Sept? .* — reply by email instead\.$/,
    );
  });

  it("offers Messenger when the conversation, the Page and the window all hold", () => {
    const reach = reachabilityFrom(LIVE_MESSENGER);
    expect(
      replyChannelOptions(reach, NOW).find((o) => o.channel === "messenger")!
        .available,
    ).toBe(true);
    expect(defaultComposerChannel(reach, NOW)).toBe("messenger");
  });

  it("opens on email when the Page went dark, without hiding why", () => {
    const reach = reachabilityFrom({
      ...LIVE_MESSENGER,
      metaTargetReady: false,
    });
    expect(defaultComposerChannel(reach, NOW)).toBe("email");
  });
});
