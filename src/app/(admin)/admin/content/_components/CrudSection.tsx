"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Generic content-CMS editor (J1–J6): a table of existing rows + an inline
 * create/edit form built from declarative field definitions. CRUD is performed
 * via server actions passed by the section's server page (which revalidates).
 * `image` fields render the shared ImageUploader (POST /api/uploads).
 */

export type CrudFieldType =
  | "text"
  | "number"
  | "textarea"
  | "checkbox"
  | "image"
  | "select";

export interface CrudField {
  name: string;
  label: string;
  type: CrudFieldType;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Hide from the row table (still editable in the form). */
  hideInTable?: boolean;
}

export type CrudRow = Record<string, unknown> & { id: string };
type Draft = Record<string, string | number | boolean>;

export interface CrudSectionProps {
  fields: CrudField[];
  rows: CrudRow[];
  createAction: (fd: FormData) => Promise<void>;
  updateAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
  /** Column to show first in the table (defaults to first non-hidden field). */
  titleField?: string;
  emptyLabel?: string;
}

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

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
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
  const [pending, startTransition] = useTransition();

  const tableFields = fields.filter((f) => !f.hideInTable).slice(0, 4);
  const primary = titleField ?? tableFields[0]?.name;

  function open(row: CrudRow | "new") {
    setDraft(buildDefaults(fields, row === "new" ? undefined : row));
    setEditing(row);
  }

  function submit() {
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
    startTransition(async () => {
      await (isNew ? createAction(fd) : updateAction(fd));
      setEditing(null);
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteAction(fd);
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

      <div className="overflow-x-auto rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="bg-bg-raised text-left font-termina text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
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
                  colSpan={tableFields.length + 1}
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
                {tableFields.map((f) => (
                  <td
                    key={f.name}
                    className={cn(
                      "px-4 py-2.5 text-text-secondary",
                      f.name === primary && "font-medium text-text-primary",
                    )}
                  >
                    {cellText(row[f.name])}
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
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      aria-label="Delete"
                      className="grid h-8 w-8 place-items-center rounded-md border border-border-default text-text-secondary hover:text-bb-crimson"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="rounded-lg border border-bb-crimson/30 bg-bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
              {editing === "new" ? "New entry" : "Edit entry"}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
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
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={`f-${f.name}`}
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
                  />
                ) : (
                  <Input
                    id={`f-${f.name}`}
                    type={f.type === "number" ? "number" : "text"}
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
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
