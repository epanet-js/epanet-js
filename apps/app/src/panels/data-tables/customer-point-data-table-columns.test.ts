import { describe, it, expect } from "vitest";
import type { ColumnDefBase } from "@tanstack/react-table";
import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "src/lib/project-settings";
import { buildCustomerPointColumns } from "./customer-point-data-table-columns";
import type { CustomerPointRow } from "./customer-point-data-table-data";

const { units, formatting } = defaultProjectSettings;
const translate = (key: string) => key;
const translateUnit = () => "";

const build = (
  customAttributes: Parameters<typeof buildCustomerPointColumns>[7],
) =>
  buildCustomerPointColumns(
    translate,
    translateUnit,
    units,
    formatting,
    [],
    () => true,
    undefined,
    customAttributes,
  );

describe("buildCustomerPointColumns custom attributes", () => {
  it("appends a column per custom attribute", () => {
    const columns = build([
      { id: "custom-1", label: "Zone", type: "text" },
      { id: "custom-2", label: "Age", type: "number" },
    ]);

    const ids = columns.map((c) => (c as { id?: string }).id);
    expect(ids).toContain("custom-1");
    expect(ids).toContain("custom-2");
  });

  it("reads the value from the customer point via getProperty", () => {
    const columns = build([{ id: "custom-1", label: "Zone", type: "text" }]);
    const column = columns.find(
      (c) => (c as { id?: string }).id === "custom-1",
    ) as ColumnDefBase<CustomerPointRow, unknown> & {
      accessorFn: (row: CustomerPointRow, index: number) => unknown;
    };

    const cp = buildCustomerPoint(1, { label: "CP1" });
    cp.setProperty("custom-1", "north");

    expect(column.accessorFn(cp as unknown as CustomerPointRow, 0)).toBe(
      "north",
    );
  });

  it("returns no custom columns when none are defined", () => {
    const columns = build([]);
    const ids = columns.map((c) => (c as { id?: string }).id);
    expect(ids).not.toContain("custom-1");
  });
});
