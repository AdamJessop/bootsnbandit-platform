import { describe, expect, it, vi } from "vitest";
import {
  buildSessionPayload,
  submitCompleteSession,
  summariseResult,
} from "./session-complete-logic";

describe("buildSessionPayload", () => {
  it("converts pounds inputs to pence", () => {
    const r = buildSessionPayload({
      bookingId: "b1",
      amount: "125",
      tip: "10.50",
      bankRef: "REF-1",
    });
    expect(r).toEqual({
      ok: true,
      payload: {
        bookingId: "b1",
        amountChargedPence: 12500,
        tipPence: 1050,
        bankRef: "REF-1",
      },
    });
  });

  it("omits tip + bankRef when blank", () => {
    const r = buildSessionPayload({
      bookingId: "b1",
      amount: "80",
      tip: "",
      bankRef: "  ",
    });
    expect(r).toEqual({
      ok: true,
      payload: { bookingId: "b1", amountChargedPence: 8000 },
    });
  });

  it("fails when the amount is missing or invalid", () => {
    expect(buildSessionPayload({ bookingId: "b1", amount: "" }).ok).toBe(false);
    expect(buildSessionPayload({ bookingId: "b1", amount: "abc" }).ok).toBe(
      false,
    );
  });

  it("fails when the tip is invalid", () => {
    const r = buildSessionPayload({
      bookingId: "b1",
      amount: "50",
      tip: "xx",
    });
    expect(r.ok).toBe(false);
  });
});

describe("submitCompleteSession", () => {
  it("POSTs the payload to /api/sessions and returns the result", async () => {
    const result = {
      session: { id: "s1", amountChargedPence: 12500 },
      loyalty: { loyaltyStamps: 3, loyaltyTier: 1, unlockedPerks: [] },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => result,
    });
    const out = await submitCompleteSession(
      { bookingId: "b1", amountChargedPence: 12500 },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(out).toEqual({ ok: true, result });
  });

  it("surfaces a 409 conflict as an error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Already completed" }),
    });
    const out = await submitCompleteSession(
      { bookingId: "b1", amountChargedPence: 100 },
      fetchMock as unknown as typeof fetch,
    );
    expect(out).toEqual({ ok: false, error: "Already completed" });
  });

  it("falls back to a generic message when no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("no json");
      },
    });
    const out = await submitCompleteSession(
      { bookingId: "b1", amountChargedPence: 100 },
      fetchMock as unknown as typeof fetch,
    );
    expect(out.ok).toBe(false);
  });
});

describe("summariseResult", () => {
  it("reports receipt + aftercare sent and loyalty stamp", () => {
    const s = summariseResult({
      session: { id: "s1", amountChargedPence: 12500, tipPence: 1000 },
      loyalty: {
        loyaltyStamps: 4,
        loyaltyTier: 2,
        unlockedPerks: [{ stamps: 4, title: "Free flash", desc: "" }],
      },
    });
    expect(s.amountLabel).toBe("£125.00");
    expect(s.tipLabel).toBe("£10.00");
    expect(s.loyaltyStamps).toBe(4);
    expect(s.unlockedPerkTitles).toEqual(["Free flash"]);
  });

  it("handles a null loyalty result", () => {
    const s = summariseResult({
      session: { id: "s1", amountChargedPence: 5000 },
      loyalty: null,
    });
    expect(s.loyaltyStamps).toBeNull();
    expect(s.unlockedPerkTitles).toEqual([]);
  });
});
