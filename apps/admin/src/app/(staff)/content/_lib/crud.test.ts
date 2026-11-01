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

/** A Prisma 7 (pg driver adapter) unique-constraint error on `fields`. */
function p2002(fields: string[]) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { driverAdapterError: { cause: { constraint: { fields } } } },
  });
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
    const res = await createRow(
      CFG,
      fd({ question: "Q", answer: "A", sortOrder: "2" }),
    );
    expect(res).toEqual({ ok: true });
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
    const res = await deleteRow(CFG, fd({ id: "f1" }));
    expect(res).toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith({ where: { id: "f1" } });
  });

  it("refuses a blank required field without touching the DB", async () => {
    const { createRow, updateRow } = await import("./crud");
    expect(await createRow(CFG, fd({ question: "  ", answer: "A" }))).toEqual({
      ok: false,
      error: "Question is required.",
    });
    expect(
      await updateRow(CFG, fd({ id: "f1", question: "Q", answer: "" })),
    ).toEqual({ ok: false, error: "Answer is required." });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("turns a duplicate string into an inline message naming the noun", async () => {
    create.mockRejectedValue(p2002(["question"]));
    const { createRow } = await import("./crud");
    const res = await createRow(
      { ...CFG, noun: "FAQ" },
      fd({ question: "Q", answer: "A" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "A FAQ with that question already exists.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("quotes the clashing value for a duplicate int (aftercare order)", async () => {
    const spec: FieldSpec[] = [
      { name: "order", kind: "int" },
      { name: "title", kind: "string" },
    ];
    update.mockRejectedValue(p2002(["order"]));
    const { updateRow } = await import("./crud");
    const res = await updateRow(
      { model: "faq", spec, revalidate: "/x", noun: "aftercare stage" },
      fd({ id: "s1", order: "3", title: "Day 3" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Aftercare stage order 3 is already used.",
    });
  });

  it("falls back to 'entry' and explains a stale row on delete", async () => {
    create.mockRejectedValue(p2002([]));
    del.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "P2025" }),
    );
    const { createRow, deleteRow } = await import("./crud");
    expect(await createRow(CFG, fd({ question: "Q", answer: "A" }))).toEqual({
      ok: false,
      error: "An entry with those details already exists.",
    });
    const res = await deleteRow(CFG, fd({ id: "gone" }));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/no longer exists/);
  });

  it("still throws unexpected errors to the error boundary", async () => {
    create.mockRejectedValue(new Error("connection refused"));
    const { createRow } = await import("./crud");
    await expect(
      createRow(CFG, fd({ question: "Q", answer: "A" })),
    ).rejects.toThrow("connection refused");
  });
});
