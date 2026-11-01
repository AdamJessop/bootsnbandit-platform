"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog — "Save as PDF" lives there too. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cp-print-btn"
    >
      <Printer aria-hidden="true" width={18} height={18} />
      Print / Save as PDF
    </button>
  );
}
