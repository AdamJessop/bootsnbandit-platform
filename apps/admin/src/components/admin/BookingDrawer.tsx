"use client";

/**
 * Booking create/edit drawer (BACKOFHOUSE-IA C3). A shadcn Sheet hosting the
 * customer (pick existing or create inline) / artist / type / style /
 * placement / window / price / notes / status form. Field maths live in
 * ./booking-form; saving is delegated to the parent via `onSave`.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DURATION_OPTIONS,
  draftToPayload,
  formatPence,
  parsePounds,
  suggestedPricePounds,
  validateDraft,
  type BookingFormState,
  type BookingPayload,
  type BookingStatus,
  type BookingType,
} from "./booking-form";
import { initialState, type BookingDraft } from "./booking-drawer-state";
import { CustomerModeToggle, NewCustomerFields } from "./NewCustomerFields";

export type { BookingDraft } from "./booking-drawer-state";

/** Minimal option shape for the customer/artist pickers. */
export interface NamedOption {
  id: string;
  name: string;
  /** Artist rates (optional) — drive the session price suggestion. */
  hourlyRatePence?: number | null;
  dayRatePence?: number | null;
}

export interface BookingDrawerProps {
  open: boolean;
  /** Existing booking when editing; omit to create. */
  booking?: BookingDraft;
  /** Customer directory for the search-or-pick control. */
  customers?: NamedOption[];
  /** Artists the current user may book for. */
  artists?: NamedOption[];
  /** Pre-selected artist (calendar's active artist). */
  defaultArtistId?: string;
  /** Persist; returns an error message to display, or null on success. */
  onSave: (payload: BookingPayload, id?: string) => Promise<string | null>;
  onClose: () => void;
}

const STATUS_OPTIONS: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
const TYPE_OPTIONS: BookingType[] = ["consult", "session", "flash"];

export function BookingDrawer({
  open,
  booking,
  customers = [],
  artists = [],
  defaultArtistId,
  onSave,
  onClose,
}: BookingDrawerProps) {
  const [state, setState] = useState<BookingFormState>(() =>
    initialState(booking, defaultArtistId),
  );
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Re-seed when the drawer is (re)opened for a different booking/slot.
  useEffect(() => {
    if (open) {
      setState(initialState(booking, defaultArtistId));
      setErrors({});
      setFormError(null);
    }
  }, [open, booking, defaultArtistId]);

  // Pre-fill the (still editable) price estimate from the selected artist's
  // rates + duration. Only seeds when the field is blank so a typed override is
  // never clobbered.
  useEffect(() => {
    const artist = artists.find((a) => a.id === state.artistId);
    if (!artist) return;
    const suggestion = suggestedPricePounds(
      {
        hourlyRatePence: artist.hourlyRatePence,
        dayRatePence: artist.dayRatePence,
      },
      state.durationMins,
    );
    if (!suggestion) return;
    setState((s) =>
      s.priceEstimatePounds.trim() === ""
        ? { ...s, priceEstimatePounds: suggestion }
        : s,
    );
  }, [artists, state.artistId, state.durationMins]);

  // Let the closed Select triggers render names, not cuids.
  const customerItems = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.name })),
    [customers],
  );
  const artistItems = useMemo(
    () => artists.map((a) => ({ value: a.id, label: a.name })),
    [artists],
  );

  const isEdit = Boolean(booking?.id);
  const pricePreview = useMemo(() => {
    const pence = parsePounds(state.priceEstimatePounds);
    return pence != null ? formatPence(pence) : "—";
  }, [state.priceEstimatePounds]);

  const set = <K extends keyof BookingFormState>(
    key: K,
    value: BookingFormState[K],
  ) => setState((s) => ({ ...s, [key]: value }));

  async function handleSave() {
    const found = validateDraft(state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFormError(null);
    try {
      const message = await onSave(draftToPayload(state), booking?.id);
      if (message) {
        setFormError(message);
        return;
      }
      onClose();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="font-termina uppercase tracking-wide">
            {isEdit ? "Edit booking" : "New booking"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Adjust the details and save."
              : "Fill the details to book this slot."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-2">
          {state.customerMode === "new" && !isEdit ? (
            <NewCustomerFields state={state} errors={errors} onChange={set} />
          ) : (
            <Field label="Customer" error={errors.customerId}>
              <Select
                items={customerItems}
                value={state.customerId}
                onValueChange={(v) => set("customerId", v ?? "")}
              >
                <SelectTrigger aria-label="Customer">
                  <SelectValue placeholder="Search or pick a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {!isEdit ? (
            <CustomerModeToggle
              mode={state.customerMode}
              onToggle={() =>
                set(
                  "customerMode",
                  state.customerMode === "new" ? "existing" : "new",
                )
              }
            />
          ) : null}

          <Field label="Artist" error={errors.artistId}>
            <Select
              items={artistItems}
              value={state.artistId}
              onValueChange={(v) => set("artistId", v ?? "")}
            >
              <SelectTrigger aria-label="Artist">
                <SelectValue placeholder="Pick an artist" />
              </SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={state.type}
                onValueChange={(v) => set("type", v as BookingType)}
              >
                <SelectTrigger aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={state.status}
                onValueChange={(v) => set("status", v as BookingStatus)}
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Style">
              <Input
                value={state.style}
                onChange={(e) => set("style", e.target.value)}
                placeholder="e.g. Traditional"
              />
            </Field>
            <Field label="Placement">
              <Input
                value={state.placement}
                onChange={(e) => set("placement", e.target.value)}
                placeholder="e.g. Forearm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={errors.date}>
              <Input
                type="date"
                value={state.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Start" error={errors.time}>
              <Input
                type="time"
                value={state.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration" error={errors.durationMins}>
              <Select
                value={String(state.durationMins)}
                onValueChange={(v) => set("durationMins", Number(v))}
              >
                <SelectTrigger aria-label="Duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m < 60 ? `${m} min` : `${m / 60} hr`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={`Price estimate (${pricePreview})`}
              error={errors.priceEstimatePounds}
            >
              <Input
                inputMode="decimal"
                value={state.priceEstimatePounds}
                onChange={(e) => set("priceEstimatePounds", e.target.value)}
                placeholder="£ e.g. 120"
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={state.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Anything the artist should know"
            />
          </Field>

          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-bb-crimson/40 bg-bb-crimson/10 px-3 py-2 text-sm text-bb-crimson"
            >
              {formError}
            </p>
          ) : null}
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create booking"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
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
