/**
 * STUB — Booking create/edit drawer (BACKOFHOUSE-IA C3). Wave-4 phase P9 fills
 * in the customer/artist/type/style/placement/duration/price/status form atop a
 * shadcn Sheet. Prop interface is the stable contract.
 */

export interface BookingDraft {
  id?: string;
  customerId?: string;
  artistId?: string;
  type?: "consult" | "session" | "flash";
  style?: string;
  placement?: string;
  durationMins?: number;
  priceEstimate?: number;
  notes?: string;
  status?: string;
}

export interface BookingDrawerProps {
  open: boolean;
  /** Existing booking when editing; omit to create. */
  booking?: BookingDraft;
  onSave: (draft: BookingDraft) => void;
  onClose: () => void;
}

export function BookingDrawer({ open, booking }: BookingDrawerProps) {
  if (!open) return null;
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-6 text-text-muted">
      <p className="font-termina text-sm uppercase tracking-wide text-text-primary">
        {booking?.id ? "Edit booking" : "New booking"}
      </p>
      <p className="mt-1 text-sm">
        Drawer form implementation lands in Phase 9.
      </p>
    </div>
  );
}
