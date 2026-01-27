/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
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
});
