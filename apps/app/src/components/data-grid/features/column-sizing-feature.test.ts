/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook, type RenderHookResult } from "@testing-library/react";
import { type Table, useReactTable } from "@tanstack/react-table";
import { ClipboardFeature } from "./clipboard-feature";
import { ColumnSizingFeature } from "./column-sizing-feature";
import { LazyRowModelFeature } from "./lazy-row-model-feature";
import { getLazyCoreRowModel } from "../models/lazy-core-row-model";
import type { GridColumn } from "../types";

type TestRow = { name: string; price: number };

// Each character measures CELL_CHAR_WIDTH px in cell font, HEADER_CHAR_WIDTH px
// in header font (header has a bold weight). The fake context interprets the
// "600 " prefix from resolveCanvasFonts as the header signal.
const CELL_CHAR_WIDTH = 7;
const HEADER_CHAR_WIDTH = 9;

let restoreGetContext: (() => void) | null = null;

function stubCanvas(opts: { available?: boolean } = { available: true }) {
  let currentFont = "14px sans-serif";
  const ctx = {
    set font(value: string) {
      currentFont = value;
    },
    get font() {
      return currentFont;
    },
    measureText(text: string) {
      const isHeader = currentFont.startsWith("600 ");
      const w = text.length * (isHeader ? HEADER_CHAR_WIDTH : CELL_CHAR_WIDTH);
      return { width: w } as TextMetrics;
    },
  } as unknown as CanvasRenderingContext2D;

  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() =>
    opts.available
      ? ctx
      : null) as typeof HTMLCanvasElement.prototype.getContext;
  restoreGetContext = () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

const defaultColumns = (): GridColumn<TestRow>[] => [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "price", header: "Price" },
];

const useSizingTable = (
  data: TestRow[],
  columns: GridColumn<TestRow>[] = defaultColumns(),
) =>
  useReactTable<TestRow>({
    data,
    columns,
    getCoreRowModel: getLazyCoreRowModel(),
    _features: [LazyRowModelFeature, ColumnSizingFeature, ClipboardFeature],
  });

// Auto-sizing measures only materialized (on-screen) rows. In a headless test
// nothing is virtualized, so touch the rows to materialize them — mirroring what
// the virtualizer renders — before fitting the column.
const fitWidth = (
  result: RenderHookResult<Table<TestRow>, unknown>["result"],
  columnId: string,
  container?: HTMLElement | null,
) =>
  act(() => {
    const rows = result.current.getRowModel().rows;
    for (let i = 0; i < rows.length; i++) void rows[i];
    result.current.getColumn(columnId)?.fitWidthToContent(container);
  });

afterEach(() => {
  restoreGetContext?.();
  restoreGetContext = null;
});

