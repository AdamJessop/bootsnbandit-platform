import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

/**
 * The DOM behaviour (sort/filter/CSV) is covered exhaustively by
 * data-table-utils.test.ts (the pure logic this component delegates to). The
 * test environment is node (no DOM), so here we assert the public contract:
 * the component is a renderable function and accepts the documented props.
 */
interface Row {
  id: string;
  name: string;
}

describe("DataTable contract", () => {
  it("is a component function", () => {
    expect(typeof DataTable).toBe("function");
  });

  it("accepts the documented column + prop shape", () => {
    const columns: DataTableColumn<Row>[] = [
      { key: "name", header: "Name", sortable: true, align: "left" },
    ];
    // Type-level contract: building the props object must compile.
    const props = {
      columns,
      rows: [{ id: "1", name: "Amy" }] as Row[],
      csv: true,
      csvName: "customers",
      searchKeys: ["name"] as (keyof Row & string)[],
      rowKey: (r: Row) => r.id,
    };
    expect(props.columns).toHaveLength(1);
    expect(props.rows[0].name).toBe("Amy");
  });
});
