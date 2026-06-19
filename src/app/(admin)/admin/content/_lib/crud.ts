"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { coerceFields, type FieldSpec } from "./coerce";

/**
 * Owner-gated content CRUD server actions over a single prisma model. Section
 * pages bind a model + field spec + revalidate path via `.bind(null, cfg)` and
 * pass the bound action to the client `CrudSection`. Centralising the auth gate
 * + coercion + revalidate keeps every section page thin.
 *
 * This is a `"use server"` module so each exported async function is a valid
 * server action reference that can be handed to a client component.
 */

export interface CrudConfig {
  model: string;
  spec: FieldSpec[];
  revalidate: string;
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

export async function createRow(cfg: CrudConfig, fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const data = coerceFields(fd, cfg.spec);
  await delegate(cfg.model).create({ data });
  revalidatePath(cfg.revalidate);
}

export async function updateRow(cfg: CrudConfig, fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const data = coerceFields(fd, cfg.spec);
  await delegate(cfg.model).update({ where: { id }, data });
  revalidatePath(cfg.revalidate);
}

export async function deleteRow(cfg: CrudConfig, fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await delegate(cfg.model).delete({ where: { id } });
  revalidatePath(cfg.revalidate);
}
