/**
 * Pure logic for the receipts surface (BACKOFHOUSE-IA G3): the completed-
 * session row shape and the receipt email payload builder. The data keys match
 * exactly what `completeSession` (@bnb/core/services/sessions) sends, so a
 * re-sent receipt renders identically to the original.
 */

export interface CompletedSessionRow {
  sessionId: string;
  customerName: string;
  artistName: string;
  completedAtISO: string;
  amountChargedPence: number;
  tipPence: number | null;
  receiptSentAtISO: string | null;
}

/** Type alias (not interface) so it stays assignable to sendEmail's Record data. */
export type ReceiptEmailData = {
  customerName: string;
  amountPence: number;
  bankRef: string | undefined;
  lineItems: { label: string; amountPence: number }[];
};

/** Build the `receipt` template data from a stored session (same keys as completeSession). */
export function buildReceiptEmailData(input: {
  customerName: string;
  amountChargedPence: number;
  tipPence?: number | null;
  bankRef?: string | null;
}): ReceiptEmailData {
  return {
    customerName: input.customerName,
    amountPence: input.amountChargedPence,
    bankRef: input.bankRef ?? undefined,
    lineItems:
      input.tipPence && input.tipPence > 0
        ? [{ label: "Tip", amountPence: input.tipPence }]
        : [],
  };
}
