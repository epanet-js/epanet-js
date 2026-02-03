/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import {
  useSelection,
  isFullRowSelected,
  isCellSelected,
  isCellActive,
} from "./use-selection";

describe("useSelection", () => {
  const defaultOptions = {
    rowCount: 5,
    colCount: 3,
    stopEditing: vi.fn(),
  };

  describe("initial state", () => {
    it("starts with no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
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

    it("calls stopEditing when cell changes", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });

      stopEditing.mockClear();

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(stopEditing).toHaveBeenCalled();
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

  describe("select row", () => {
    it("selects entire row when only rowIndex provided", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ rowIndex: 1 });
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 1 }, // colCount - 1
      });
    });

    it("extends row selection when extend is true", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ rowIndex: 0 });
      });

      act(() => {
        result.current.selectCells({ rowIndex: 2, extend: true });
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
        result.current.selectCells({ rowIndex: 1 });
      });

      expect(
        isFullRowSelected(result.current.selection, defaultOptions.colCount),
      ).toBe(true);
    });

    it("returns false when partial row is selected", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(
        isFullRowSelected(result.current.selection, defaultOptions.colCount),
      ).toBe(false);
    });

    it("returns false when no selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(
        isFullRowSelected(result.current.selection, defaultOptions.colCount),
      ).toBe(false);
    });
  });

  describe("isCellSelected", () => {
    it("returns true for cells within selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells(); // select all
      });

      expect(isCellSelected(result.current.selection, 1, 1)).toBe(true);
      expect(isCellSelected(result.current.selection, 0, 0)).toBe(true);
      expect(isCellSelected(result.current.selection, 2, 4)).toBe(true);
    });

    it("returns false for cells outside selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ rowIndex: 0 }); // select first row only
      });

      expect(isCellSelected(result.current.selection, 2, 2)).toBe(false);
      expect(isCellSelected(result.current.selection, 0, 3)).toBe(false);
    });

    it("returns false when no selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(isCellSelected(result.current.selection, 0, 0)).toBe(false);
    });
  });

  describe("isCellActive", () => {
    it("returns true for active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(isCellActive(result.current.activeCell, 1, 2)).toBe(true);
    });

    it("returns false for non-active cells", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(isCellActive(result.current.activeCell, 0, 0)).toBe(false);
      expect(isCellActive(result.current.activeCell, 1, 1)).toBe(false);
    });

    it("returns false when no active cell", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(isCellActive(result.current.activeCell, 0, 0)).toBe(false);
    });
  });

  describe("select column", () => {
    it("selects entire column when only colIndex provided", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1 });
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 0 },
        max: { col: 1, row: 4 }, // rowCount - 1
      });
    });

    it("sets active cell to bottom of column", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1 });
      });

      expect(result.current.activeCell).toEqual({ col: 1, row: 4 });
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 2 });
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 2, row: 0 },
        max: { col: 2, row: 4 },
      });
    });
  });

  describe("select all", () => {
    it("selects all cells when no indices provided", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells();
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 4 }, // colCount - 1, rowCount - 1
      });
    });

    it("sets active cell to bottom-right corner", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells();
      });

      expect(result.current.activeCell).toEqual({ col: 2, row: 4 });
    });

    it("does nothing when rowCount is 0", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 0, colCount: 3, stopEditing: vi.fn() }),
      );

      act(() => {
        result.current.selectCells();
      });

      expect(result.current.selection).toBeNull();
    });

    it("does nothing when colCount is 0", () => {
      const { result } = renderHook(() =>
        useSelection({ rowCount: 5, colCount: 0, stopEditing: vi.fn() }),
      );

      act(() => {
        result.current.selectCells();
      });

      expect(result.current.selection).toBeNull();
    });

    it("calls onSelectionChange callback", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectCells();
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 0, row: 0 },
        max: { col: 2, row: 4 },
      });
    });
  });

  describe("select single cell", () => {
    it("selects single cell when both indices provided", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 2 },
        max: { col: 1, row: 2 },
      });
    });
  });

  describe("clamps selection when grid size decreases", () => {
    it("clamps active cell row when rowCount decreases", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
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
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
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
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
        { initialProps: { rowCount: 10, colCount: 3 } },
      );

      act(() => {
        result.current.selectCells({ rowIndex: 5 });
      });
      act(() => {
        result.current.selectCells({ rowIndex: 9, extend: true });
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
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
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
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
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
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
        { initialProps: { rowCount: 5, colCount: 3 } },
      );

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      rerender({ rowCount: 10, colCount: 5 });

      expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
    });
  });
});
