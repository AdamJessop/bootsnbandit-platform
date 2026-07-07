"use client";

/**
 * Completed sessions with receipts (BACKOFHOUSE-IA G3). Lists recent completed
 * sessions (date, customer, artist, amount, receipt status) with a "Resend
 * receipt" action wired to the colocated server action.
 */
import { useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { formatPence } from "@/components/admin/money";
import { formatDateTime } from "../_shared/labels";
import { resendReceipt } from "./actions";
import type { CompletedSessionRow } from "./receipt-resend";

export function CompletedSessionsList({
  rows,
}: {
  rows: CompletedSessionRow[];
}) {
  const [pending, start] = useTransition();

  function onResend(sessionId: string) {
    start(async () => {
      const res = await resendReceipt(sessionId);
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
          No completed sessions yet.
        </div>
      ) : (
        rows.map((r) => (
          <div
            key={r.sessionId}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-default bg-bg-card px-5 py-4"
          >
            <div>
              <p className="font-medium text-text-primary">{r.customerName}</p>
              <p className="text-sm text-text-muted">
                {r.artistName} · {formatDateTime(r.completedAtISO)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="tabular-nums text-sm text-text-primary">
                  {formatPence(r.amountChargedPence)}
                  {r.tipPence ? ` (+ ${formatPence(r.tipPence)} tip)` : ""}
                </p>
                <p className="text-xs text-text-muted">
                  {r.receiptSentAtISO
                    ? `Receipt sent ${formatDateTime(r.receiptSentAtISO)}`
                    : "No receipt sent"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onResend(r.sessionId)}
              >
                <Send className="size-4" /> Resend receipt
              </Button>
            </div>
          </div>
        ))
      )}
      <Toaster position="top-center" />
    </div>
  );
}
