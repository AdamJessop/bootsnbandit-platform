import { describe, expect, it } from "vitest";
import { buildReceiptEmailData } from "./receipt-resend";

/**
 * The resend payload must use the SAME data keys completeSession sends
 * (customerName / amountPence / bankRef / lineItems tip entry) so a re-sent
 * receipt renders identically to the original.
 */
describe("buildReceiptEmailData", () => {
  it("maps a session to the receipt template keys", () => {
    expect(
      buildReceiptEmailData({
        customerName: "Amy",
        amountChargedPence: 12500,
        tipPence: 1000,
        bankRef: "BNB-123",
      }),
    ).toEqual({
      customerName: "Amy",
      amountPence: 12500,
      bankRef: "BNB-123",
      lineItems: [{ label: "Tip", amountPence: 1000 }],
    });
  });

  it("omits the tip line when there is no (or zero) tip", () => {
    expect(
      buildReceiptEmailData({
        customerName: "Amy",
        amountChargedPence: 9000,
        tipPence: 0,
        bankRef: null,
      }),
    ).toEqual({
      customerName: "Amy",
      amountPence: 9000,
      bankRef: undefined,
      lineItems: [],
    });
    expect(
      buildReceiptEmailData({ customerName: "Amy", amountChargedPence: 9000 })
        .lineItems,
    ).toEqual([]);
  });
});
