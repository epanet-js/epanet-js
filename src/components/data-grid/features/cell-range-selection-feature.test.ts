/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  CellRangeSelectionFeature,
  clampRange,
  computeExtendedRange,
  computeTargetSelection,
  isCellSelected,
  isFullRowSelected,
  isRangeEqual,
  isSingleCellSelection,
} from "./cell-range-selection-feature";

const useFeatureTable = () =>
  useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    _features: [CellRangeSelectionFeature],
  });

describe("CellRangeSelectionFeature", () => {
  describe("initial state", () => {
    it("starts with no selection", () => {
      const { result } = renderHook(useFeatureTable);

      expect(result.current.getSelection()).toBeNull();
    });
  });

  describe("selectRange", () => {
    it("sets the selection range", () => {
      const { result } = renderHook(useFeatureTable);

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
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });
      act(() => {
        result.current.selectRange({
          min: { col: 1, row: 1 },
          max: { col: 4, row: 4 },
        });
      });

      expect(result.current.getSelection()).toEqual({
        min: { col: 1, row: 1 },
        max: { col: 4, row: 4 },
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

describe("computeTargetSelection", () => {
  it("returns a single-cell range when both indices are provided", () => {
    expect(computeTargetSelection(1, 2, 5, 5)).toEqual({
      min: { col: 1, row: 2 },
      max: { col: 1, row: 2 },
    });
  });

  it("returns a full-column range when only colIndex is provided", () => {
    expect(computeTargetSelection(2, undefined, 5, 4)).toEqual({
      min: { col: 2, row: 0 },
      max: { col: 2, row: 3 },
    });
  });

  it("returns a full-row range when only rowIndex is provided", () => {
    expect(computeTargetSelection(undefined, 1, 4, 5)).toEqual({
      min: { col: 0, row: 1 },
      max: { col: 3, row: 1 },
    });
  });

  it("returns the entire grid when neither index is provided", () => {
    expect(computeTargetSelection(undefined, undefined, 3, 4)).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 3 },
    });
  });
});

describe("computeExtendedRange", () => {
  it("extends to the bottom-right corner when the target is past max", () => {
    const current = {
      min: { col: 0, row: 0 },
      max: { col: 0, row: 0 },
    };
    const target = {
      min: { col: 2, row: 3 },
      max: { col: 2, row: 3 },
    };

    const { combined, movingCorner } = computeExtendedRange(current, target);

    expect(combined).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 3 },
    });
    expect(movingCorner).toEqual({ col: 2, row: 3 });
  });

  it("extends to the top-left corner when the target is before min", () => {
    const current = {
      min: { col: 2, row: 3 },
      max: { col: 2, row: 3 },
    };
    const target = {
      min: { col: 0, row: 0 },
      max: { col: 0, row: 0 },
    };

    const { combined, movingCorner } = computeExtendedRange(current, target);

    expect(combined).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 2, row: 3 },
    });
    expect(movingCorner).toEqual({ col: 0, row: 0 });
  });

  it("places the moving corner asymmetrically when extending diagonally", () => {
    // Extending up-and-right
    const current = {
      min: { col: 0, row: 2 },
      max: { col: 0, row: 2 },
    };
    const target = {
      min: { col: 3, row: 0 },
      max: { col: 3, row: 0 },
    };

    const { combined, movingCorner } = computeExtendedRange(current, target);

    expect(combined).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 3, row: 2 },
    });
    // extendingRight (target.max.col > current.max.col) → right
    // extendingDown (target.max.row < current.max.row) → up
    expect(movingCorner).toEqual({ col: 3, row: 0 });
  });

  it("handles a target fully inside the current range (no expansion)", () => {
    const current = {
      min: { col: 0, row: 0 },
      max: { col: 5, row: 5 },
    };
    const target = {
      min: { col: 2, row: 2 },
      max: { col: 2, row: 2 },
    };

    const { combined } = computeExtendedRange(current, target);

    expect(combined).toEqual({
      min: { col: 0, row: 0 },
      max: { col: 5, row: 5 },
    });
  });
});

