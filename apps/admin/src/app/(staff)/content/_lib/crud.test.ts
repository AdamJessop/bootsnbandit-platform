import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldSpec } from "./coerce";

vi.mock("server-only", () => ({}));

const create = vi.fn();
const update = vi.fn();
const del = vi.fn();
const revalidatePath = vi.fn();
const requireRole = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: { faq: { create, update, delete: del } },
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));

const SPEC: FieldSpec[] = [
  { name: "question", kind: "string" },
  { name: "answer", kind: "string" },
  { name: "sortOrder", kind: "int" },
];
const CFG = { model: "faq", spec: SPEC, revalidate: "/content/faq" };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("content CRUD actions", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ id: "x" });
    update.mockReset().mockResolvedValue({ id: "x" });
    del.mockReset().mockResolvedValue({ id: "x" });
    revalidatePath.mockReset();
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
  });
  afterEach(() => vi.resetModules());

  it("creates a row with coerced fields and revalidates", async () => {
    const { createRow } = await import("./crud");
    await createRow(CFG, fd({ question: "Q", answer: "A", sortOrder: "2" }));
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(create).toHaveBeenCalledWith({
      data: { question: "Q", answer: "A", sortOrder: 2 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/content/faq");
  });

  it("updates by id", async () => {
    const { updateRow } = await import("./crud");
    await updateRow(
      CFG,
      fd({ id: "f1", question: "Q2", answer: "A2", sortOrder: "1" }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { question: "Q2", answer: "A2", sortOrder: 1 },
    });
  });

  it("deletes by id", async () => {
    const { deleteRow } = await import("./crud");
    await deleteRow(CFG, fd({ id: "f1" }));
    expect(del).toHaveBeenCalledWith({ where: { id: "f1" } });
  });
});
