/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import {
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { getStickySortedRowModel } from "./get-sticky-sorted-row-model";

type Row = { id: string; label: string; value: number };

const initialRows: Row[] = [
  { id: "a", label: "Alpha", value: 30 },
  { id: "b", label: "Bravo", value: 10 },
  { id: "c", label: "Charlie", value: 20 },
];

const useStickyTable = (startData: Row[] = initialRows) => {
  const [data, setData] = useState(startData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable<Row>({
    data,
    columns: [{ accessorKey: "label" }, { accessorKey: "value" }],
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getStickySortedRowModel(),
    enableSorting: true,
  });
  return { table, setData, setSorting };
};

const idsOf = (table: ReturnType<typeof useStickyTable>["table"]) =>
  table.getRowModel().rows.map((r) => r.id);

describe("getStickySortedRowModel", () => {
  it("returns rows in data order when no sort is active", () => {
    const { result } = renderHook(() => useStickyTable());
    expect(idsOf(result.current.table)).toEqual(["a", "b", "c"]);
  });

  it("sorts when sort state is applied", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);
  });

  it("keeps cached order when data updates without sort changes", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    // Edit the sort column of row "b" so a fresh sort would push it to the end.
    act(() =>
      result.current.setData([
        { id: "a", label: "Alpha", value: 30 },
        { id: "b", label: "Bravo", value: 999 },
        { id: "c", label: "Charlie", value: 20 },
      ]),
    );

    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);
  });

  it("re-sorts when sort state changes", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() =>
      result.current.setData([
        { id: "a", label: "Alpha", value: 30 },
        { id: "b", label: "Bravo", value: 999 },
        { id: "c", label: "Charlie", value: 20 },
      ]),
    );
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() => result.current.setSorting([{ id: "value", desc: true }]));
    expect(idsOf(result.current.table)).toEqual(["b", "a", "c"]);
  });

  it("returns to data order when sort is cleared", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() => result.current.setSorting([]));

    expect(idsOf(result.current.table)).toEqual(["a", "b", "c"]);
  });

  it("drops deleted ids from the sticky order", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() =>
      result.current.setData([
        { id: "a", label: "Alpha", value: 30 },
        { id: "c", label: "Charlie", value: 20 },
      ]),
    );

    expect(idsOf(result.current.table)).toEqual(["c", "a"]);
  });

  it("appends newly added ids at the end of the sticky order", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() =>
      result.current.setData([
        ...initialRows,
        { id: "d", label: "Delta", value: 5 },
      ]),
    );

    expect(idsOf(result.current.table)).toEqual(["b", "c", "a", "d"]);
  });

  it("re-sorts when the same column and direction is re-applied", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() =>
      result.current.setData([
        { id: "a", label: "Alpha", value: 30 },
        { id: "b", label: "Bravo", value: 999 },
        { id: "c", label: "Charlie", value: 20 },
      ]),
    );
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    // Re-clicking the already-sorted header produces a new sorting array with
    // the same content. The user expects a refreshed sort against current
    // values, not the stale cached order.
    act(() => result.current.setSorting([{ id: "value", desc: false }]));

    expect(idsOf(result.current.table)).toEqual(["c", "a", "b"]);
  });

  it("re-sorts after the sticky order is broken by a header click", () => {
    const { result } = renderHook(() => useStickyTable());

    act(() => result.current.setSorting([{ id: "value", desc: false }]));
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a"]);

    act(() =>
      result.current.setData([
        ...initialRows,
        { id: "d", label: "Delta", value: 5 },
      ]),
    );
    expect(idsOf(result.current.table)).toEqual(["b", "c", "a", "d"]);

    // User flips the sort direction; cache refreshes against current values.
    act(() => result.current.setSorting([{ id: "value", desc: true }]));

    expect(idsOf(result.current.table)).toEqual(["a", "c", "b", "d"]);
  });
});
