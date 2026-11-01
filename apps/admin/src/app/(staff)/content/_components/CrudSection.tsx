"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@bnb/core/utils";
import type { ActionResult } from "../_lib/db-errors";
import { formatPounds, penceToPounds } from "../_lib/money";
import { focusFormStart } from "./focus-form";

/**
 * Generic content-CMS editor (J1–J6): a table of existing rows + an inline
 * create/edit form built from declarative field definitions. CRUD is performed
 * via server actions passed by the section's server page (which revalidates).
 * `image` fields render the shared ImageUploader (POST /api/uploads) and the
 * first one also gets a thumbnail column so missing photos stand out.
 * `money` fields are stored as integer pence but presented/edited in pounds —
 * the draft holds the pounds string and the server spec (`kind: "pounds"`)
 * converts back. `select` fields show their option label in the table.
 *
 * Save stays disabled while a `required` field is blank or an image is still
 * uploading; an action's `{ ok: false, error }` is shown beside Save (or above
 * the table for deletes). Delete is two taps: the bin turns into "Confirm
 * delete?". Opening the form scrolls it into view — on a phone it sits below
 * the whole table.
 */

export type CrudFieldType =
  | "text"
  | "number"
  | "textarea"
  | "checkbox"
  | "image"
  | "select"
  | "money";

export interface CrudField {
  name: string;
  label: string;
  type: CrudFieldType;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Short helper line under the input. */
  hint?: string;
  required?: boolean;
  /** Hide from the row table (still editable in the form). */
  hideInTable?: boolean;
}

export type CrudRow = Record<string, unknown> & { id: string };
type Draft = Record<string, string | number | boolean>;
type CrudAction = (fd: FormData) => Promise<ActionResult>;

export interface CrudSectionProps {
  fields: CrudField[];
  rows: CrudRow[];
  createAction: CrudAction;
  updateAction: CrudAction;
  deleteAction: CrudAction;
  /** Column to show first in the table (defaults to first non-hidden field). */
  titleField?: string;
  emptyLabel?: string;
}

const NETWORK_ERROR =
  "Couldn't reach the server — check your connection and try again.";

/** Build an editable draft from field defaults, optionally seeded by a row. */
export function buildDefaults(
  fields: CrudField[],
  row?: Record<string, unknown>,
): Draft {
  const draft: Draft = {};
  for (const f of fields) {
    const fromRow = row?.[f.name];
    if (fromRow !== undefined && fromRow !== null) {
      if (f.type === "checkbox") draft[f.name] = Boolean(fromRow);
      else if (f.type === "number") draft[f.name] = Number(fromRow);
      else if (f.type === "money")
        draft[f.name] = penceToPounds(Number(fromRow));
      else draft[f.name] = String(fromRow);
      continue;
    }
    if (f.defaultValue !== undefined) draft[f.name] = f.defaultValue;
    else if (f.type === "checkbox") draft[f.name] = false;
    else if (f.type === "number") draft[f.name] = 0;
    else draft[f.name] = "";
  }
  return draft;
}

/** Required fields the draft leaves blank (whitespace counts as blank). */
export function missingRequired(
  fields: CrudField[],
  draft: Draft,
): CrudField[] {
  return fields.filter(
    (f) =>
      f.required &&
      f.type !== "checkbox" &&
      String(draft[f.name] ?? "").trim() === "",
  );
}

/** The field whose image is shown as the table's thumbnail column, if any. */
export function thumbnailField(fields: CrudField[]): CrudField | undefined {
  return fields.find((f) => f.type === "image");
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}

/** Table cell text for a field: pence → £, select value → option label. */
export function cellLabel(field: CrudField, value: unknown): string {
  if (field.type === "money") {
    return formatPounds(typeof value === "number" ? value : null);
  }
  if (field.type === "select" && value !== null && value !== undefined) {
    const opt = field.options?.find((o) => o.value === String(value));
    if (opt) return opt.label;
  }
  return cellText(value);
}

function Thumbnail({ src }: { src: unknown }) {
  if (typeof src === "string" && src !== "") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-10 w-10 rounded-md border border-border-default object-cover"
      />
    );
  }
  return (
    <span className="grid h-10 w-10 place-items-center rounded-md border border-dashed border-bb-crimson/60 text-center text-[9px] font-bold uppercase leading-tight text-bb-crimson">
      No image
    </span>
  );
}

