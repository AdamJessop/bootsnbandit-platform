"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { artistStatusLabel } from "@bnb/core/artist-status";
import type { ActionResult } from "../../_lib/db-errors";
import { focusFormStart } from "../../_components/focus-form";
import { ArtistForm } from "./ArtistForm";
import {
  draftToFormData,
  emptyDraft,
  fromRow,
  hiddenDraft,
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
 *
 * Deleting an artist cascades to their bookings (and those bookings' consent
 * forms), leave and availability, so the bin opens a warning row first that
 * offers "Hide from site" (active = false) as the safe alternative.
 */

export type { ArtistRow, StyleOption } from "./artist-draft";

type ArtistAction = (fd: FormData) => Promise<ActionResult>;

export interface ArtistEditorProps {
  rows: ArtistRow[];
  styles: StyleOption[];
  createAction: ArtistAction;
  updateAction: ArtistAction;
  deleteAction: ArtistAction;
}

const NETWORK_ERROR =
  "Couldn't reach the server — check your connection and try again.";

export const DELETE_WARNING =
  "Deleting also permanently deletes this artist's bookings, consent forms and leave. To take them off the website but keep their history, hide them instead.";

export function ArtistEditor({
  rows,
  styles,
  createAction,
  updateAction,
  deleteAction,
}: ArtistEditorProps) {
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const isNew = editing === "new";

  useEffect(() => {
    if (editing !== null) focusFormStart(formRef.current);
  }, [editing]);

  function open(row: ArtistRow | "new") {
    setDraft(row === "new" ? emptyDraft() : fromRow(row));
    setFormError(null);
    setConfirmingId(null);
    setEditing(row === "new" ? "new" : row.id);
  }

  function close() {
    setEditing(null);
    setFormError(null);
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

  /** Run a roster action (delete / hide), surfacing failures above the table. */
  function rowAction(action: ArtistAction, fd: FormData, id: string) {
    setListError(null);
    startTransition(async () => {
      try {
        const res = await action(fd);
        if (!res.ok) setListError(res.error);
        else if (editing === id) setEditing(null);
      } catch {
        setListError(NETWORK_ERROR);
      }
      setConfirmingId(null);
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    rowAction(deleteAction, fd, id);
  }

  function hide(row: ArtistRow) {
    rowAction(updateAction, draftToFormData(hiddenDraft(row), false), row.id);
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
              <Fragment key={row.id}>
                <tr className="border-t border-border-default hover:bg-bg-raised/50">
                  <td className="px-4 py-2.5 font-medium text-text-primary">
                    {row.name}
                    {!row.active && (
                      <span className="ml-2 rounded-full border border-border-strong px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                        Hidden
                      </span>
                    )}
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
                        onClick={() =>
                          setConfirmingId(
                            confirmingId === row.id ? null : row.id,
                          )
                        }
                        aria-label="Delete"
                        aria-expanded={confirmingId === row.id}
                        className="grid h-8 w-8 place-items-center rounded-md border border-border-default text-text-secondary hover:text-bb-crimson"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {confirmingId === row.id && (
                  <tr className="bg-bb-crimson/5">
                    <td colSpan={5} className="px-4 py-3">
                      <p role="alert" className="text-sm text-text-primary">
                        <strong>Delete {row.name}?</strong> {DELETE_WARNING}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.active && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={pending}
                            onClick={() => hide(row)}
                          >
                            <EyeOff className="h-4 w-4" /> Hide from site
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => remove(row.id)}
                        >
                          {pending ? "Working…" : "Confirm delete"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setConfirmingId(null)}
                        >
                          <X className="h-4 w-4" /> Keep
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div
          ref={formRef}
          className="scroll-mt-20 rounded-lg border border-bb-crimson/30 bg-bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
              {isNew ? "Add artist" : "Edit artist"}
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
          <ArtistForm
            // Remount per artist so an in-flight headshot upload can't land
            // in another artist's draft.
            key={editing}
            draft={draft}
            styles={styles}
            isNew={isNew}
            pending={pending}
            error={formError}
            onChange={patch}
            onToggleStyle={toggleStyle}
            onSubmit={submit}
            onCancel={close}
          />
        </div>
      )}
    </div>
  );
}
