/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useSelection } from "./use-selection";

describe("useSelection", () => {
  const defaultOptions = {
    rowCount: 5,
    colCount: 3,
  };

  describe("initial state", () => {
    it("starts with no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("setActiveCell", () => {
    it("sets the active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
    });

    it("creates a single-cell selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 2 },
        max: { col: 1, row: 2 },
      });
    });

    it("extends selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.setActiveCell({ col: 2, row: 2 }, true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 2 },
      });
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 1, row: 1 },
        max: { col: 1, row: 1 },
      });
    });

    it("stops editing when cell changes", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
        result.current.startEditing();
      });

      expect(result.current.isEditing).toBe(true);

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("setSelection", () => {
    it("sets a multi-cell selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setSelection({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 3 },
        });
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 3 },
      });
    });

    it("sets active cell to max of selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setSelection({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 3 },
        });
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 3 });
    });

    it("clears selection when set to null", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.setSelection(null);
      });

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });
  });

  describe("clearSelection", () => {
    it("clears active cell and selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });

    it("calls onSelectionChange with null", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe("startEditing / stopEditing", () => {
    it("toggles editing state", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.isEditing).toBe(false);

      act(() => {
        result.current.startEditing();
      });

      expect(result.current.isEditing).toBe(true);

      act(() => {
        result.current.stopEditing();
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("moveActiveCell", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("moves up", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveActiveCell("up");
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 1 });
    });

    it("moves down", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveActiveCell("down");
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 3 });
    });

    it("moves left", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveActiveCell("left");
      });

      expect(result.current.activeCell).toEqual({ col: 0, row: 2 });
    });

    it("moves right", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveActiveCell("right");
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 2 });
    });

    it("does not move past top boundary", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 0 });
      });

      act(() => {
        result.current.moveActiveCell("up");
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 0 });
    });

    it("does not move past bottom boundary", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 4 }); // rowCount - 1
      });

      act(() => {
        result.current.moveActiveCell("down");
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 4 });
    });

    it("does not move past left boundary", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 1 });
      });

      act(() => {
        result.current.moveActiveCell("left");
      });

      expect(result.current.activeCell).toEqual({ col: 0, row: 1 });
    });

    it("does not move past right boundary", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 1 }); // colCount - 1
      });

      act(() => {
        result.current.moveActiveCell("right");
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 1 });
    });

    it("extends selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      act(() => {
        result.current.moveActiveCell("down", true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 1 },
        max: { col: 1, row: 2 },
      });
    });

    it("does nothing if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveActiveCell("down");
      });

      expect(result.current.activeCell).toBeNull();
    });
  });

  describe("selectRow", () => {
    it("selects entire row", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectRow(1);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 1 }, // colCount - 1
      });
    });

    it("extends row selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectRow(0);
      });

      act(() => {
        result.current.selectRow(2, true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 2 },
      });
    });
  });

  describe("isFullRowSelected", () => {
    it("returns true when entire row is selected", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectRow(1);
      });

      expect(result.current.isFullRowSelected).toBe(true);
    });

    it("returns false when partial row is selected", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(result.current.isFullRowSelected).toBe(false);
    });

    it("returns false when no selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.isFullRowSelected).toBe(false);
    });
  });

  describe("isCellSelected", () => {
    it("returns true for cells within selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setSelection({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 2 },
        });
      });

      expect(result.current.isCellSelected(1, 1)).toBe(true);
      expect(result.current.isCellSelected(0, 0)).toBe(true);
      expect(result.current.isCellSelected(2, 2)).toBe(true);
    });

    it("returns false for cells outside selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setSelection({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 1 },
        });
      });

      expect(result.current.isCellSelected(2, 2)).toBe(false);
      expect(result.current.isCellSelected(0, 3)).toBe(false);
    });

    it("returns false when no selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.isCellSelected(0, 0)).toBe(false);
    });
  });

  describe("isCellActive", () => {
    it("returns true for active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.isCellActive(1, 2)).toBe(true);
    });

    it("returns false for non-active cells", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.isCellActive(0, 0)).toBe(false);
      expect(result.current.isCellActive(1, 1)).toBe(false);
    });

    it("returns false when no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.isCellActive(0, 0)).toBe(false);
    });
  });

  describe("selectColumn", () => {
    it("selects entire column", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectColumn(1);
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 0 },
        max: { col: 1, row: 4 }, // rowCount - 1
      });
    });

    it("sets active cell to bottom of column", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectColumn(1);
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 4 });
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectColumn(2);
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 2, row: 0 },
        max: { col: 2, row: 4 },
      });
    });
  });

  describe("selectAll", () => {
    it("selects all cells", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 4 }, // colCount - 1, rowCount - 1
      });
    });

    it("sets active cell to bottom-right corner", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 4 });
    });

    it("does nothing when rowCount is 0", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 0, colCount: 3 }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selection).toBeNull();
    });

    it("does nothing when colCount is 0", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 5, colCount: 0 }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selection).toBeNull();
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectAll();
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 4 },
      });
    });
  });

  describe("moveToRowStart", () => {
    it("moves to first column of current row", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      act(() => {
        result.current.moveToRowStart();
      });

      expect(result.current.activeCell).toEqual({ col: 0, row: 3 });
    });

    it("creates single-cell selection at new position", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      act(() => {
        result.current.moveToRowStart();
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 3 },
        max: { col: 0, row: 3 },
      });
    });

    it("extends selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 1 });
      });

      act(() => {
        result.current.moveToRowStart(true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 1 },
      });
    });

    it("does nothing if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveToRowStart();
      });

      expect(result.current.activeCell).toBeNull();
    });
  });

  describe("moveToRowEnd", () => {
    it("moves to last column of current row", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 2 });
      });

      act(() => {
        result.current.moveToRowEnd();
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 2 });
    });

    it("creates single-cell selection at new position", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 2 });
      });

      act(() => {
        result.current.moveToRowEnd();
      });

      expect(result.current.selection).toEqual({
        min: { col: 2, row: 2 },
        max: { col: 2, row: 2 },
      });
    });

    it("extends selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 1 });
      });

      act(() => {
        result.current.moveToRowEnd(true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 1 },
      });
    });

    it("does nothing if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveToRowEnd();
      });

      expect(result.current.activeCell).toBeNull();
    });
  });

  describe("moveToGridStart", () => {
    it("moves to first cell (0, 0)", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      act(() => {
        result.current.moveToGridStart();
      });

      expect(result.current.activeCell).toEqual({ col: 0, row: 0 });
    });

    it("creates single-cell selection at (0, 0)", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      act(() => {
        result.current.moveToGridStart();
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 0, row: 0 },
      });
    });

    it("extends selection from anchor to (0, 0) when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      act(() => {
        result.current.moveToGridStart(true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 3 },
      });
    });

    it("sets cell to (0, 0) even if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveToGridStart();
      });

      expect(result.current.activeCell).toEqual({ col: 0, row: 0 });
    });
  });

  describe("moveToGridEnd", () => {
    it("moves to last cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.moveToGridEnd();
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 4 });
    });

    it("creates single-cell selection at last cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.moveToGridEnd();
      });

      expect(result.current.selection).toEqual({
        min: { col: 2, row: 4 },
        max: { col: 2, row: 4 },
      });
    });

    it("extends selection from anchor to last cell when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      act(() => {
        result.current.moveToGridEnd(true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 4 },
      });
    });

    it("sets cell to last cell even if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveToGridEnd();
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 4 });
    });
  });

  describe("clamps selection when grid size decreases", () => {
    it("clamps active cell row when rowCount decreases", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 10, colCount: 3 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 8 });
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 8 });

      rerender({ rowCount: 5, colCount: 3 });

      expect(result.current.activeCell).toEqual({ col: 1, row: 4 });
    });

    it("clamps active cell col when colCount decreases", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 5, colCount: 10 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 8, row: 2 });
      });

      expect(result.current.activeCell).toEqual({ col: 8, row: 2 });

      rerender({ rowCount: 5, colCount: 5 });

      expect(result.current.activeCell).toEqual({ col: 4, row: 2 });
    });

    it("clamps both anchor and active cell when selection spans deleted rows", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 10, colCount: 3 } },
      );

      act(() => {
        result.current.setSelection({
          min: { col: 0, row: 5 },
          max: { col: 2, row: 9 },
        });
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 5 },
        max: { col: 2, row: 9 },
      });

      rerender({ rowCount: 7, colCount: 3 });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 5 },
        max: { col: 2, row: 6 },
      });
    });

    it("clears selection when all rows are removed", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 5, colCount: 3 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      rerender({ rowCount: 0, colCount: 3 });

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });

    it("does not change selection when grid size stays the same", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 5, colCount: 3 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      rerender({ rowCount: 5, colCount: 3 });

      expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
    });

    it("does not change selection when grid size increases", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) => useSelection({ rowCount, colCount }),
        { initialProps: { rowCount: 5, colCount: 3 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      rerender({ rowCount: 10, colCount: 5 });

      expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
    });
  });

  describe("moveByPage", () => {
    it("moves down by page size", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 100, colCount: 3 }),
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 0 });
      });

      act(() => {
        result.current.moveByPage("down", 10);
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 10 });
    });

    it("moves up by page size", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 100, colCount: 3 }),
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 50 });
      });

      act(() => {
        result.current.moveByPage("up", 10);
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 40 });
    });

    it("does not go below row 0", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveByPage("up", 10);
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 0 });
    });

    it("does not go past last row", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      act(() => {
        result.current.moveByPage("down", 10);
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 4 }); // rowCount - 1
    });

    it("extends selection when extend is true", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 100, colCount: 3 }),
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 10 });
      });

      act(() => {
        result.current.moveByPage("down", 5, true);
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 10 },
        max: { col: 1, row: 15 },
      });
    });

    it("does nothing if no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.moveByPage("down", 10);
      });

      expect(result.current.activeCell).toBeNull();
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ rowCount: 100, colCount: 3, onSelectionChange }),
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 0 });
      });

      act(() => {
        result.current.moveByPage("down", 10);
      });

      expect(onSelectionChange).toHaveBeenLastCalledWith({
        min: { col: 1, row: 10 },
        max: { col: 1, row: 10 },
      });
    });
  });
});
