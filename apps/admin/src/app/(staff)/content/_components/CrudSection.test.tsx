import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildDefaults,
  cellLabel,
  CrudSection,
  missingRequired,
  thumbnailField,
  type CrudField,
} from "./CrudSection";
import { focusFormStart } from "./focus-form";

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

describe("missingRequired", () => {
  const fields: CrudField[] = [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "body", label: "Body", type: "textarea", required: true },
    { name: "style", label: "Style", type: "text" },
    { name: "live", label: "Live", type: "checkbox", required: true },
  ];

  it("lists blank and whitespace-only required fields", () => {
    const missing = missingRequired(fields, {
      title: "  ",
      body: "",
      style: "",
      live: false,
    });
    expect(missing.map((f) => f.name)).toEqual(["title", "body"]);
  });

  it("is empty once required fields are filled (checkboxes never block)", () => {
    expect(
      missingRequired(fields, { title: "Snake", body: "B", live: false }),
    ).toEqual([]);
  });
});

describe("thumbnailField", () => {
  it("finds the first image field, even when hidden from the table", () => {
    expect(thumbnailField(FIELDS)?.name).toBe("image");
    expect(thumbnailField([FIELDS[0]])).toBeUndefined();
  });
});

describe("CrudSection table", () => {
  const noop = vi.fn(async () => ({ ok: true as const }));
  const fields: CrudField[] = [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "image", label: "Image", type: "image", hideInTable: true },
  ];

  function render(f: CrudField[]) {
    return renderToStaticMarkup(
      <CrudSection
        fields={f}
        rows={[
          { id: "g1", title: "Snake", image: "/media/abc" },
          { id: "g2", title: "Rose", image: null },
        ]}
        createAction={noop}
        updateAction={noop}
        deleteAction={noop}
      />,
    );
  }

  it("shows a thumbnail for rows with an image and a 'No image' marker otherwise", () => {
    const html = render(fields);
    expect(html).toContain('src="/media/abc"');
    expect(html.match(/No image/g)).toHaveLength(1);
  });

  it("has no image column for sections without an image field", () => {
    const html = render([fields[0]]);
    expect(html).not.toContain("No image");
    expect(html).toContain("Snake");
  });

  it("renders Delete as the first of two steps (no confirm shown yet)", () => {
    const html = render(fields);
    expect(html).toContain('aria-label="Delete"');
    expect(html).not.toContain("Confirm delete?");
  });
});

describe("focusFormStart", () => {
  it("scrolls the form into view and focuses its first field", () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const form = {
      scrollIntoView,
      querySelector: vi.fn(() => ({ focus })),
    } as unknown as HTMLElement;
    focusFormStart(form);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("is a no-op before the form has mounted", () => {
    expect(() => focusFormStart(null)).not.toThrow();
  });
});
