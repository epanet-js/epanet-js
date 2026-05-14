/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  CellEditingFeature,
  clampActiveCell,
  isActiveCellEqual,
  isCellActive,
} from "./cell-editing-feature";

const useFeatureTable = () =>
  useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    _features: [CellEditingFeature],
  });

describe("CellEditingFeature", () => {
  describe("initial state", () => {
    it("starts with no active cell and no edit mode", () => {
      const { result } = renderHook(useFeatureTable);

      expect(result.current.getActiveCell()).toBeNull();
      expect(result.current.getEditMode()).toBe(false);
    });
  });

  describe("active cell", () => {
    it("sets and reads the active cell", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.getActiveCell()).toEqual({ col: 1, row: 2 });
    });

    it("clears the active cell when set to null", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });
      act(() => {
        result.current.setActiveCell(null);
      });

      expect(result.current.getActiveCell()).toBeNull();
    });

    it("replaces the previous active cell", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });
      act(() => {
        result.current.setActiveCell({ col: 3, row: 4 });
      });

      expect(result.current.getActiveCell()).toEqual({ col: 3, row: 4 });
    });
  });

  describe("edit mode", () => {
    it("enters full edit mode by default", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.startEditing();
      });

      expect(result.current.getEditMode()).toBe("full");
    });

    it("enters quick edit mode when specified", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.startEditing("quick");
      });

      expect(result.current.getEditMode()).toBe("quick");
    });

    it("exits edit mode on stopEditing", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.startEditing("full");
      });
      act(() => {
        result.current.stopEditing();
      });

      expect(result.current.getEditMode()).toBe(false);
    });

    it("stopEditing is a no-op when not editing (preserves state identity)", () => {
      const { result } = renderHook(useFeatureTable);

      const before = result.current.getState().cellEditing;
      act(() => {
        result.current.stopEditing();
      });
      const after = result.current.getState().cellEditing;

      expect(after).toBe(before);
    });

    it("preserves the active cell when toggling edit mode", () => {
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });
      act(() => {
        result.current.startEditing("full");
      });

      expect(result.current.getActiveCell()).toEqual({ col: 2, row: 3 });

      act(() => {
        result.current.stopEditing();
      });

      expect(result.current.getActiveCell()).toEqual({ col: 2, row: 3 });
    });

    it("preserves edit mode when changing the active cell", () => {
      // Note: this is the feature primitive's behavior. The consumer
      // (DataGridWithFeatures.selectCells) coordinates stopEditing when
      // the active cell moves.
      const { result } = renderHook(useFeatureTable);

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });
      act(() => {
        result.current.startEditing("quick");
      });
      act(() => {
        result.current.setActiveCell({ col: 1, row: 1 });
      });

      expect(result.current.getEditMode()).toBe("quick");
    });
  });
});

describe("isActiveCellEqual", () => {
  it("returns true for two nulls", () => {
    expect(isActiveCellEqual(null, null)).toBe(true);
  });

  it("returns false when only one side is null", () => {
    expect(isActiveCellEqual(null, { col: 0, row: 0 })).toBe(false);
    expect(isActiveCellEqual({ col: 0, row: 0 }, null)).toBe(false);
  });

  it("returns true for cells at the same position", () => {
    expect(isActiveCellEqual({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(
      true,
    );
  });

  it("returns false for cells at different positions", () => {
    expect(isActiveCellEqual({ col: 1, row: 2 }, { col: 2, row: 1 })).toBe(
      false,
    );
  });
});

describe("clampActiveCell", () => {
  it("returns null for null input", () => {
    expect(clampActiveCell(null, 5, 5)).toBeNull();
  });

  it("leaves positions within bounds unchanged", () => {
    expect(clampActiveCell({ col: 1, row: 2 }, 5, 5)).toEqual({
      col: 1,
      row: 2,
    });
  });

  it("clamps positions past the new bounds", () => {
    expect(clampActiveCell({ col: 7, row: 9 }, 3, 4)).toEqual({
      col: 2,
      row: 3,
    });
  });

  it("clamps column independently of row", () => {
    expect(clampActiveCell({ col: 7, row: 1 }, 3, 5)).toEqual({
      col: 2,
      row: 1,
    });
  });
});

describe("isCellActive", () => {
  it("returns false when there is no active cell", () => {
    expect(isCellActive(null, 0, 0)).toBe(false);
  });

  it("returns true when col and row match the active cell", () => {
    expect(isCellActive({ col: 2, row: 3 }, 2, 3)).toBe(true);
  });

  it("returns false when either col or row differs", () => {
    expect(isCellActive({ col: 2, row: 3 }, 1, 3)).toBe(false);
    expect(isCellActive({ col: 2, row: 3 }, 2, 4)).toBe(false);
  });
});
