import { describe, expect, it } from "vitest";
import {
  csvField,
  filterRows,
  sortRows,
  toCsv,
  type CsvColumn,
} from "./data-table-utils";

interface Row {
  name: string;
  visits: number;
  tier: string;
}

const rows: Row[] = [
  { name: "Zoe", visits: 3, tier: "gold" },
  { name: "amy", visits: 10, tier: "bronze" },
  { name: "Bob", visits: 2, tier: "silver" },
];

describe("sortRows", () => {
  it("sorts strings case-insensitively ascending", () => {
    expect(sortRows(rows, "name", "asc").map((r) => r.name)).toEqual([
      "amy",
      "Bob",
      "Zoe",
    ]);
  });

  it("sorts numbers numerically descending", () => {
    expect(sortRows(rows, "visits", "desc").map((r) => r.visits)).toEqual([
      10, 3, 2,
    ]);
  });

  it("is stable for equal keys", () => {
    const tie = [
      { name: "a", visits: 1, tier: "x" },
      { name: "b", visits: 1, tier: "x" },
    ];
    expect(sortRows(tie, "visits", "asc").map((r) => r.name)).toEqual([
      "a",
      "b",
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = [...rows];
    sortRows(rows, "visits", "asc");
    expect(rows).toEqual(copy);
  });
});

describe("filterRows", () => {
  it("filters case-insensitively across keys", () => {
    expect(
      filterRows(rows, "GOLD", ["name", "tier"]).map((r) => r.name),
    ).toEqual(["Zoe"]);
  });

  it("returns all rows for an empty query", () => {
    expect(filterRows(rows, "  ", ["name"])).toHaveLength(3);
  });

  it("matches partial substrings", () => {
    expect(filterRows(rows, "o", ["name"]).map((r) => r.name)).toEqual([
      "Zoe",
      "Bob",
    ]);
  });
});

describe("csvField", () => {
  it("quotes fields containing commas, quotes or newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
  });

  it("leaves plain fields unquoted and renders null as empty", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField(null)).toBe("");
  });
});

describe("toCsv", () => {
  it("builds a header row + data rows with CRLF", () => {
    const cols: CsvColumn<Row>[] = [
      { key: "name", header: "Name" },
      { key: "visits", header: "Visits" },
    ];
    const csv = toCsv(cols, rows.slice(0, 2));
    expect(csv).toBe("Name,Visits\r\nZoe,3\r\namy,10");
  });

  it("supports a custom value extractor", () => {
    const cols: CsvColumn<Row>[] = [
      { key: "name", header: "Name", value: (r) => r.name.toUpperCase() },
    ];
    expect(toCsv(cols, [rows[0]])).toBe("Name\r\nZOE");
  });
});
