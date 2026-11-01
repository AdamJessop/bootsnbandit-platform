import { describe, expect, it } from "vitest";
import {
  allAnswered,
  awaitingCheckin,
  CONSENT_QUESTIONS,
  consentAckReason,
  currentSession,
  estimatePence,
  flaggedQuestions,
  headerDate,
  hhmm,
  HOLD_TO_UNLOCK_MS,
  IDLE_COUNTDOWN_MS,
  IDLE_TIMEOUT_MS,
  idleStage,
  isPinShaped,
  isoDate,
  maskPhone,
  nextSession,
  OFFLINE_MSG,
  pounds,
  progressPct,
  safeAction,
  shortName,
  startSlots,
  takingsPence,
  typeLabel,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

function sess(over: Partial<BoardSession> = {}): BoardSession {
  return {
    id: "s1",
    customerId: "c1",
    customerName: "Megan Wray",
    customerPhone: null,
    customerEmail: null,
    customerDob: null,
    style: null,
    placement: null,
    artistId: "a1",
    start: new Date(2026, 6, 7, 10, 0).toISOString(),
    end: new Date(2026, 6, 7, 13, 0).toISOString(),
    durationMin: 180,
    type: "session",
    status: "confirmed",
    checkedInAt: null,
    consentFlagged: null,
    idCheckedBy: null,
    completed: false,
    amountChargedPence: null,
    ...over,
  };
}

const artist: BoardArtist = {
  id: "a1",
  name: "Sarah",
  status: "CO_OWNER",
  tag: null,
  headshot: null,
  hue: "crimson",
  hourlyRatePence: 9000,
  onLeave: false,
  checkedIn: true,
};

describe("time helpers", () => {
  it("formats HH:MM local", () => {
    expect(hhmm(new Date(2026, 6, 7, 9, 5))).toBe("09:05");
  });

  it("formats the header date", () => {
    expect(headerDate(new Date(2026, 6, 7))).toBe("Tuesday 7 Jul");
  });

  it("startSlots rounds up to the next half hour and stops before 20:00", () => {
    const slots = startSlots(new Date(2026, 6, 7, 18, 40), 8);
    expect(hhmm(slots[0])).toBe("19:00");
    expect(slots.every((s) => s.getHours() < 20)).toBe(true);
    expect(slots.length).toBe(2); // 19:00, 19:30
  });

  it("startSlots still offers the next slot for a late walk-in", () => {
    const slots = startSlots(new Date(2026, 6, 7, 21, 33), 8);
    expect(slots.length).toBe(1);
    expect(hhmm(slots[0])).toBe("22:00");
  });
});

describe("board derivations", () => {
  const now = new Date(2026, 6, 7, 11, 0);

  it("a session is only 'current' once the customer checked in", () => {
    const notArrived = [sess()];
    expect(currentSession(notArrived, "a1", now)).toBeNull();

    const arrived = [sess({ checkedInAt: now.toISOString() })];
    expect(currentSession(arrived, "a1", now)?.id).toBe("s1");
    // ...and it becomes the "next" slot while they haven't arrived.
    expect(nextSession(notArrived, "a1", now)?.id).toBe("s1");
  });

  it("a checked-in session stays current from arrival until checkout", () => {
    // Early arrival: checked in before the booked start still shows with the
    // artist (session runs 10:00–13:00).
    const early = [
      sess({ checkedInAt: new Date(2026, 6, 7, 9, 40).toISOString() }),
    ];
    expect(currentSession(early, "a1", new Date(2026, 6, 7, 9, 45))?.id).toBe(
      "s1",
    );

    // Overrun: still with the artist after the booked end until checked out.
    expect(currentSession(early, "a1", new Date(2026, 6, 7, 13, 30))?.id).toBe(
      "s1",
    );

    // Checked out (completed) drops off entirely.
    const done = [sess({ checkedInAt: now.toISOString(), completed: true })];
    expect(currentSession(done, "a1", new Date(2026, 6, 7, 13, 30))).toBeNull();

    // With two checked-in sessions, the one overlapping "now" wins.
    const overlap = sess({ id: "live", checkedInAt: now.toISOString() });
    const late = sess({
      id: "waiting",
      start: new Date(2026, 6, 7, 14, 0).toISOString(),
      end: new Date(2026, 6, 7, 16, 0).toISOString(),
      checkedInAt: now.toISOString(),
    });
    expect(currentSession([late, overlap], "a1", now)?.id).toBe("live");
  });

  it("progress is clamped between 3 and 100", () => {
    const s = sess({ checkedInAt: now.toISOString() });
    expect(progressPct(s, new Date(2026, 6, 7, 11, 0))).toBe(33);
    expect(progressPct(s, new Date(2026, 6, 7, 10, 0))).toBe(3);
    expect(progressPct(s, new Date(2026, 6, 7, 23, 0))).toBe(100);
  });

  it("awaitingCheckin lists only un-arrived, un-completed sessions in order", () => {
    const a = sess({
      id: "later",
      start: new Date(2026, 6, 7, 15, 0).toISOString(),
    });
    const b = sess({ id: "sooner" });
    const done = sess({ id: "done", completed: true });
    const here = sess({ id: "here", checkedInAt: now.toISOString() });
    expect(awaitingCheckin([a, b, done, here]).map((s) => s.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("sums takings from completed session amounts", () => {
    expect(
      takingsPence([
        sess({ amountChargedPence: 15000 }),
        sess({ id: "s2", amountChargedPence: 8000 }),
        sess({ id: "s3" }),
      ]),
    ).toBe(23000);
  });
});

describe("money / estimates", () => {
  it("estimates from the artist hourly rate × duration", () => {
    expect(estimatePence(sess(), artist)).toBe(27000); // £90/hr × 3h
  });

  it("consults are free; unknown rate falls back to £80/hr", () => {
    expect(estimatePence(sess({ type: "consult" }), artist)).toBe(0);
    expect(
      estimatePence(sess({ durationMin: 60 }), {
        ...artist,
        hourlyRatePence: null,
      }),
    ).toBe(8000);
  });

  it("formats whole pounds", () => {
    expect(pounds(27000)).toBe("£270");
  });

  it("labels booking types", () => {
    expect(typeLabel("consult")).toBe("Consultation");
    expect(typeLabel("session")).toBe("Tattoo session");
  });
});

describe("consent questionnaire", () => {
  /** Every question answered the way that needs no follow-up. */
  const clean = () =>
    Object.fromEntries(
      CONSENT_QUESTIONS.map((q) => [q.id, q.expect === "yes"]),
    );

  it("flags only the concerning answers", () => {
    const flags = flaggedQuestions({ skin: true, heart: false, other: false });
    expect(flags.map((q) => q.id)).toEqual(["skin"]);
  });

  // Every question on the kiosk form: its concerning answer flags it (and
  // only it); its safe answer flags nothing. On the v3 paper form every
  // medical row expects No, so a Yes anywhere flags.
  for (const q of CONSENT_QUESTIONS) {
    it(`"${q.id}" flags on ${q.expect === "yes" ? "No" : "Yes"}`, () => {
      const concerning = { ...clean(), [q.id]: q.expect !== "yes" };
      expect(flaggedQuestions(concerning).map((f) => f.id)).toEqual([q.id]);
      expect(flaggedQuestions(clean())).toEqual([]);
    });
  }

  it("skin, pregnancy and other-condition Yes answers are all flagged", () => {
    const flags = flaggedQuestions({
      ...clean(),
      skin: true,
      pregnant: true,
      other: true,
    });
    expect(flags.map((q) => q.id).sort()).toEqual([
      "other",
      "pregnant",
      "skin",
    ]);
  });

  it("allAnswered requires every question", () => {
    const partial: Record<string, boolean> = { skin: false };
    expect(allAnswered(partial)).toBe(false);
    expect(allAnswered(clean())).toBe(true);
  });

  it("formats a local date for the date input", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("privacy on the customer-facing screen", () => {
  it("shortName keeps the first name and last initial", () => {
    expect(shortName("Megan Wray")).toBe("Megan W.");
    expect(shortName("  Mary  Ann   de la Cruz ")).toBe("Mary C.");
    expect(shortName("Cher")).toBe("Cher");
    expect(shortName("")).toBe("");
  });

  it("maskPhone shows only the last three digits", () => {
    expect(maskPhone("07123 456789")).toBe("••• 789");
    expect(maskPhone("+44 7123 456 789")).toBe("••• 789");
    expect(maskPhone("12")).toBe("•••");
  });
});

describe("checkout consent acknowledgement", () => {
  it("needs an acknowledgement for a missing or flagged form only", () => {
    expect(consentAckReason({ consentFlagged: null })).toBe("missing");
    expect(consentAckReason({ consentFlagged: true })).toBe("flagged");
    expect(consentAckReason({ consentFlagged: false })).toBeNull();
  });
});

describe("safeAction (network failures)", () => {
  it("passes results through", async () => {
    expect(await safeAction(async () => ({ ok: true }) as const)).toEqual({
      ok: true,
    });
    expect(
      await safeAction(async () => ({ ok: false, error: "Nope" }) as const),
    ).toEqual({ ok: false, error: "Nope" });
  });

  it("turns a thrown fetch/action failure into a friendly retry message", async () => {
    const res = await safeAction(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(res).toEqual({ ok: false, error: OFFLINE_MSG });
    expect(OFFLINE_MSG).toBe("No connection — try again");
  });
});

describe("idleStage", () => {
  it("stays active until ~90s without a touch", () => {
    expect(IDLE_TIMEOUT_MS).toBe(90_000);
    expect(idleStage(0)).toEqual({ stage: "active" });
    expect(idleStage(89_999)).toEqual({ stage: "active" });
  });

  it("then counts down 10 seconds of 'Still there?'", () => {
    expect(IDLE_COUNTDOWN_MS).toBe(10_000);
    expect(idleStage(90_000)).toEqual({ stage: "warning", secondsLeft: 10 });
    expect(idleStage(95_500)).toEqual({ stage: "warning", secondsLeft: 5 });
    expect(idleStage(99_001)).toEqual({ stage: "warning", secondsLeft: 1 });
  });

  it("then resets", () => {
    expect(idleStage(100_000)).toEqual({ stage: "reset" });
    expect(idleStage(1_000_000)).toEqual({ stage: "reset" });
  });
});

describe("staff gate", () => {
  it("accepts 4–6 digit PINs only", () => {
    expect(isPinShaped("1234")).toBe(true);
    expect(isPinShaped("123456")).toBe(true);
    expect(isPinShaped("123")).toBe(false);
    expect(isPinShaped("1234567")).toBe(false);
    expect(isPinShaped("12a4")).toBe(false);
  });

  it("holds for 2 seconds without a PIN", () => {
    expect(HOLD_TO_UNLOCK_MS).toBe(2000);
  });
});