describe("ColumnSizingFeature", () => {
  describe("meta readers", () => {
    it("getAutoSizeExtraWidth returns meta value when set", () => {
      const { result } = renderHook(() =>
        useSizingTable(
          [],
          [{ accessorKey: "name", meta: { autoSizeExtraWidth: 24 } }],
        ),
      );

      expect(result.current.getColumn("name")?.getAutoSizeExtraWidth()).toBe(
        24,
      );
    });

    it("getAutoSizeExtraWidth defaults to 16 when meta unset", () => {
      const { result } = renderHook(() =>
        useSizingTable([], [{ accessorKey: "name" }]),
      );

      expect(result.current.getColumn("name")?.getAutoSizeExtraWidth()).toBe(
        16,
      );
    });

    it("getPlaceholder returns meta value", () => {
      const { result } = renderHook(() =>
        useSizingTable(
          [],
          [{ accessorKey: "name", meta: { placeholder: "Enter name" } }],
        ),
      );

      expect(result.current.getColumn("name")?.getPlaceholder()).toBe(
        "Enter name",
      );
    });
  });

  describe("fitWidthToContent", () => {
    it("sizes the column to the widest cell value when cells dominate", () => {
      stubCanvas();
      const data: TestRow[] = [
        { name: "abc", price: 1 },
        { name: "an-extraordinarily-long-cell-value", price: 2 },
        { name: "xy", price: 3 },
      ];

      const { result } = renderHook(() => useSizingTable(data));
      const longest = "an-extraordinarily-long-cell-value";
      const expected =
        Math.ceil(longest.length * CELL_CHAR_WIDTH) +
        /* defaultExtraWidth */ 16 +
        /* +2 padding */ 2;

      fitWidth(result, "name");

      expect(result.current.getState().columnSizing.name).toBe(expected);
    });

    it("sizes the column to the header when the header is wider than the cells", () => {
      stubCanvas();
      const data: TestRow[] = [{ name: "a", price: 1 }];
      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "name", header: "Very-Long-Header-Label" },
      ];

      const { result } = renderHook(() => useSizingTable(data, columns));
      const header = "Very-Long-Header-Label";
      const expected = Math.ceil(header.length * HEADER_CHAR_WIDTH) + 16 + 2;

      fitWidth(result, "name");

      expect(result.current.getState().columnSizing.name).toBe(expected);
    });

    it("uses the placeholder when no cell value is wider", () => {
      stubCanvas();
      const data: TestRow[] = [
        { name: "", price: 0 },
        { name: "", price: 0 },
      ];
      const columns: GridColumn<TestRow>[] = [
        {
          accessorKey: "name",
          header: "X",
          meta: { placeholder: "type-something-here" },
        },
      ];

      const { result } = renderHook(() => useSizingTable(data, columns));
      const placeholder = "type-something-here";
      const expected = Math.ceil(placeholder.length * CELL_CHAR_WIDTH) + 16 + 2;

      fitWidth(result, "name");

      expect(result.current.getState().columnSizing.name).toBe(expected);
    });

    it("adds meta.autoSizeExtraWidth to the chosen content width", () => {
      stubCanvas();
      const data: TestRow[] = [{ name: "abcdef", price: 0 }];
      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "name", header: "x", meta: { autoSizeExtraWidth: 40 } },
      ];

      const { result } = renderHook(() => useSizingTable(data, columns));
      const expected = Math.ceil(6 * CELL_CHAR_WIDTH) + 40 + 2;

      fitWidth(result, "name");

      expect(result.current.getState().columnSizing.name).toBe(expected);
    });

    it("clamps to the header min-width when content is very short", () => {
      stubCanvas();
      const data: TestRow[] = [{ name: "a", price: 0 }];
      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "name", header: "a" },
      ];

      const { result } = renderHook(() => useSizingTable(data, columns));

      // minWidth = ceil("W".width + "…".width) + 22 (sort-button reserved).
      // With the fake measurer both chars are HEADER_CHAR_WIDTH wide.
      const minWidth = Math.ceil(HEADER_CHAR_WIDTH * 2) + 22;
      // Content size would be 1 * 7 + 16 + 2 = 25, smaller than minWidth.

      fitWidth(result, "name");

      expect(result.current.getState().columnSizing.name).toBe(minWidth);
    });

    it("uses column.getCopyValue when measuring cell text", () => {
      stubCanvas();
      const data: TestRow[] = [{ name: "abc", price: 1234567890 }];
      // Provide a copyValue that returns a much longer formatted string.
      const columns: GridColumn<TestRow>[] = [
        {
          accessorKey: "price",
          header: "p",
          meta: { copyValue: (v) => `$ ${String(v)}.00 USD` },
        },
      ];

      const { result } = renderHook(() => useSizingTable(data, columns));
      const formatted = "$ 1234567890.00 USD";
      const expected = Math.ceil(formatted.length * CELL_CHAR_WIDTH) + 16 + 2;

      fitWidth(result, "price");

      expect(result.current.getState().columnSizing.price).toBe(expected);
    });

    it("falls back to resetSize when canvas context is unavailable", () => {
      stubCanvas({ available: false });
      const data: TestRow[] = [{ name: "abc", price: 0 }];
      const { result } = renderHook(() => useSizingTable(data));

      // Seed a custom size so we can verify it gets reset.
      act(() =>
        result.current.setColumnSizing((prev) => ({ ...prev, name: 999 })),
      );
      expect(result.current.getState().columnSizing.name).toBe(999);

      fitWidth(result, "name");

      // resetSize removes the column from the columnSizing state.
      expect(result.current.getState().columnSizing.name).toBeUndefined();
    });
  });
});
