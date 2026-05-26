/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CellRangeSelectionFeature } from "./cell-range-selection-feature";
import type { CellPosition, GridSelection } from "../types";

type Row = { a: string; b: string; c: string };

type SelectionUpdate = {
  range: GridSelection;
  movingCorner: CellPosition;
} | null;

const useFeatureTable = (data: Row[] = []) =>
  useReactTable({
    data,
    columns: [{ accessorKey: "a" }, { accessorKey: "b" }, { accessorKey: "c" }],
    getCoreRowModel: getCoreRowModel(),
    _features: [CellRangeSelectionFeature],
  });

const useGridTable = () =>
  useFeatureTable([
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
  ]);

describe("CellRangeSelectionFeature", () => {
  describe("initial state", () => {
    it("starts with no selection", () => {
      const { result } = renderHook(useFeatureTable);

      expect(result.current.getSelection()).toBeNull();
    });
  });

  describe("selectRange", () => {
    it("sets the selection range", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 3 },
        });
      });

      expect(result.current.getSelection()).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 3 },
      });
    });

    it("replaces the previous range", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });
      act(() => {
        result.current.selectRange({
          min: { col: 1, row: 1 },
          max: { col: 2, row: 3 },
        });
      });

      expect(result.current.getSelection()).toEqual({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      });
    });
  });

  describe("clearSelection", () => {
    it("clears the range", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 1 },
        });
      });
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.getSelection()).toBeNull();
    });

    it("is a no-op when nothing is selected (preserves state identity)", () => {
      const { result } = renderHook(useFeatureTable);

      const before = result.current.getState().cellRangeSelection;
      act(() => {
        result.current.clearSelection();
      });
      const after = result.current.getState().cellRangeSelection;

      expect(after).toBe(before);
    });
  });
});

describe("updateSelection", () => {
  it("returns null when the grid is empty", () => {
    const { result } = renderHook(useFeatureTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({ col: 0, row: 0 });
    });

    expect(outcome).toBeNull();
    expect(result.current.getSelection()).toBeNull();
  });

  it("selects a single cell and reports its movingCorner", () => {
    const { result } = renderHook(useGridTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({ col: 1, row: 2 });
    });

    expect(outcome).toEqual({
      range: { min: { col: 1, row: 2 }, max: { col: 1, row: 2 } },
      movingCorner: { col: 1, row: 2 },
    });
    expect(result.current.getSelection()).toEqual({
      min: { col: 1, row: 2 },
      max: { col: 1, row: 2 },
    });
  });

  it("selects an entire column when only col is provided", () => {
    const { result } = renderHook(useGridTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({ col: 2 });
    });

    expect(outcome!.range).toEqual({
      min: { col: 2, row: 0 },
      max: { col: 2, row: 3 },
    });
  });

  it("selects an entire row when only row is provided", () => {
    const { result } = renderHook(useGridTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({ row: 1 });
    });

    expect(outcome!.range).toEqual({
      min: { col: 0, row: 1 },
      max: { col: 2, row: 1 },
    });
  });

  it("selects the entire grid when no indices are provided", () => {
    const { result } = renderHook(useGridTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({});
    });

    expect(outcome!.range).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 3 },
    });
  });

  it("extends to the bottom-right corner when extending past max", () => {
    const { result } = renderHook(useGridTable);

    act(() => {
      result.current.updateSelection({ col: 0, row: 0 });
    });

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({
        col: 2,
        row: 3,
        extend: true,
      });
    });

    expect(outcome).toEqual({
      range: { min: { col: 0, row: 0 }, max: { col: 2, row: 3 } },
      movingCorner: { col: 2, row: 3 },
    });
  });

  it("extends to the top-left corner when extending before min", () => {
    const { result } = renderHook(useGridTable);

    act(() => {
      result.current.updateSelection({ col: 2, row: 3 });
    });

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({
        col: 0,
        row: 0,
        extend: true,
      });
    });

    expect(outcome).toEqual({
      range: { min: { col: 0, row: 0 }, max: { col: 2, row: 3 } },
      movingCorner: { col: 0, row: 0 },
    });
  });

  it("places the moving corner asymmetrically when extending diagonally", () => {
    const { result } = renderHook(useGridTable);

    act(() => {
      result.current.updateSelection({ col: 0, row: 2 });
    });

    let outcome: SelectionUpdate = null;
    act(() => {
      // Extending up-and-right
      outcome = result.current.updateSelection({
        col: 2,
        row: 0,
        extend: true,
      });
    });

    expect(outcome!.range).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 2 },
    });
    expect(outcome!.movingCorner).toEqual({ col: 2, row: 0 });
  });

  it("treats extend as non-extend when there is no current selection", () => {
    const { result } = renderHook(useGridTable);

    let outcome: SelectionUpdate = null;
    act(() => {
      outcome = result.current.updateSelection({
        col: 1,
        row: 2,
        extend: true,
      });
    });

    expect(outcome).toEqual({
      range: { min: { col: 1, row: 2 }, max: { col: 1, row: 2 } },
      movingCorner: { col: 1, row: 2 },
    });
  });
});

describe("getSelection clamping", () => {
  it("returns null when the grid has no rows even if state has a range", () => {
    const { result } = renderHook(useFeatureTable);
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 3 },
      });
    });

    expect(result.current.getSelection()).toBeNull();
  });

  it("clamps a range that exceeds the current grid bounds", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 9, row: 9 },
      });
    });

    expect(result.current.getSelection()).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 3 },
    });
  });

  it("leaves an in-bounds range unchanged", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 2 },
      });
    });

    expect(result.current.getSelection()).toEqual({
      min: { col: 1, row: 1 },
      max: { col: 2, row: 2 },
    });
  });
});

