import { describe, expect, it } from "vitest";
import { buildDefaults, cellLabel, type CrudField } from "./CrudSection";

const FIELDS: CrudField[] = [
  { name: "title", label: "Title", type: "text" },
  { name: "featured", label: "Featured", type: "checkbox" },
  { name: "sortOrder", label: "Order", type: "number", defaultValue: 0 },
  { name: "image", label: "Image", type: "image" },
  { name: "pricePence", label: "Price (£)", type: "money" },
  {
    name: "artistId",
    label: "Artist",
    type: "select",
    defaultValue: "",
    options: [
      { value: "", label: "No artist" },
      { value: "a1", label: "Sarah Boots" },
    ],
  },
];

describe("buildDefaults", () => {
  it("derives an empty draft from field definitions", () => {
    expect(buildDefaults(FIELDS)).toEqual({
      title: "",
      featured: false,
      sortOrder: 0,
      image: "",
      pricePence: "",
      artistId: "",
    });
  });

  it("seeds from an existing row when editing", () => {
    const draft = buildDefaults(FIELDS, {
      title: "Snake",
      featured: true,
      sortOrder: 3,
      image: "/uploads/x.png",
      pricePence: 4550,
      artistId: "a1",
    });
    expect(draft).toEqual({
      title: "Snake",
      featured: true,
      sortOrder: 3,
      image: "/uploads/x.png",
      pricePence: "45.50",
      artistId: "a1",
    });
  });

  it("falls back to field defaults for missing row keys", () => {
    const draft = buildDefaults(FIELDS, { title: "Partial" });
    expect(draft.featured).toBe(false);
    expect(draft.sortOrder).toBe(0);
  });
});

describe("cellLabel", () => {
  const money = FIELDS.find((f) => f.name === "pricePence")!;
  const select = FIELDS.find((f) => f.name === "artistId")!;
  const text = FIELDS[0];

  it("renders money fields as pounds", () => {
    expect(cellLabel(money, 13000)).toBe("£130");
    expect(cellLabel(money, 4550)).toBe("£45.50");
    expect(cellLabel(money, null)).toBe("—");
  });

  it("renders select fields by option label, falling back to the raw value", () => {
    expect(cellLabel(select, "a1")).toBe("Sarah Boots");
    expect(cellLabel(select, null)).toBe("—");
    expect(cellLabel(select, "unknown")).toBe("unknown");
  });

  it("leaves plain fields alone", () => {
    expect(cellLabel(text, "Snake")).toBe("Snake");
    expect(cellLabel(text, undefined)).toBe("—");
  });
});
