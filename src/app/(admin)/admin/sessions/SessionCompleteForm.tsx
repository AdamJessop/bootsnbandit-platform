"use client";

/**
 * Complete Session flow (BACKOFHOUSE-IA G2). One primary CTA per session opens
 * a dialog to confirm the amount charged (pounds → pence), an optional tip and
 * a bank-transfer reference, then POSTs /api/sessions. On success it shows the
 * receipt + aftercare sent confirmation, the loyalty stamp count and any newly
 * unlocked perks.
 */
import { CheckCircle2, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSessionPayload,
  submitCompleteSession,
  summariseResult,
  type ResultSummary,
} from "./session-complete-logic";

export interface PendingSession {
  bookingId: string;
  customerName: string;
  artistName: string;
  startISO: string;
  type: string;
  priceEstimatePence: number | null;
}

export function SessionCompleteForm({ session }: { session: PendingSession }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    session.priceEstimatePence != null
      ? (session.priceEstimatePence / 100).toString()
      : "",
  );
  const [tip, setTip] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [pending, start] = useTransition();

  function onConfirm() {
    setError(null);
    const built = buildSessionPayload({
      bookingId: session.bookingId,
      amount,
      tip,
      bankRef,
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    start(async () => {
      const res = await submitCompleteSession(built.payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(summariseResult(res.result));
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSummary(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <ReceiptText className="size-4" /> Complete session
      </DialogTrigger>
      <DialogContent>
        {summary ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-text-primary">
                <CheckCircle2 className="size-5 text-bb-teal" /> Session completed
              </DialogTitle>
              <DialogDescription>
                {session.customerName} · {session.artistName}
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="tabular-nums">
                Charged <strong className="text-text-primary">{summary.amountLabel}</strong>
                {summary.tipLabel ? ` (+ ${summary.tipLabel} tip)` : ""}
              </li>
              <li>✓ Receipt email sent</li>
              <li>✓ Aftercare email sent</li>
              {summary.loyaltyStamps != null && (
                <li>
                  ✓ Loyalty stamp awarded — now {summary.loyaltyStamps}★
                  {summary.loyaltyTier ? ` (tier ${summary.loyaltyTier})` : ""}
                </li>
              )}
              {summary.unlockedPerkTitles.length > 0 && (
                <li className="text-bb-gold">
                  Unlocked: {summary.unlockedPerkTitles.join(", ")}
                </li>
              )}
            </ul>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-text-primary">
                Complete session
              </DialogTitle>
              <DialogDescription>
                {session.customerName} · {session.artistName} · confirm the amount
                charged (bank transfer).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount charged (£)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="125.00"
                  className="tabular-nums"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tip">Tip (£)</Label>
                  <Input
                    id="tip"
                    inputMode="decimal"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="0.00"
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankRef">Bank ref</Label>
                  <Input
                    id="bankRef"
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={onConfirm} disabled={pending}>
                {pending ? "Completing…" : "Confirm & send receipt"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
