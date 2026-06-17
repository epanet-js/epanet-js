/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useReactTable } from "@tanstack/react-table";
import { CellEditingFeature } from "./cell-editing-feature";
import { CellRangeSelectionFeature } from "./cell-range-selection-feature";
import { LazyRowModelFeature } from "./lazy-row-model-feature";
import { getLazyCoreRowModel } from "../models/lazy-core-row-model";
import { getLazyStickySortedRowModel } from "../models/lazy-sticky-sorted-row-model";

type Row = { a: string; b: string; c: string };

const useFeatureTable = (data: Row[] = []) =>
  useReactTable({
    data,
    columns: [{ accessorKey: "a" }, { accessorKey: "b" }, { accessorKey: "c" }],
    getCoreRowModel: getLazyCoreRowModel(),
    _features: [
      LazyRowModelFeature,
      CellEditingFeature,
      CellRangeSelectionFeature,
    ],
  });

const useGridTable = () =>
  useFeatureTable([
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
    { a: "", b: "", c: "" },
  ]);

type EditableRow = { id: number; label: string; value: number | null };

const editableData: EditableRow[] = [
  { id: 1, label: "Row 1", value: 10 },
  { id: 2, label: "Row 2", value: 20 },
  { id: 3, label: "Row 3", value: 30 },
];

const useEditableTable = (
  onDataChange?: (data: EditableRow[]) => void,
  data: EditableRow[] = editableData,
  onDelete?: (rows: EditableRow[]) => void,
) =>
  useReactTable<EditableRow>({
    data,
    columns: [
      { accessorKey: "label", meta: { isReadOnly: true } },
      { accessorKey: "value", meta: { deleteValue: null } },
    ],
    getCoreRowModel: getLazyCoreRowModel(),
    getSortedRowModel: getLazyStickySortedRowModel(),
    enableSorting: true,
    onDataChange,
    onDelete,
    _features: [
      LazyRowModelFeature,
      CellEditingFeature,
      CellRangeSelectionFeature,
    ],
  });

describe("CellEditingFeature", () => {
  describe("initial state", () => {
    it("starts with no active cell and no edit mode", () => {
      const { result } = renderHook(useGridTable);

      expect(result.current.getActiveCell()).toBeNull();
      expect(result.current.getEditMode()).toBe(false);
    });
  });

  describe("active cell", () => {
    it("sets and reads the active cell", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.setActiveCell({ col: 1, row: 2 });
      });

      expect(result.current.getActiveCell()).toEqual({ col: 1, row: 2 });
    });

    it("clears the active cell when set to null", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });
      act(() => {
        result.current.setActiveCell(null);
      });

      expect(result.current.getActiveCell()).toBeNull();
    });

    it("replaces the previous active cell", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.setActiveCell({ col: 0, row: 0 });
      });
      act(() => {
        result.current.setActiveCell({ col: 2, row: 3 });
      });

      expect(result.current.getActiveCell()).toEqual({ col: 2, row: 3 });
    });
  });

  describe("edit mode", () => {
    it("enters full edit mode by default", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.startEditing();
      });

      expect(result.current.getEditMode()).toBe("full");
    });

    it("enters quick edit mode when specified", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.startEditing("quick");
      });

      expect(result.current.getEditMode()).toBe("quick");
    });

    it("exits edit mode on stopEditing", () => {
      const { result } = renderHook(useGridTable);

      act(() => {
        result.current.startEditing("full");
      });
      act(() => {
        result.current.stopEditing();
      });

      expect(result.current.getEditMode()).toBe(false);
    });

    it("stopEditing is a no-op when not editing (preserves state identity)", () => {
      const { result } = renderHook(useGridTable);

      const before = result.current.getState().cellEditing;
      act(() => {
        result.current.stopEditing();
      });
      const after = result.current.getState().cellEditing;

      expect(after).toBe(before);
    });

    it("preserves the active cell when toggling edit mode", () => {
      const { result } = renderHook(useGridTable);

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
      // (DataGrid.selectCells) coordinates stopEditing when the active
      // cell moves.
      const { result } = renderHook(useGridTable);

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

describe("getActiveCell clamping", () => {
  it("returns null when the grid has no rows even if state has an active cell", () => {
    const { result } = renderHook(useFeatureTable);
    act(() => {
      result.current.setActiveCell({ col: 0, row: 0 });
    });

    expect(result.current.getActiveCell()).toBeNull();
  });

  it("clamps a position that exceeds the current grid bounds", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.setActiveCell({ col: 7, row: 9 });
    });

    expect(result.current.getActiveCell()).toEqual({ col: 2, row: 3 });
  });

  it("leaves an in-bounds position unchanged", () => {
    const { result } = renderHook(useGridTable);
    act(() => {
      result.current.setActiveCell({ col: 1, row: 2 });
    });

    expect(result.current.getActiveCell()).toEqual({ col: 1, row: 2 });
  });
});

