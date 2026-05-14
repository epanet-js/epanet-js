/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CellRangeSelectionFeature } from "./cell-range-selection-feature";
import { ClipboardFeature } from "./clipboard-feature";
import type { GridColumn, GridSelection } from "../types";

type TestRow = { id: string; name: string; value: string };

const createTestColumns = (): GridColumn[] => [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const createTestRow = (): TestRow => ({ id: "", name: "", value: "" });

type TableOptions = {
  data: TestRow[];
  columns?: GridColumn[];
  onChange?: (data: TestRow[]) => void;
  readOnly?: boolean;
  includeHeadersOnCopy?: boolean;
  autoExtendOnPaste?: boolean;
  onClipboardCopy?: (info: unknown) => void;
  onClipboardPaste?: (info: unknown) => void;
  sortable?: boolean;
};

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: "id" },
  { accessorKey: "name" },
  { accessorKey: "value" },
];

const useClipboardTable = (options: TableOptions) =>
  useReactTable({
    data: options.data,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    ...(options.sortable
      ? {
          getSortedRowModel: getSortedRowModel(),
          enableSorting: true,
        }
      : {}),
    _features: [CellRangeSelectionFeature, ClipboardFeature],
    gridColumns: options.columns ?? createTestColumns(),
    onDataChange: options.onChange,
    createRow: createTestRow,
    readOnly: options.readOnly,
    includeHeadersOnCopy: options.includeHeadersOnCopy,
    autoExtendOnPaste: options.autoExtendOnPaste,
    onClipboardCopy: options.onClipboardCopy as never,
    onClipboardPaste: options.onClipboardPaste as never,
  });

const stubClipboard = (initialText = "") => {
  let stored = initialText;
  const writeText = vi.fn((text: string) => {
    stored = text;
    return Promise.resolve();
  });
  const readText = vi.fn(() => Promise.resolve(stored));
  Object.assign(navigator, { clipboard: { writeText, readText } });
  return { writeText, readText, getText: () => stored };
};

const single = (col: number, row: number): GridSelection => ({
  min: { col, row },
  max: { col, row },
});

