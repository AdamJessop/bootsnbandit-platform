import { describe, expect, it } from "vitest";
import { buildDefaults, type CrudField } from "./CrudSection";

const FIELDS: CrudField[] = [
  { name: "title", label: "Title", type: "text" },
  { name: "featured", label: "Featured", type: "checkbox" },
  { name: "sortOrder", label: "Order", type: "number", defaultValue: 0 },
  { name: "image", label: "Image", type: "image" },
];

describe("buildDefaults", () => {
  it("derives an empty draft from field definitions", () => {
    expect(buildDefaults(FIELDS)).toEqual({
      title: "",
      featured: false,
      sortOrder: 0,
      image: "",
    });
  });

  it("seeds from an existing row when editing", () => {
    const draft = buildDefaults(FIELDS, {
      title: "Snake",
      featured: true,
      sortOrder: 3,
      image: "/uploads/x.png",
    });
    expect(draft).toEqual({
      title: "Snake",
      featured: true,
      sortOrder: 3,
      image: "/uploads/x.png",
    });
  });

  it("falls back to field defaults for missing row keys", () => {
    const draft = buildDefaults(FIELDS, { title: "Partial" });
    expect(draft.featured).toBe(false);
    expect(draft.sortOrder).toBe(0);
  });
});
