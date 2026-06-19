import { describe, expect, it } from "vitest";
import {
  buildConvertInput,
  validateReply,
} from "./enquiry-helpers";

describe("validateReply", () => {
  it("requires a non-empty message", () => {
    expect(validateReply({ message: "  " }).ok).toBe(false);
    expect(validateReply({ message: "Hi there" })).toEqual({
      ok: true,
      message: "Hi there",
    });
  });
});

describe("buildConvertInput", () => {
  const base = {
    customerId: "c1",
    artistId: "a1",
    startISO: "2026-07-01T10:00:00.000Z",
    durationMin: 90,
    type: "consult" as const,
    style: "traditional",
    placement: "forearm",
  };

  it("computes end from start + duration and carries style/placement", () => {
    const r = buildConvertInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.start.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(r.input.end.toISOString()).toBe("2026-07-01T11:30:00.000Z");
    expect(r.input.durationMin).toBe(90);
    expect(r.input.style).toBe("traditional");
    expect(r.input.status).toBe("pending");
  });

  it("fails on a missing artist", () => {
    expect(buildConvertInput({ ...base, artistId: "" }).ok).toBe(false);
  });

  it("fails on an invalid date", () => {
    expect(buildConvertInput({ ...base, startISO: "nope" }).ok).toBe(false);
  });

  it("fails on a non-positive duration", () => {
    expect(buildConvertInput({ ...base, durationMin: 0 }).ok).toBe(false);
  });
});