describe("ClipboardFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("copySelection", () => {
    it("writes the selected cell's value to the clipboard", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];

      const { result } = renderHook(() => useClipboardTable({ data }));
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("Alice");
    });

    it("writes a tab-separated row for a multi-column selection", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() => useClipboardTable({ data }));
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 0 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("1\tAlice\t100");
    });

    it("writes newline-joined rows for a multi-row selection", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];

      const { result } = renderHook(() => useClipboardTable({ data }));
      act(() =>
        result.current.selectRange({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("Alice\nBob");
    });

    it("prepends headers when includeHeaders is true", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() => useClipboardTable({ data }));
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 0 },
        }),
      );

      await act(async () => {
        await result.current.copySelection({ includeHeaders: true });
      });

      expect(clip.writeText).toHaveBeenCalledWith(
        "ID\tName\tValue\n1\tAlice\t100",
      );
    });

    it("uses includeHeadersOnCopy table option when no explicit flag is passed", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, includeHeadersOnCopy: true }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("ID\n1");
    });

    it("explicit includeHeaders:false overrides includeHeadersOnCopy", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, includeHeadersOnCopy: true }),
      );
      act(() => result.current.selectRange(single(0, 0)));

      await act(async () => {
        await result.current.copySelection({ includeHeaders: false });
      });

      expect(clip.writeText).toHaveBeenCalledWith("1");
    });

    it("uses the column's copyValue transformer when provided", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "alice", value: "100" }];

      const columns: GridColumn[] = [
        { accessorKey: "id", header: "ID" },
        {
          accessorKey: "name",
          header: "Name",
          copyValue: (v) => String(v).toUpperCase(),
        },
        { accessorKey: "value", header: "Value" },
      ];

      const { result } = renderHook(() => useClipboardTable({ data, columns }));
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("ALICE");
    });

    it("does nothing when there is no selection", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() => useClipboardTable({ data }));

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).not.toHaveBeenCalled();
    });

    it("fires onClipboardCopy with selection info", async () => {
      stubClipboard();
      const onClipboardCopy = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onClipboardCopy }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      expect(onClipboardCopy).toHaveBeenCalledWith({
        rows: 2,
        cols: 3,
        allRows: true,
        allCols: true,
        columnIds: ["id", "name", "value"],
      });
    });
  });

  describe("pasteSelection", () => {
    it("pastes clipboard text into the selected cell", async () => {
      stubClipboard("Updated");
      const onChange = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Updated", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ]);
    });

    it("truncates the paste when the clipboard has more rows than fit and autoExtendOnPaste is off (default)", async () => {
      stubClipboard("Row1\nRow2\nRow3");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Row1", value: "100" },
      ]);
    });

    it("extends the data array when autoExtendOnPaste is on and the clipboard overflows", async () => {
      stubClipboard("Row1\nRow2\nRow3");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange, autoExtendOnPaste: true }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Row1", value: "100" },
        { id: "", name: "Row2", value: "" },
        { id: "", name: "Row3", value: "" },
      ]);
    });

    it("tiles a single-cell clipboard across a multi-cell selection", async () => {
      stubClipboard("X");
      const onChange = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "a", value: "x" },
        { id: "2", name: "b", value: "y" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 1, row: 0 },
          max: { col: 2, row: 1 },
        }),
      );

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "X", value: "X" },
        { id: "2", name: "X", value: "X" },
      ]);
    });

    it("skips disabled columns", async () => {
      stubClipboard("X\tY\tZ");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const columns: GridColumn[] = [
        { accessorKey: "id", header: "ID", disabled: true },
        { accessorKey: "name", header: "Name" },
        { accessorKey: "value", header: "Value" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, columns, onChange }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 2, row: 0 },
        }),
      );

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Y", value: "Z" },
      ]);
    });

    it("uses the column's pasteValue transformer when provided", async () => {
      stubClipboard("alice");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "old", value: "100" }];

      const columns: GridColumn[] = [
        { accessorKey: "id", header: "ID" },
        {
          accessorKey: "name",
          header: "Name",
          pasteValue: (v) => v.toUpperCase(),
        },
        { accessorKey: "value", header: "Value" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, columns, onChange }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "ALICE", value: "100" },
      ]);
    });

    it("does nothing when readOnly is set", async () => {
      stubClipboard("X");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange, readOnly: true }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("fires onClipboardPaste with paste info", async () => {
      stubClipboard("X");
      const onChange = vi.fn();
      const onClipboardPaste = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange, onClipboardPaste }),
      );
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onClipboardPaste).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: 1,
          cols: 1,
          columnIds: ["name"],
        }),
      );
    });
  });

  describe("sort-aware indexing", () => {
    it("copies the visually-selected row when the table is sorted", async () => {
      const clip = stubClipboard();
      // Data is initially [Bob, Alice] but sorted ascending → [Alice, Bob].
      const data: TestRow[] = [
        { id: "1", name: "Bob", value: "200" },
        { id: "2", name: "Alice", value: "100" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, sortable: true }),
      );

      // Sort by name asc.
      act(() => {
        result.current.setSorting([{ id: "name", desc: false }]);
      });

      // Select the first visible row (visually row 0 → Alice, data index 1).
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.writeText).toHaveBeenCalledWith("Alice");
    });

    it("pastes into the visually-selected row when the table is sorted", async () => {
      stubClipboard("Updated");
      const onChange = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "Bob", value: "200" },
        { id: "2", name: "Alice", value: "100" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange, sortable: true }),
      );

      act(() => {
        result.current.setSorting([{ id: "name", desc: false }]);
      });

      // Visually row 0 (Alice) → data index 1.
      act(() => result.current.selectRange(single(1, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      // Alice's row (data index 1) is the one that should change.
      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Bob", value: "200" },
        { id: "2", name: "Updated", value: "100" },
      ]);
    });
  });
});
