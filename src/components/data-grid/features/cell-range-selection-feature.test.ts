/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
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