describe("clampRange", () => {
  it("returns null for null input", () => {
    expect(clampRange(null, 5, 5)).toBeNull();
  });

  it("leaves a range within bounds unchanged", () => {
    expect(
      clampRange({ min: { col: 0, row: 0 }, max: { col: 2, row: 2 } }, 5, 5),
    ).toEqual({ min: { col: 0, row: 0 }, max: { col: 2, row: 2 } });
  });

  it("clamps max past the new bounds", () => {
    expect(
      clampRange({ min: { col: 0, row: 0 }, max: { col: 9, row: 9 } }, 3, 4),
    ).toEqual({ min: { col: 0, row: 0 }, max: { col: 2, row: 3 } });
  });
});

describe("isRangeEqual", () => {
  it("returns true for two nulls", () => {
    expect(isRangeEqual(null, null)).toBe(true);
  });

  it("returns false when only one side is null", () => {
    expect(
      isRangeEqual(null, { min: { col: 0, row: 0 }, max: { col: 0, row: 0 } }),
    ).toBe(false);
  });

  it("returns true for two equal ranges", () => {
    expect(
      isRangeEqual(
        { min: { col: 1, row: 2 }, max: { col: 3, row: 4 } },
        { min: { col: 1, row: 2 }, max: { col: 3, row: 4 } },
      ),
    ).toBe(true);
  });

  it("returns false when any corner differs", () => {
    expect(
      isRangeEqual(
        { min: { col: 1, row: 2 }, max: { col: 3, row: 4 } },
        { min: { col: 1, row: 2 }, max: { col: 3, row: 5 } },
      ),
    ).toBe(false);
  });
});

describe("isSingleCellSelection", () => {
  it("returns false for null", () => {
    expect(isSingleCellSelection(null)).toBe(false);
  });

  it("returns true when min and max are the same cell", () => {
    expect(
      isSingleCellSelection({
        min: { col: 1, row: 2 },
        max: { col: 1, row: 2 },
      }),
    ).toBe(true);
  });

  it("returns false for a multi-cell range", () => {
    expect(
      isSingleCellSelection({
        min: { col: 1, row: 2 },
        max: { col: 1, row: 3 },
      }),
    ).toBe(false);
  });
});

describe("isFullRowSelected", () => {
  it("returns false for null", () => {
    expect(isFullRowSelected(null, 5)).toBe(false);
  });

  it("returns true when the range spans col 0 through colCount-1", () => {
    expect(
      isFullRowSelected(
        { min: { col: 0, row: 1 }, max: { col: 4, row: 1 } },
        5,
      ),
    ).toBe(true);
  });

  it("returns false when the range stops short", () => {
    expect(
      isFullRowSelected(
        { min: { col: 0, row: 1 }, max: { col: 3, row: 1 } },
        5,
      ),
    ).toBe(false);
  });
});

describe("isCellSelected", () => {
  it("returns false when there is no selection", () => {
    expect(isCellSelected(null, 0, 0)).toBe(false);
  });

  it("returns true for a cell inside the range", () => {
    expect(
      isCellSelected(
        { min: { col: 1, row: 1 }, max: { col: 3, row: 3 } },
        2,
        2,
      ),
    ).toBe(true);
  });

  it("includes the boundaries", () => {
    const range = { min: { col: 1, row: 1 }, max: { col: 3, row: 3 } };
    expect(isCellSelected(range, 1, 1)).toBe(true);
    expect(isCellSelected(range, 3, 3)).toBe(true);
  });

  it("returns false for cells outside the range", () => {
    const range = { min: { col: 1, row: 1 }, max: { col: 3, row: 3 } };
    expect(isCellSelected(range, 0, 0)).toBe(false);
    expect(isCellSelected(range, 4, 4)).toBe(false);
    expect(isCellSelected(range, 2, 0)).toBe(false);
  });
});
