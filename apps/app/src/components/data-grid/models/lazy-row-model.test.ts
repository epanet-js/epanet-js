/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useReactTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import {
  type LazyRowModel,
  LAZY_ROW_MODEL_THRESHOLD,
  getAdaptiveCoreRowModel,
} from "./lazy-core-row-model";
import { getAdaptiveStickySortedRowModel } from "./lazy-sticky-sorted-row-model";
import { LazyRowModelFeature } from "../features/lazy-row-model-feature";
import { CellRangeSelectionFeature } from "../features/cell-range-selection-feature";

type Row = { id: number; value: number; label: string };

const makeData = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    // value descending so an ascending sort is a non-identity permutation
    value: n - i,
    label: `r${i}`,
  }));

const useGridTable = (data: Row[], lazyRowModel = true) =>
  useReactTable<Row>({
    data,
    columns: [{ accessorKey: "value" }, { accessorKey: "label" }],
    getRowId: (row) => String(row.id),
    getCoreRowModel: getAdaptiveCoreRowModel(),
    getSortedRowModel: getAdaptiveStickySortedRowModel(),
    enableSorting: true,
    lazyRowModel,
    _features: [LazyRowModelFeature, CellRangeSelectionFeature],
  });

const LARGE = LAZY_ROW_MODEL_THRESHOLD + 500; // 1500
const SMALL = LAZY_ROW_MODEL_THRESHOLD - 500; // 500

describe("lazy core row model (> threshold)", () => {
  it("reports the full length but does not materialize rows as a dense array", () => {
    const { result } = renderHook(() => useGridTable(makeData(LARGE)));
    const rows = result.current.getRowModel().rows;

    expect(rows.length).toBe(LARGE);
    // The lazy proxy has no own enumerable indices (a standard model would be a
    // dense array of LARGE entries). This is the laziness signal. `Array.isArray`
    // stays true (the proxy target is an array) for consumer compatibility.
    expect(Object.keys(rows).length).toBe(0);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("creates correct rows on indexed access (global index + original)", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));
    const rows = result.current.getRowModel().rows;

    expect(rows[0].original).toBe(data[0]);
    expect(rows[7].index).toBe(7);
    expect(rows[7].getValue("value")).toBe(data[7].value);
  });

  it("resolves rowsById lazily via getRowId", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));
    const byId = result.current.getRowModel().rowsById;

    expect(byId[String(data[42].id)].original).toBe(data[42]);
    expect(byId["does-not-exist"]).toBeUndefined();
  });
});

describe("standard row model (<= threshold)", () => {
  it("uses a real dense array (unchanged behaviour)", () => {
    const { result } = renderHook(() => useGridTable(makeData(SMALL)));
    const rows = result.current.getRowModel().rows;

    expect(rows.length).toBe(SMALL);
    expect(Array.isArray(rows)).toBe(true);
    // Standard model is a dense array → own indices present.
    expect(Object.keys(rows).length).toBe(SMALL);
  });
});

describe("gating (lazyRowModel opt-in)", () => {
  it("stays on the standard model when not opted in, even past threshold", () => {
    const { result } = renderHook(() => useGridTable(makeData(LARGE), false));
    const rows = result.current.getRowModel().rows;

    expect(rows.length).toBe(LARGE);
    // Not opted in → dense standard array despite being over threshold.
    expect(Object.keys(rows).length).toBe(LARGE);
  });
});

