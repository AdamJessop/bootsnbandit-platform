"use client";

/**
 * Owner-only pending-leave inbox (BACKOFHOUSE-IA H2). Lists every artist's
 * pending leave request with Approve / Reject, calling the OWNER-guarded
 * setLeaveStatusAction. Approval makes the range block the calendar (only
 * approved leave feeds bookings.checkConflict).
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLeaveStatusAction } from "./actions";

export interface PendingLeaveItem {
  id: string;
  artistName: string;
  /** Pre-formatted "12 Aug 2026 – 19 Aug 2026" range (server-rendered). */
  range: string;
  reason: string | null;
}

export function PendingLeavePanel({ items }: { items: PendingLeaveItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function decide(id: string, status: "approved" | "rejected") {
    start(async () => {
      const res = await setLeaveStatusAction({ leaveId: id, status });
      if (res.ok) {
        toast.success(
          status === "approved"
            ? "Leave approved — those dates now block the calendar."
            : "Leave rejected.",
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update leave.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-border-default bg-bg-card p-5">
      <h2 className="font-termina text-xs uppercase tracking-wide text-text-muted">
        Pending leave
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">
          No leave awaiting approval.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border-default px-4 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">
                  {item.artistName}
                </p>
                <p className="tabular-nums text-text-secondary">
                  {item.range}
                  {item.reason ? ` · ${item.reason}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={() => decide(item.id, "approved")}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={() => decide(item.id, "rejected")}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
