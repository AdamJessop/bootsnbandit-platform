"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself (the
 * (staff) error.tsx handles everything below it). It replaces the whole
 * document, so it renders its own <html>/<body> and keeps to plain elements
 * and the global tokens — no AppShell, no fonts from the layout.
 */
export default function GlobalError({
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
    <html lang="en" data-theme="dark" className="dark">
      <body className="bg-bg-base text-text-primary">
        <main className="mx-auto max-w-[640px] px-7 py-16">
          <p className="kicker mb-2">Something went wrong</p>
          <h1 className="text-2xl font-bold">The studio app hit a problem</h1>
          <p className="mt-3 text-text-secondary">
            Try again. If it keeps happening, note what you were doing
            {error.digest ? " and the reference below" : ""}.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-text-muted">
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded-lg bg-bb-crimson px-3 text-sm font-medium text-white"
            >
              Try again
            </button>
            {/* A full reload on purpose: the app shell itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-9 items-center rounded-lg border border-border-default px-3 text-sm text-text-secondary"
            >
              Back to dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