describe("getEditMode clamping", () => {
  it("returns false when the grid is empty even if state has an edit mode", () => {
    const { result } = renderHook(useFeatureTable);
    act(() => {
      result.current.startEditing("full");
    });

    expect(result.current.getEditMode()).toBe(false);
  });
});

describe("deleteSelection", () => {
  it("is a no-op when there is no selection", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useEditableTable(onDataChange));

    act(() => {
      result.current.deleteSelection();
    });

    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("is a no-op when readOnly is set", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() =>
      useReactTable<EditableRow>({
        data: editableData,
        columns: [
          { accessorKey: "label" },
          { accessorKey: "value", meta: { deleteValue: null } },
        ],
        getCoreRowModel: getLazyCoreRowModel(),
        onDataChange,
        readOnly: true,
        _features: [
          LazyRowModelFeature,
          CellEditingFeature,
          CellRangeSelectionFeature,
        ],
      }),
    );

    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 1, row: 1 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("calls onDelete with the selected rows when the selection spans all columns", () => {
    const onDataChange = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useEditableTable(onDataChange, editableData, onDelete),
    );

    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDelete).toHaveBeenCalledWith([
      { id: 1, label: "Row 1", value: 10 },
      { id: 2, label: "Row 2", value: 20 },
    ]);
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("falls back to clearing cells on full-row selection when onDelete is not provided", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useEditableTable(onDataChange));

    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, label: "Row 1", value: null },
      { id: 2, label: "Row 2", value: null },
      { id: 3, label: "Row 3", value: 30 },
    ]);
  });

  it("clears cell values on a partial-column selection", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useEditableTable(onDataChange));

    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 1 },
        max: { col: 1, row: 1 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, label: "Row 1", value: 10 },
      { id: 2, label: "Row 2", value: null },
      { id: 3, label: "Row 3", value: 30 },
    ]);
  });

  it("skips read-only columns when clearing", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useEditableTable(onDataChange));

    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 1 },
        max: { col: 0, row: 1 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDataChange).toHaveBeenCalledWith(editableData);
  });

  it("passes the visually-selected row to onDelete when the table is sorted", () => {
    const onDataChange = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useEditableTable(onDataChange, editableData, onDelete),
    );

    act(() => {
      result.current.setSorting([{ id: "label", desc: true }]);
    });
    act(() => {
      result.current.selectRange({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 0 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    expect(onDelete).toHaveBeenCalledWith([
      { id: 3, label: "Row 3", value: 30 },
    ]);
  });

  it("clears the visually-selected cell when the table is sorted", () => {
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useEditableTable(onDataChange));

    // Sort descending → visual order: Row 3, Row 2, Row 1
    act(() => {
      result.current.setSorting([{ id: "label", desc: true }]);
    });
    // Visual row 0 = Row 3. Clear its value.
    act(() => {
      result.current.selectRange({
        min: { col: 1, row: 0 },
        max: { col: 1, row: 0 },
      });
    });
    act(() => {
      result.current.deleteSelection();
    });

    // Result is in source-data order; Row 3's value is null.
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, label: "Row 1", value: 10 },
      { id: 2, label: "Row 2", value: 20 },
      { id: 3, label: "Row 3", value: null },
    ]);
  });
});
