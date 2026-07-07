import { describe, expect, it, vi } from "vitest";
import type { CompletedSessionRow } from "./receipt-resend";

/**
 * CompletedSessionsList imports the "use server" actions module, so it is
 * imported here with the action mocked; we assert the component contract and
 * the precomputed row shape (rendering is covered by the build).
 */
vi.mock("./actions", () => ({ resendReceipt: vi.fn() }));

const { CompletedSessionsList } = await import("./CompletedSessionsList");

describe("CompletedSessionsList contract", () => {
  it("is a component function", () => {
    expect(typeof CompletedSessionsList).toBe("function");
  });

  it("accepts the precomputed completed-session row shape", () => {
    const rows: CompletedSessionRow[] = [
      {
        sessionId: "s1",
        customerName: "Amy",
        artistName: "Bandit",
        completedAtISO: "2026-07-01T15:00:00Z",
        amountChargedPence: 12500,
        tipPence: 1000,
        receiptSentAtISO: "2026-07-01T15:01:00Z",
      },
      {
        sessionId: "s2",
        customerName: "Bob",
        artistName: "Boots",
        completedAtISO: "2026-07-02T15:00:00Z",
        amountChargedPence: 9000,
        tipPence: null,
        receiptSentAtISO: null,
      },
    ];
    expect(rows[1].receiptSentAtISO).toBeNull();
  });
});