describe("lazy sorting (> threshold)", () => {
  it("orders by the sorted column without materializing all rows", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));

    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    const rows = result.current.getRowModel().rows;
    expect(rows.length).toBe(LARGE);
    expect(Object.keys(rows).length).toBe(0); // still lazy
    // Sorting itself must not materialize rows: resolving the column's sorting fn
    // goes through precomputed values, not table-core's row-iterating auto-detect.
    expect(
      (result.current.getRowModel() as LazyRowModel<Row>).getMaterializedRows(),
    ).toHaveLength(0);
    // value runs n..1, so ascending puts value 1 (the last data row) first.
    expect(rows[0].getValue("value")).toBe(1);
    expect(rows[LARGE - 1].getValue("value")).toBe(LARGE);

    act(() => result.current.setSorting([{ id: "value", desc: true }]));
    const desc = result.current.getRowModel().rows;
    expect(desc[0].getValue("value")).toBe(LARGE);
  });

  it("getOrderedOriginals reflects display order without Row objects", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));

    // No sort → identity (returns the data array as-is).
    expect(result.current.getOrderedOriginals()).toBe(data);

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    const ordered = result.current.getOrderedOriginals();
    expect(ordered[0].value).toBe(1);
    expect(ordered[ordered.length - 1].value).toBe(LARGE);
  });

  it("is sticky: a cell edit re-maps the cached order instead of re-sorting", () => {
    const { result, rerender } = renderHook(({ d }) => useGridTable(d), {
      initialProps: { d: makeData(LARGE) },
    });

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    // Ascending: id (LARGE-1) has value 1 → first; id 0 has value LARGE → last.
    expect(result.current.getRowModel().rows[0].id).toBe(String(LARGE - 1));

    // Edit: id 0's value becomes the smallest. A re-sort would move it to the
    // front; sticky keeps it in place (matches getStickySortedRowModel).
    const edited = makeData(LARGE).map((r) =>
      r.id === 0 ? { ...r, value: -1 } : r,
    );
    rerender({ d: edited });

    const rows = result.current.getRowModel().rows;
    expect(rows[0].id).toBe(String(LARGE - 1)); // unchanged value, still first
    expect(rows[LARGE - 1].id).toBe("0"); // stayed last despite new smallest value
  });

  it("getVisualIndex maps a row's data index to its display position", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    const rows = result.current.getRowModel().rows;
    const firstRow = rows[0]; // value 1, data index LARGE-1
    expect(firstRow.index).toBe(LARGE - 1);
    expect(firstRow.getVisualIndex()).toBe(0);
  });
});

describe("edit while sorted (sticky, no rebuild)", () => {
  it("reuses the cached order on an in-place edit (new ref, same id)", () => {
    const initial = makeData(LARGE);
    const { result, rerender } = renderHook(({ d }) => useGridTable(d), {
      initialProps: { d: initial },
    });
    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    const before = result.current.getLazyRowOrder();
    expect(before.orderByDataIndex).not.toBeNull();

    // In-place edit: same ids at same indices, row 5 gets a new ref + new value.
    const next = initial.map((r, i) => (i === 5 ? { ...r, value: -1 } : r));
    rerender({ d: next });

    const after = result.current.getLazyRowOrder();
    // Same cached objects → fast path reused them (no reconcile, no re-sort).
    expect(after).toBe(before);
    expect(after.orderByDataIndex).toBe(before.orderByDataIndex);
    // Sticky: row 5's new (smallest) value does NOT move it to the front.
    expect(result.current.getRowModel().rows[0].id).toBe(String(LARGE - 1));
  });

  it("rebuilds the order when a row is removed (structural change)", () => {
    const initial = makeData(LARGE);
    const { result, rerender } = renderHook(({ d }) => useGridTable(d), {
      initialProps: { d: initial },
    });
    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    const before = result.current.getLazyRowOrder();
    rerender({ d: initial.filter((_, i) => i !== 5) });

    const after = result.current.getLazyRowOrder();
    expect(after).not.toBe(before);
    expect(after.orderByDataIndex?.length).toBe(LARGE - 1);
  });
});

describe("getMaterializedRows (working set)", () => {
  it("returns only the rows accessed so far, not the whole dataset", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));
    const model = () => result.current.getRowModel() as LazyRowModel<Row>;

    // Nothing accessed yet → empty working set (not LARGE).
    expect(model().getMaterializedRows()).toHaveLength(0);

    // Touch two rows; only those materialize.
    void model().rows[3];
    void model().rows[10];

    const built = model().getMaterializedRows();
    expect(built).toHaveLength(2);
    expect(built.map((r) => r.index).sort((a, b) => a - b)).toEqual([3, 10]);
  });

  it("is forwarded by the ordered (sorted) model, reading the core cache", () => {
    const data = makeData(LARGE);
    const { result } = renderHook(() => useGridTable(data));
    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    const rows = result.current.getRowModel().rows;
    void rows[0];
    void rows[1];

    const model = result.current.getRowModel() as LazyRowModel<Row>;
    // Only the two visited (by display position) rows are materialized.
    expect(model.getMaterializedRows()).toHaveLength(2);
  });

  it("is absent from the standard (non-lazy) model", () => {
    const { result } = renderHook(() => useGridTable(makeData(SMALL)));
    const model = result.current.getRowModel() as Partial<LazyRowModel<Row>>;
    expect(model.getMaterializedRows).toBeUndefined();
  });
});
