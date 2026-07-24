import { describe, expect, it } from "vitest";
import {
  allAnswered,
  awaitingCheckin,
  CONSENT_QUESTIONS,
  currentSession,
  estimatePence,
  flaggedQuestions,
  headerDate,
  hhmm,
  nextSession,
  pounds,
  progressPct,
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
    artistId: "a1",
    start: new Date(2026, 6, 7, 10, 0).toISOString(),
    end: new Date(2026, 6, 7, 13, 0).toISOString(),
    durationMin: 180,
    type: "session",
    status: "confirmed",
    checkedInAt: null,
    consentFlagged: null,
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
    const done = [
      sess({ checkedInAt: now.toISOString(), completed: true }),
    ];
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
  it("flags only needs-yes questions answered No", () => {
    const flags = flaggedQuestions({ age: false, eaten: false, sober: true });
    expect(flags.map((q) => q.id)).toEqual(["age"]);
  });

  it("allAnswered requires every question", () => {
    const partial: Record<string, boolean> = { age: true };
    expect(allAnswered(partial)).toBe(false);
    const full = Object.fromEntries(CONSENT_QUESTIONS.map((q) => [q.id, true]));
    expect(allAnswered(full)).toBe(true);
  });
});
