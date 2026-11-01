import { describe, expect, it } from "vitest";
import { coerceFields, type FieldSpec } from "./coerce";

const SPEC: FieldSpec[] = [
  { name: "title", kind: "string" },
  { name: "bio", kind: "string", nullable: true },
  { name: "sortOrder", kind: "int" },
  { name: "pricePence", kind: "int", nullable: true },
  { name: "feePence", kind: "pounds", nullable: true },
  { name: "depositPence", kind: "pounds" },
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
        feePence: "45.50",
        depositPence: "20",
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
      feePence: 4550,
      depositPence: 2000,
      featured: true,
      styles: ["Traditional", "Blackwork", "Fineline"],
    });
  });

  it("maps empty nullable fields to null and empty int to 0 when not nullable", () => {
    const out = coerceFields(
      fd({
        title: "X",
        bio: "",
        sortOrder: "",
        pricePence: "",
        feePence: "",
        depositPence: "",
        styles: "",
      }),
      SPEC,
    );
    expect(out.bio).toBeNull();
    expect(out.pricePence).toBeNull();
    expect(out.feePence).toBeNull();
    expect(out.depositPence).toBe(0);
    expect(out.sortOrder).toBe(0);
    expect(out.featured).toBe(false);
    expect(out.styles).toEqual([]);
  });
});

describe("coerceFields pounds", () => {
  it("rounds to the nearest penny and rejects garbage", () => {
    const spec: FieldSpec[] = [
      { name: "a", kind: "pounds", nullable: true },
      { name: "b", kind: "pounds", nullable: true },
    ];
    const out = coerceFields(fd({ a: "12.345", b: "twelve" }), spec);
    expect(out.a).toBe(1235);
    expect(out.b).toBeNull();
  });
});

describe("coerceFields date", () => {
  it("parses studio-time dates and nulls blank or garbage", () => {
    const spec: FieldSpec[] = [
      { name: "a", kind: "date", nullable: true },
      { name: "b", kind: "date", nullable: true },
      { name: "c", kind: "date", nullable: true },
    ];
    const out = coerceFields(
      fd({ a: "2026-11-14 18:00", b: "", c: "Sat 7 Jun" }),
      spec,
    );
    expect(out.a).toEqual(new Date("2026-11-14T18:00:00Z"));
    expect(out.b).toBeNull();
    expect(out.c).toBeNull();
  });
});
