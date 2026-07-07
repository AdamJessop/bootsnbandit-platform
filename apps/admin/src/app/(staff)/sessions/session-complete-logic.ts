/**
 * Pure logic for the Complete Session flow (BACKOFHOUSE-IA G2). The client
 * island collects pounds inputs, this module validates + converts them to the
 * /api/sessions payload (pence), performs the POST and summarises the result
 * (receipt/aftercare sent + loyalty stamp/unlocked perks). Framework-free so it
 * unit-tests with a mocked fetch.
 */
import { formatPence, parsePoundsToPence } from "@/components/admin/money";

export interface SessionFormInput {
  bookingId: string;
  amount: string;
  tip?: string;
  bankRef?: string;
}

export interface SessionPayload {
  bookingId: string;
  amountChargedPence: number;
  tipPence?: number;
  bankRef?: string;
}

export type BuildResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; error: string };

/** Validate the pounds form + convert to a pence payload for POST /api/sessions. */
export function buildSessionPayload(input: SessionFormInput): BuildResult {
  const amountChargedPence = parsePoundsToPence(input.amount);
  if (amountChargedPence == null) {
    return { ok: false, error: "Enter a valid amount charged (e.g. 125.00)." };
  }

  const payload: SessionPayload = {
    bookingId: input.bookingId,
    amountChargedPence,
  };

  const tipRaw = (input.tip ?? "").trim();
  if (tipRaw !== "") {
    const tipPence = parsePoundsToPence(tipRaw);
    if (tipPence == null) {
      return {
        ok: false,
        error: "Enter a valid tip amount, or leave it blank.",
      };
    }
    payload.tipPence = tipPence;
  }

  const bankRef = (input.bankRef ?? "").trim();
  if (bankRef !== "") payload.bankRef = bankRef;

  return { ok: true, payload };
}

export interface LoyaltyResult {
  loyaltyStamps: number;
  loyaltyTier: number;
  unlockedPerks: { stamps: number; title: string; desc: string }[];
}

export interface CompleteSessionApiResult {
  session: {
    id: string;
    amountChargedPence: number;
    tipPence?: number | null;
    bankRef?: string | null;
  };
  loyalty: LoyaltyResult | null;
}

export type SubmitResult =
  | { ok: true; result: CompleteSessionApiResult }
  | { ok: false; error: string };

/**
 * POST the payload to /api/sessions. Surfaces 409 conflicts (and any error
 * body) as a message. `fetchImpl` is injectable for tests.
 */
export async function submitCompleteSession(
  payload: SessionPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  const res = await fetchImpl("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let error = `Could not complete the session (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) error = body.error;
    } catch {
      // no body — keep the generic message
    }
    return { ok: false, error };
  }

  const result = (await res.json()) as CompleteSessionApiResult;
  return { ok: true, result };
}

export interface ResultSummary {
  amountLabel: string;
  tipLabel: string | null;
  receiptSent: true;
  aftercareSent: true;
  loyaltyStamps: number | null;
  loyaltyTier: number | null;
  unlockedPerkTitles: string[];
}

/** Build a human-readable confirmation summary from the API result. */
export function summariseResult(
  result: CompleteSessionApiResult,
): ResultSummary {
  const tip = result.session.tipPence ?? 0;
  return {
    amountLabel: formatPence(result.session.amountChargedPence),
    tipLabel: tip > 0 ? formatPence(tip) : null,
    receiptSent: true,
    aftercareSent: true,
    loyaltyStamps: result.loyalty?.loyaltyStamps ?? null,
    loyaltyTier: result.loyalty?.loyaltyTier ?? null,
    unlockedPerkTitles: (result.loyalty?.unlockedPerks ?? []).map(
      (p) => p.title,
    ),
  };
}
