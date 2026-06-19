"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { artistStatusLabel } from "@bnb/core/artist-status";
import { ArtistForm } from "./ArtistForm";
import {
  draftToFormData,
  emptyDraft,
  fromRow,
  rateCell,
  type ArtistRow,
  type Draft,
  type StyleOption,
} from "./artist-draft";

/**
 * Unified Artist CMS editor: a roster of artist profiles (showing the status
 * label + £ rates) plus an inline create/edit form (ArtistForm). Creating an
 * artist also creates the linked staff User (email + access role) via the bound
 * server action's `prisma.$transaction`. Editing re-sets the style relation (by
 * id), the status enum and the numeric £ rates. Replaces the old generic CRUD
 * that used free-text role/rateText + a comma-joined styles string.
 */

export type { ArtistRow, StyleOption } from "./artist-draft";

export interface ArtistEditorProps {
  rows: ArtistRow[];
  styles: StyleOption[];
  createAction: (fd: FormData) => Promise<void>;
  updateAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
}

export function ArtistEditor({
  rows,
  styles,
  createAction,
  updateAction,
  deleteAction,
}: ArtistEditorProps) {
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, startTransition] = useTransition();

  const isNew = editing === "new";

  function open(row: ArtistRow | "new") {
    setDraft(row === "new" ? emptyDraft() : fromRow(row));
    setEditing(row === "new" ? "new" : row.id);
  }

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function toggleStyle(id: string) {
    setDraft((d) => ({
      ...d,
      styleIds: d.styleIds.includes(id)
        ? d.styleIds.filter((s) => s !== id)
        : [...d.styleIds, id],
    }));
  }

  function submit() {
    const fd = draftToFormData(draft, isNew);
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
        <p className="text-sm text-text-muted">{rows.length} artists</p>
        <Button
          type="button"
          onClick={() => open("new")}
          className="gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" /> Add artist
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="bg-bg-raised text-left font-termina text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Hourly</th>
              <th className="px-4 py-2.5">Day</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-text-muted"
                  colSpan={5}
                >
                  No artists yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border-default hover:bg-bg-raised/50"
              >
                <td className="px-4 py-2.5 font-medium text-text-primary">
                  {row.name}
                  <span className="ml-2 text-xs text-text-muted">
                    {row.email}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {artistStatusLabel(row.status)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {rateCell(row.hourlyRatePence)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {rateCell(row.dayRatePence)}
                </td>
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
              {isNew ? "Add artist" : "Edit artist"}
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
          <ArtistForm
            draft={draft}
            styles={styles}
            isNew={isNew}
            pending={pending}
            onChange={patch}
            onToggleStyle={toggleStyle}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
    </div>
  );
}
