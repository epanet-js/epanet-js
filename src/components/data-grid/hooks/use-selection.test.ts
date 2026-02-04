/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import {
  useSelection,
  isSingleCellSelection,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with no selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });
  });

  describe("selectCells", () => {
    describe("single cell", () => {
      it("selects a single cell", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ colIndex: 1, rowIndex: 2 });
        });

        expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
        expect(result.current.selection).toEqual({
          min: { col: 1, row: 2 },
          max: { col: 1, row: 2 },
        });
      });

      it("replaces previous selection", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ colIndex: 0, rowIndex: 0 });
        });
        act(() => {
          result.current.selectCells({ colIndex: 2, rowIndex: 3 });
        });

        expect(result.current.activeCell).toEqual({ col: 2, row: 3 });
        expect(result.current.selection).toEqual({
          min: { col: 2, row: 3 },
          max: { col: 2, row: 3 },
        });
      });
    });

    describe("entire row", () => {
      it("selects entire row when only rowIndex provided", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ rowIndex: 1 });
        });

        expect(result.current.selection).toEqual({
          min: { col: 0, row: 1 },
          max: { col: 2, row: 1 },
        });
      });

      it("sets active cell to end of row", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ rowIndex: 2 });
        });

        expect(result.current.activeCell).toEqual({ col: 2, row: 2 });
      });
    });

    describe("entire column", () => {
      it("selects entire column when only colIndex provided", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ colIndex: 1 });
        });

        expect(result.current.selection).toEqual({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 4 },
        });
      });

      it("sets active cell to bottom of column", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells({ colIndex: 1 });
        });

        expect(result.current.activeCell).toEqual({ col: 1, row: 4 });
      });
    });

    describe("all cells", () => {
      it("selects all cells when no indices provided", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells();
        });

        expect(result.current.selection).toEqual({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 4 },
        });
      });

      it("sets active cell to bottom-right corner", () => {
        const { result } = renderHook(() => useSelection(defaultOptions));

        act(() => {
          result.current.selectCells();
        });

        expect(result.current.activeCell).toEqual({ col: 2, row: 4 });
      });
    });

    describe("empty grid", () => {
      it("does nothing when rowCount is 0", () => {
        const { result } = renderHook(() =>
          useSelection({ rowCount: 0, colCount: 3, stopEditing: vi.fn() }),
        );

        act(() => {
          result.current.selectCells({ colIndex: 0, rowIndex: 0 });
        });

        expect(result.current.selection).toBeNull();
      });

      it("does nothing when colCount is 0", () => {
        const { result } = renderHook(() =>
          useSelection({ rowCount: 5, colCount: 0, stopEditing: vi.fn() }),
        );

        act(() => {
          result.current.selectCells({ colIndex: 0, rowIndex: 0 });
        });

        expect(result.current.selection).toBeNull();
      });
    });
  });

  describe("extend selection", () => {
    it("extends from single cell to larger range", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1 });
      });
      act(() => {
        result.current.selectCells({ colIndex: 2, rowIndex: 3, extend: true });
      });

      expect(result.current.selection).toEqual({
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      });
    });

    it("extends selection upward and leftward", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 2, rowIndex: 3 });
      });
      act(() => {
        result.current.selectCells({ colIndex: 0, rowIndex: 1, extend: true });
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 3 },
      });
    });

    it("extends row selection to more rows", () => {
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

    it("does nothing when extend is true but no existing selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1, extend: true });
      });

      // Should create a new selection instead
      expect(result.current.selection).toEqual({
        min: { col: 1, row: 1 },
        max: { col: 1, row: 1 },
      });
    });

    it("uses union of existing range and target", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      // Select rows 1-2
      act(() => {
        result.current.selectCells({ rowIndex: 1 });
      });
      act(() => {
        result.current.selectCells({ rowIndex: 2, extend: true });
      });

      // Extend to row 4, should include rows 1-4
      act(() => {
        result.current.selectCells({ rowIndex: 4, extend: true });
      });

      expect(result.current.selection).toEqual({
        min: { col: 0, row: 1 },
        max: { col: 2, row: 4 },
      });
    });
  });

  describe("clearSelection", () => {
    it("clears active cell and selection", () => {
      const { result } = renderHook(() => useSelection(defaultOptions));

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1 });
      });
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });

    it("calls stopEditing", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 0, rowIndex: 0 });
      });
      stopEditing.mockClear();

      act(() => {
        result.current.clearSelection();
      });

      expect(stopEditing).toHaveBeenCalled();
    });

    it("calls onSelectionChange with null", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 0, rowIndex: 0 });
      });
      act(() => {
        result.current.clearSelection();
      });

      expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe("stopEditing behavior", () => {
    it("calls stopEditing when cell changes", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 0, rowIndex: 0 });
      });
      stopEditing.mockClear();

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1 });
      });

      expect(stopEditing).toHaveBeenCalled();
    });

    it("calls stopEditing when selecting multiple cells", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.selectCells({ rowIndex: 0 }); // Select entire row
      });

      expect(stopEditing).toHaveBeenCalled();
    });

    it("calls stopEditing when extending selection", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 0, rowIndex: 0 });
      });
      stopEditing.mockClear();

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1, extend: true });
      });

      expect(stopEditing).toHaveBeenCalled();
    });

    it("does not call stopEditing when selecting same single cell", () => {
      const stopEditing = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, stopEditing }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1 });
      });
      stopEditing.mockClear();

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 1 });
      });

      expect(stopEditing).not.toHaveBeenCalled();
    });
  });

  describe("onSelectionChange callback", () => {
    it("is called when selection changes", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 1, row: 2 },
        max: { col: 1, row: 2 },
      });
    });

    it("is called with full range for row selection", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ ...defaultOptions, onSelectionChange }),
      );

      act(() => {
        result.current.selectCells({ rowIndex: 2 });
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 0, row: 2 },
        max: { col: 2, row: 2 },
      });
    });
  });

  describe("grid size changes", () => {
    it("clamps active cell row when rowCount decreases", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
        { initialProps: { rowCount: 10, colCount: 3 } },
      );

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 8 });
      });

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
        result.current.selectCells({ colIndex: 8, rowIndex: 2 });
      });

      rerender({ rowCount: 5, colCount: 5 });

      expect(result.current.activeCell).toEqual({ col: 4, row: 2 });
    });

    it("clamps range selection when it spans deleted rows", () => {
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
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
      });

      rerender({ rowCount: 0, colCount: 3 });

      expect(result.current.activeCell).toBeNull();
      expect(result.current.selection).toBeNull();
    });

    it("clears selection when all columns are removed", () => {
      const { result, rerender } = renderHook(
        ({ rowCount, colCount }) =>
          useSelection({ rowCount, colCount, stopEditing: vi.fn() }),
        { initialProps: { rowCount: 5, colCount: 3 } },
      );

      act(() => {
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
      });

      rerender({ rowCount: 5, colCount: 0 });

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
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
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
        result.current.selectCells({ colIndex: 1, rowIndex: 2 });
      });

      rerender({ rowCount: 10, colCount: 5 });

      expect(result.current.activeCell).toEqual({ col: 1, row: 2 });
    });
  });

  describe("helper functions", () => {
    describe("isSingleCellSelection", () => {
      it("returns true for single cell selection", () => {
        expect(
          isSingleCellSelection({
            min: { col: 1, row: 2 },
            max: { col: 1, row: 2 },
          }),
        ).toBe(true);
      });

      it("returns false for multi-cell selection", () => {
        expect(
          isSingleCellSelection({
            min: { col: 0, row: 0 },
            max: { col: 1, row: 1 },
          }),
        ).toBe(false);
      });

      it("returns false for row selection", () => {
        expect(
          isSingleCellSelection({
            min: { col: 0, row: 1 },
            max: { col: 2, row: 1 },
          }),
        ).toBe(false);
      });

      it("returns false for column selection", () => {
        expect(
          isSingleCellSelection({
            min: { col: 1, row: 0 },
            max: { col: 1, row: 4 },
          }),
        ).toBe(false);
      });

      it("returns false when no selection", () => {
        expect(isSingleCellSelection(null)).toBe(false);
      });
    });

    describe("isFullRowSelected", () => {
      it("returns true when selection spans all columns", () => {
        expect(
          isFullRowSelected(
            { min: { col: 0, row: 1 }, max: { col: 2, row: 1 } },
            3,
          ),
        ).toBe(true);
      });

      it("returns false when selection does not start at column 0", () => {
        expect(
          isFullRowSelected(
            { min: { col: 1, row: 1 }, max: { col: 2, row: 1 } },
            3,
          ),
        ).toBe(false);
      });

      it("returns false when selection does not end at last column", () => {
        expect(
          isFullRowSelected(
            { min: { col: 0, row: 1 }, max: { col: 1, row: 1 } },
            3,
          ),
        ).toBe(false);
      });

      it("returns false when no selection", () => {
        expect(isFullRowSelected(null, 3)).toBe(false);
      });
    });

    describe("isCellSelected", () => {
      const selection = {
        min: { col: 1, row: 1 },
        max: { col: 2, row: 3 },
      };

      it("returns true for cells within selection", () => {
        expect(isCellSelected(selection, 1, 1)).toBe(true);
        expect(isCellSelected(selection, 2, 2)).toBe(true);
        expect(isCellSelected(selection, 2, 3)).toBe(true);
      });

      it("returns false for cells outside selection", () => {
        expect(isCellSelected(selection, 0, 0)).toBe(false);
        expect(isCellSelected(selection, 0, 2)).toBe(false);
        expect(isCellSelected(selection, 2, 4)).toBe(false);
      });

      it("returns false when no selection", () => {
        expect(isCellSelected(null, 1, 1)).toBe(false);
      });
    });

    describe("isCellActive", () => {
      it("returns true for active cell", () => {
        expect(isCellActive({ col: 1, row: 2 }, 1, 2)).toBe(true);
      });

      it("returns false for non-active cells", () => {
        expect(isCellActive({ col: 1, row: 2 }, 0, 0)).toBe(false);
        expect(isCellActive({ col: 1, row: 2 }, 1, 0)).toBe(false);
        expect(isCellActive({ col: 1, row: 2 }, 0, 2)).toBe(false);
      });

      it("returns false when no active cell", () => {
        expect(isCellActive(null, 1, 2)).toBe(false);
      });
    });
  });
});
