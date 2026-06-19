import { describe, expect, it } from "vitest";
import { coerceFields, type FieldSpec } from "./coerce";

const SPEC: FieldSpec[] = [
  { name: "title", kind: "string" },
  { name: "bio", kind: "string", nullable: true },
  { name: "sortOrder", kind: "int" },
  { name: "pricePence", kind: "int", nullable: true },
  { name: "featured", kind: "bool" },
  { name: "styles", kind: "stringArray" },
];

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("coerceFields", () => {
  it("coerces strings, ints, bools and arrays from FormData", () => {
    const out = coerceFields(
      fd({
        title: "Snake",
        bio: "A bio",
        sortOrder: "3",
        pricePence: "12000",
        featured: "on",
        styles: "Traditional, Blackwork , Fineline",
      }),
      SPEC,
    );
    expect(out).toEqual({
      title: "Snake",
      bio: "A bio",
      sortOrder: 3,
      pricePence: 12000,
      featured: true,
      styles: ["Traditional", "Blackwork", "Fineline"],
    });
  });

  it("maps empty nullable fields to null and empty int to 0 when not nullable", () => {
    const out = coerceFields(
      fd({ title: "X", bio: "", sortOrder: "", pricePence: "", styles: "" }),
      SPEC,
    );
    expect(out.bio).toBeNull();
    expect(out.pricePence).toBeNull();
    expect(out.sortOrder).toBe(0);
    expect(out.featured).toBe(false);
    expect(out.styles).toEqual([]);
  });
});