describe("isSelectionFullRows", () => {
  it("returns false when there is no selection", () => {
    const { result } = renderHook(useGridTable);
    expect(result.current.isSelectionFullRows()).toBe(false);
  });

  it("returns true when the range spans all columns", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 1 },
      });
    });
    expect(result.current.isSelectionFullRows()).toBe(true);
  });

  it("returns false when the range stops short of all columns", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 1 },
        max: { col: 1, row: 1 },
      });
    });
    expect(result.current.isSelectionFullRows()).toBe(false);
  });
});

describe("sort-aware indexing", () => {
  type SortRow = { name: string; value: string };

  const useSortableTable = (data: SortRow[]) =>
    useReactTable({
      data,
      columns: [{ accessorKey: "name" }, { accessorKey: "value" }],
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      enableSorting: true,
      _features: [CellRangeSelectionFeature],
    });

  // Data is [Bob, Alice, Carol] but sorted asc → [Alice, Bob, Carol].
  // Original row indices: Bob=0, Alice=1, Carol=2.
  // Visual row indices after sort:        Alice=0, Bob=1, Carol=2.
  const useSortedTable = () => {
    const data: SortRow[] = [
      { name: "Bob", value: "200" },
      { name: "Alice", value: "100" },
      { name: "Carol", value: "300" },
    ];
    return useSortableTable(data);
  };

  it("row.getVisualIndex returns the displayed position, not the data-array position", () => {
    const { result } = renderHook(useSortedTable);
    act(() => {
      result.current.setSorting([{ id: "name", desc: false }]);
    });

    const rows = result.current.getRowModel().rows;
    const aliceRow = rows.find((r) => r.original.name === "Alice")!;
    const bobRow = rows.find((r) => r.original.name === "Bob")!;
    const carolRow = rows.find((r) => r.original.name === "Carol")!;

    expect(aliceRow.index).toBe(1); // data-array position
    expect(bobRow.index).toBe(0);
    expect(carolRow.index).toBe(2);

    expect(aliceRow.getVisualIndex()).toBe(0);
    expect(bobRow.getVisualIndex()).toBe(1);
    expect(carolRow.getVisualIndex()).toBe(2);
  });

  it("table.getVisualIndexLookup exposes the id → position map", () => {
    const { result } = renderHook(useSortedTable);
    act(() => {
      result.current.setSorting([{ id: "name", desc: false }]);
    });

    const lookup = result.current.getVisualIndexLookup();
    const rows = result.current.getRowModel().rows;
    expect(lookup.get(rows[0].id)).toBe(0); // Alice
    expect(lookup.get(rows[1].id)).toBe(1); // Bob
    expect(lookup.get(rows[2].id)).toBe(2); // Carol
  });

  it("highlights the visually-selected range when the table is sorted", () => {
    const { result } = renderHook(useSortedTable);
    act(() => {
      result.current.setSorting([{ id: "name", desc: false }]);
    });

    // Select visual rows 0..1 (Alice, Bob).
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });
    });

    const rows = result.current.getRowModel().rows;
    const cellAt = (rowIdx: number, colIdx: number) =>
      rows[rowIdx].getVisibleCells()[colIdx];

    // Visual rows 0 and 1 (Alice, Bob) should be selected.
    expect(cellAt(0, 0).isSelected()).toBe(true); // Alice
    expect(cellAt(1, 0).isSelected()).toBe(true); // Bob
    expect(cellAt(2, 0).isSelected()).toBe(false); // Carol

    // Carol (visual row 2 / data index 2) must not be selected even though
    // her data index falls inside the range when interpreted as data indices.
    expect(cellAt(2, 1).isSelected()).toBe(false);
  });

  it("marks the full row at the visual position as fully selected", () => {
    const { result } = renderHook(useSortedTable);
    act(() => {
      result.current.setSorting([{ id: "name", desc: false }]);
    });

    // Full-row select on visual row 0 (Alice).
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 0 },
      });
    });

    const rows = result.current.getRowModel().rows;
    expect(rows[0].isFullySelected()).toBe(true); // Alice
    expect(rows[1].isFullySelected()).toBe(false); // Bob
    expect(rows[2].isFullySelected()).toBe(false); // Carol
  });

  it("places selection edges at the visual range boundaries", () => {
    const { result } = renderHook(useSortedTable);
    act(() => {
      result.current.setSorting([{ id: "name", desc: false }]);
    });

    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });
    });

    const rows = result.current.getRowModel().rows;
    // Top-left of the selection: visual row 0, col 0 (Alice's name cell).
    const topLeft = rows[0].getVisibleCells()[0].getSelectionEdge();
    expect(topLeft).toEqual({
      top: true,
      bottom: false,
      left: true,
      right: false,
    });

    // Bottom-right: visual row 1, col 1 (Bob's value cell).
    const bottomRight = rows[1].getVisibleCells()[1].getSelectionEdge();
    expect(bottomRight).toEqual({
      top: false,
      bottom: true,
      left: false,
      right: true,
    });
  });
});

describe("isCellSelected", () => {
  it("returns false when there is no selection", () => {
    const { result } = renderHook(useGridTable);
    expect(result.current.isCellSelected(0, 0)).toBe(false);
  });

  it("returns true for a cell inside the range", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      });
    });
    expect(result.current.isCellSelected(1, 2)).toBe(true);
  });

  it("includes the boundaries", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      });
    });
    expect(result.current.isCellSelected(1, 1)).toBe(true);
    expect(result.current.isCellSelected(2, 3)).toBe(true);
  });

  it("returns false for cells outside the range", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      });
    });
    expect(result.current.isCellSelected(0, 0)).toBe(false);
    expect(result.current.isCellSelected(0, 2)).toBe(false);
    expect(result.current.isCellSelected(2, 0)).toBe(false);
  });
});
