"use server";

import { requireRole } from "@bnb/core/auth";
import { setLeaveStatus } from "@bnb/core/services/leave";

/**
 * Server actions for the Availability & Leave screen (BACKOFHOUSE-IA H2).
 * Artist-declared leave is created `pending` (see /api/leave POST); only
 * approved leave blocks the calendar. Owners resolve pending requests here.
 */

export interface LeaveActionResult {
  ok: boolean;
  error?: string;
}

export interface SetLeaveStatusInput {
  leaveId: string;
  status: "approved" | "rejected";
}

/** Approve or reject a pending leave request. OWNER only. */
export async function setLeaveStatusAction(
  input: SetLeaveStatusInput,
): Promise<LeaveActionResult> {
  try {
    const user = await requireRole();
    if (user.role !== "OWNER") {
      return { ok: false, error: "Only owners can approve or reject leave." };
    }
    // Server actions are callable with arbitrary payloads — re-check at runtime.
    if (input.status !== "approved" && input.status !== "rejected") {
      return { ok: false, error: "Invalid leave status." };
    }
    await setLeaveStatus(input.leaveId, input.status);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message ?? "Could not update leave.",
    };
  }
}
