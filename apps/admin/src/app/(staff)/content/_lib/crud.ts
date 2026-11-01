"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { requireRole } from "@bnb/core/auth";
import {
  coerceFields,
  fieldLabel,
  requiredError,
  type CoercedValue,
  type FieldSpec,
} from "./coerce";
import {
  fail,
  knownDbError,
  OK,
  uniqueViolationFields,
  violates,
  withArticle,
  type ActionResult,
} from "./db-errors";

/**
 * Owner-gated content CRUD server actions over a single prisma model. Section
 * pages bind a model + field spec + revalidate path via `.bind(null, cfg)` and
 * pass the bound action to the client `CrudSection`. Centralising the auth gate
 * + coercion + revalidate keeps every section page thin.
 *
 * Owner mistakes (blank required field, duplicate title, stale row) come back
 * as `{ ok: false, error }` for the form to show beside Save; anything else
 * still throws to the admin error boundary.
 *
 * This is a `"use server"` module so each exported async function is a valid
 * server action reference that can be handed to a client component.
 */

export interface CrudConfig {
  model: string;
  spec: FieldSpec[];
  revalidate: string;
  /** Singular noun for messages, e.g. "gallery item" (defaults to "entry"). */
  noun?: string;
}

interface ModelDelegate {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  update: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
}

function delegate(model: string): ModelDelegate {
  const d = (prisma as unknown as Record<string, ModelDelegate>)[model];
  if (!d) throw new Error(`Unknown content model: ${model}`);
  return d;
}

/**
 * Owner-facing message for a known Prisma failure, or null to rethrow.
 * Duplicates name the clashing field: strings read "A gallery item with that
 * title already exists.", ints quote the value ("Aftercare stage order 3 is
 * already used.").
 */
function friendlyError(
  err: unknown,
  cfg: CrudConfig,
  data: Record<string, CoercedValue>,
): string | null {
  const fields = uniqueViolationFields(err);
  if (fields) {
    const noun = cfg.noun ?? "entry";
    const f = cfg.spec.find((s) => violates(fields, s.name));
    if (!f) return `${withArticle(noun)} with those details already exists.`;
    const label = fieldLabel(f).toLowerCase();
    if (f.kind === "int") {
      const Noun = `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
      return `${Noun} ${label} ${String(data[f.name])} is already used.`;
    }
    return `${withArticle(noun)} with that ${label} already exists.`;
  }
  return knownDbError(err);
}

async function write(
  cfg: CrudConfig,
  data: Record<string, CoercedValue>,
  run: () => Promise<unknown>,
): Promise<ActionResult> {
  try {
    await run();
  } catch (err) {
    const message = friendlyError(err, cfg, data);
    if (message) return fail(message);
    throw err;
  }
  revalidatePath(cfg.revalidate);
  return OK;
}

export async function createRow(
  cfg: CrudConfig,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("OWNER");
  const data = coerceFields(fd, cfg.spec);
  const invalid = requiredError(data, cfg.spec);
  if (invalid) return fail(invalid);
  return write(cfg, data, () => delegate(cfg.model).create({ data }));
}

export async function updateRow(
  cfg: CrudConfig,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const data = coerceFields(fd, cfg.spec);
  const invalid = requiredError(data, cfg.spec);
  if (invalid) return fail(invalid);
  return write(cfg, data, () =>
    delegate(cfg.model).update({ where: { id }, data }),
  );
}

export async function deleteRow(
  cfg: CrudConfig,
  fd: FormData,
): Promise<ActionResult> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  return write(cfg, {}, () => delegate(cfg.model).delete({ where: { id } }));
}
