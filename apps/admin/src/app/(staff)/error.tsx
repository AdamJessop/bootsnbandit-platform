"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for every back-of-house screen. Renders inside the AppShell
 * (the (staff) layout stays mounted), so a failed save or load shows a calm
 * message with the nav still there instead of Next's bare error page. "Try
 * again" re-renders the segment; the digest is shown so staff can quote it.
 */
export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-[640px] px-7 py-16">
      <div className="rounded-lg border border-bb-crimson/30 bg-bg-card p-6">
        <AlertTriangle aria-hidden className="mb-3 h-6 w-6 text-bb-crimson" />
        <p className="kicker mb-2">Something went wrong</p>
        <h1 className="display text-[clamp(22px,4vw,30px)] text-text-primary">
          That didn&apos;t work
        </h1>
        <p className="mt-3 text-text-secondary">
          The page hit a problem and the last change may not have saved. Try
          again — if it keeps happening, note what you were doing and the
          reference below.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-text-muted">
            Reference: <code>{error.digest}</code>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-lg border border-border-default px-2.5 text-sm text-text-secondary hover:text-text-primary"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
