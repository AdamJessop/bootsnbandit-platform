"use client";

/**
 * Inline new-customer fieldset for BookingDrawer's "New customer" mode.
 * Saving creates the customer (welcome email with set-password link) before
 * the booking — see saveBookingAction. Split out to keep the drawer lean.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingErrors, BookingFormState } from "./booking-form";

type NewCustomerKey = "newCustomerName" | "newCustomerDob" | "newCustomerEmail";

export interface NewCustomerFieldsProps {
  state: Pick<BookingFormState, NewCustomerKey>;
  errors: BookingErrors;
  onChange: (key: NewCustomerKey, value: string) => void;
}

export function NewCustomerFields({
  state,
  errors,
  onChange,
}: NewCustomerFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <SmallField label="Name" error={errors.newCustomerName}>
        <Input
          value={state.newCustomerName}
          onChange={(e) => onChange("newCustomerName", e.target.value)}
          placeholder="Customer's full name"
          aria-label="New customer name"
        />
      </SmallField>
      <div className="grid grid-cols-2 gap-3">
        <SmallField label="Date of birth" error={errors.newCustomerDob}>
          <Input
            type="date"
            value={state.newCustomerDob}
            onChange={(e) => onChange("newCustomerDob", e.target.value)}
            aria-label="New customer date of birth"
          />
        </SmallField>
        <SmallField label="Email" error={errors.newCustomerEmail}>
          <Input
            type="email"
            value={state.newCustomerEmail}
            onChange={(e) => onChange("newCustomerEmail", e.target.value)}
            placeholder="name@example.com"
            aria-label="New customer email"
          />
        </SmallField>
      </div>
      <p className="text-xs text-text-muted">
        They&apos;ll receive a welcome email with a link to set their password.
      </p>
    </div>
  );
}

/** Flips the drawer between picking an existing customer and creating one. */
export function CustomerModeToggle({
  mode,
  onToggle,
}: {
  mode: BookingFormState["customerMode"];
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="-mt-3 self-start text-xs font-medium text-text-muted underline underline-offset-2 hover:text-foreground"
      onClick={onToggle}
    >
      {mode === "new" ? "Pick existing customer" : "New customer"}
    </button>
  );
}

function SmallField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-bb-crimson">{error}</p> : null}
    </div>
  );
}
