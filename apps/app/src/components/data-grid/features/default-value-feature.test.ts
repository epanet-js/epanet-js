/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DefaultValueFeature } from "./default-value-feature";
import type { GridColumn } from "../types";

type Row = { value: number | null };

// Distinct ids let several columns share the `value` accessor with different
// defaults. Data is irrelevant — we only exercise the column instances.
const columns: GridColumn<Row>[] = [
  { id: "static", accessorKey: "value", meta: { defaultValue: 7 } },
  {
    id: "fn",
    accessorKey: "value",
    meta: { defaultValue: (i: number) => i * 10 },
  },
  { id: "none", accessorKey: "value" },
  {
    id: "nullDefault",
    accessorKey: "value",
    meta: { defaultValue: () => null },
  },
];

const useColumns = () => {
  const table = useReactTable<Row>({
    data: [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    _features: [DefaultValueFeature],
  });
  return table;
};

describe("DefaultValueFeature", () => {
  const setup = () => renderHook(() => useColumns()).result.current;

  describe("getDefaultValue", () => {
    it("returns a static default", () => {
      expect(setup().getColumn("static")?.getDefaultValue(0)).toBe(7);
    });

    it("invokes a function default with the row index", () => {
      expect(setup().getColumn("fn")?.getDefaultValue(3)).toBe(30);
    });

    it("returns undefined when no default is configured", () => {
      expect(setup().getColumn("none")?.getDefaultValue(0)).toBeUndefined();
    });
  });

  describe("getEffectiveValue", () => {
    it("passes a non-null raw value through unchanged", () => {
      expect(setup().getColumn("static")?.getEffectiveValue(42, 0)).toBe(42);
    });

    it("does not treat falsy-but-present values as empty", () => {
      // 0 is a real stored value, not an empty cell.
      expect(setup().getColumn("static")?.getEffectiveValue(0, 0)).toBe(0);
    });

    it("substitutes the default for null and undefined raw values", () => {
      const column = setup().getColumn("static");
      expect(column?.getEffectiveValue(null, 0)).toBe(7);
      expect(column?.getEffectiveValue(undefined, 0)).toBe(7);
    });

    it("uses the row index when resolving a function default", () => {
      expect(setup().getColumn("fn")?.getEffectiveValue(null, 4)).toBe(40);
    });

    it("falls back to the raw value when no default is configured", () => {
      expect(setup().getColumn("none")?.getEffectiveValue(null, 0)).toBeNull();
    });

    it("falls back to the raw value when the default resolves to null", () => {
      expect(
        setup().getColumn("nullDefault")?.getEffectiveValue(null, 0),
      ).toBeNull();
    });
  });
});
