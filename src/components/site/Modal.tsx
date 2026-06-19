"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@bnb/core/utils";

/**
 * Heritage scrim + modal. Closes on backdrop click and Escape. `wide` widens
 * for lightbox/claim layouts. Body scroll is locked while open.
 */
export function Modal({
  open,
  onClose,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={cn("modal", wide && "wide")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="icon-btn modal-x"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="ic" />
        </button>
        {children}
      </div>
    </div>
  );
}