export function CrudSection({
  fields,
  rows,
  createAction,
  updateAction,
  deleteAction,
  titleField,
  emptyLabel = "No entries yet.",
}: CrudSectionProps) {
  const [editing, setEditing] = useState<CrudRow | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const tableFields = fields.filter((f) => !f.hideInTable).slice(0, 4);
  const primary = titleField ?? tableFields[0]?.name;
  const thumb = thumbnailField(fields);
  const columnCount = tableFields.length + (thumb ? 2 : 1);
  const missing = editing === null ? [] : missingRequired(fields, draft);
  const isUploading = Object.values(uploading).some(Boolean);

  useEffect(() => {
    if (editing !== null) focusFormStart(formRef.current);
  }, [editing]);

  function open(row: CrudRow | "new") {
    setDraft(buildDefaults(fields, row === "new" ? undefined : row));
    setFormError(null);
    setUploading({});
    setConfirmingId(null);
    setEditing(row);
  }

  function close() {
    setEditing(null);
    setFormError(null);
    setUploading({});
  }

  function submit() {
    if (missing.length > 0 || isUploading) return;
    const isNew = editing === "new";
    const fd = new FormData();
    if (!isNew && editing) fd.set("id", editing.id);
    for (const f of fields) {
      const v = draft[f.name];
      if (f.type === "checkbox") {
        if (v) fd.set(f.name, "on");
      } else {
        fd.set(f.name, String(v ?? ""));
      }
    }
    setFormError(null);
    startTransition(async () => {
      try {
        const res = await (isNew ? createAction(fd) : updateAction(fd));
        if (res.ok) setEditing(null);
        else setFormError(res.error);
      } catch {
        setFormError(NETWORK_ERROR);
      }
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    setListError(null);
    startTransition(async () => {
      try {
        const res = await deleteAction(fd);
        if (!res.ok) setListError(res.error);
        else if (editing !== null && editing !== "new" && editing.id === id)
          setEditing(null);
      } catch {
        setListError(NETWORK_ERROR);
      }
      setConfirmingId(null);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{rows.length} entries</p>
        <Button
          type="button"
          onClick={() => open("new")}
          className="gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {listError && (
        <p
          role="alert"
          className="rounded-md border border-bb-crimson/40 bg-bb-crimson/10 px-3 py-2 text-sm text-text-primary"
        >
          {listError}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="bg-bg-raised text-left font-termina text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              {thumb && <th className="w-14 px-4 py-2.5">{thumb.label}</th>}
              {tableFields.map((f) => (
                <th key={f.name} className="px-4 py-2.5">
                  {f.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-text-muted"
                  colSpan={columnCount}
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border-default hover:bg-bg-raised/50"
              >
                {thumb && (
                  <td className="px-4 py-2">
                    <Thumbnail src={row[thumb.name]} />
                  </td>
                )}
                {tableFields.map((f) => (
                  <td
                    key={f.name}
                    className={cn(
                      "px-4 py-2.5 text-text-secondary",
                      f.name === primary && "font-medium text-text-primary",
                    )}
                  >
                    {cellLabel(f, row[f.name])}
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => open(row)}
                      aria-label="Edit"
                      className="grid h-8 w-8 place-items-center rounded-md border border-border-default text-text-secondary hover:text-bb-gold"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {confirmingId === row.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          disabled={pending}
                          className="h-8 whitespace-nowrap rounded-md border border-bb-crimson bg-bb-crimson px-2.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {pending ? "Deleting…" : "Confirm delete?"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          aria-label="Keep"
                          className="grid h-8 w-8 place-items-center rounded-md border border-border-default text-text-secondary hover:text-text-primary"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(row.id)}
                        aria-label="Delete"
                        className="grid h-8 w-8 place-items-center rounded-md border border-border-default text-text-secondary hover:text-bb-crimson"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div
          // Remount per row so an in-flight upload can't land in another draft.
          key={editing === "new" ? "new" : editing.id}
          ref={formRef}
          className="scroll-mt-20 rounded-lg border border-bb-crimson/30 bg-bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
              {editing === "new" ? "New entry" : "Edit entry"}
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Cancel"
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div
                key={f.name}
                className={cn(
                  (f.type === "textarea" || f.type === "image") &&
                    "sm:col-span-2",
                )}
              >
                <Label htmlFor={`f-${f.name}`} className="mb-1.5 block">
                  {f.label}
                  {f.required && (
                    <span aria-hidden className="ml-0.5 text-bb-crimson">
                      *
                    </span>
                  )}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={`f-${f.name}`}
                    required={f.required}
                    value={String(draft[f.name] ?? "")}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.name]: e.target.value }))
                    }
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    id={`f-${f.name}`}
                    type="checkbox"
                    checked={Boolean(draft[f.name])}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.name]: e.target.checked }))
                    }
                    className="h-5 w-5 rounded border-border-strong"
                  />
                ) : f.type === "select" ? (
                  <select
                    id={`f-${f.name}`}
                    required={f.required}
                    value={String(draft[f.name] ?? "")}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.name]: e.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary"
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "image" ? (
                  <ImageUploader
                    value={String(draft[f.name] ?? "")}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        [f.name]: Array.isArray(v) ? (v[0] ?? "") : v,
                      }))
                    }
                    onUploadingChange={(busy) =>
                      setUploading((u) => ({ ...u, [f.name]: busy }))
                    }
                  />
                ) : f.type === "money" ? (
                  <div className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted"
                    >
                      £
                    </span>
                    <Input
                      id={`f-${f.name}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      className="pl-6"
                      required={f.required}
                      value={String(draft[f.name] ?? "")}
                      placeholder={f.placeholder ?? "0.00"}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [f.name]: e.target.value }))
                      }
                    />
                  </div>
                ) : (
                  <Input
                    id={`f-${f.name}`}
                    type={f.type === "number" ? "number" : "text"}
                    required={f.required}
                    value={String(draft[f.name] ?? "")}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [f.name]:
                          f.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                  />
                )}
                {f.hint && (
                  <p className="mt-1 text-xs text-text-muted">{f.hint}</p>
                )}
              </div>
            ))}
          </div>
          {formError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-bb-crimson/40 bg-bb-crimson/10 px-3 py-2 text-sm text-text-primary"
            >
              {formError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={submit}
              disabled={pending || isUploading || missing.length > 0}
            >
              {pending ? "Saving…" : isUploading ? "Uploading…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            {missing.length > 0 && (
              <p className="text-xs text-text-muted">
                Fill in {missing.map((f) => f.label).join(", ")} to save.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
