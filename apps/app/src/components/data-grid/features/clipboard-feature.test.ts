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
import { CellEditingFeature } from "./cell-editing-feature";
import { CellRangeSelectionFeature } from "./cell-range-selection-feature";
import { ClipboardFeature } from "./clipboard-feature";
import { LazyRowModelFeature } from "./lazy-row-model-feature";
import {
  type LazyRowModel,
  getAdaptiveCoreRowModel,
} from "../models/lazy-core-row-model";
import { getAdaptiveStickySortedRowModel } from "../models/lazy-sticky-sorted-row-model";
import type { GridColumn, GridSelection } from "../types";

type TestRow = { id: string; name: string; value: string };

const defaultColumns: GridColumn<TestRow>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const createTestRow = (): TestRow => ({ id: "", name: "", value: "" });

type TableOptions = {
  data: TestRow[];
  columns?: GridColumn<TestRow>[];
  onChange?: (data: TestRow[]) => void;
  readOnly?: boolean;
  includeHeadersOnCopy?: boolean;
  autoExtendOnPaste?: boolean;
  onClipboardCopy?: (info: unknown) => void;
  onClipboardPaste?: (info: unknown) => void;
  sortable?: boolean;
  lazyRowModel?: boolean;
  maxClipboardRows?: number;
};

const useClipboardTable = (options: TableOptions) =>
  useReactTable({
    data: options.data,
    columns: options.columns ?? defaultColumns,
    getCoreRowModel: options.lazyRowModel
      ? getAdaptiveCoreRowModel()
      : getCoreRowModel(),
    ...(options.sortable
      ? {
          getSortedRowModel: options.lazyRowModel
            ? getAdaptiveStickySortedRowModel()
            : getSortedRowModel(),
          enableSorting: true,
        }
      : {}),
    _features: [
      CellEditingFeature,
      CellRangeSelectionFeature,
      ClipboardFeature,
      ...(options.lazyRowModel ? [LazyRowModelFeature] : []),
    ],
    onDataChange: options.onChange,
    createRow: createTestRow,
    readOnly: options.readOnly,
    includeHeadersOnCopy: options.includeHeadersOnCopy,
    autoExtendOnPaste: options.autoExtendOnPaste,
    onClipboardCopy: options.onClipboardCopy as never,
    onClipboardPaste: options.onClipboardPaste as never,
    lazyRowModel: options.lazyRowModel,
    maxClipboardRows: options.maxClipboardRows,
  });

const stubClipboard = (initialText = "") => {
  let stored = initialText;
  const writeText = vi.fn((text: string) => {
    stored = text;
    return Promise.resolve();
  });
  const readText = vi.fn(() => Promise.resolve(stored));
  Object.assign(navigator, { clipboard: { writeText, readText } });
  return {
    writeText,
    readText,
    getText: () => stored,
    // Simulate an external clipboard change (not via our writeText).
    setText: (text: string) => {
      stored = text;
    },
  };
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

    it("prepends headers by reusing the last copy of the same selection (no re-read)", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const nameAccessor = vi.fn((row: TestRow) => row.name);
      const columns: GridColumn<TestRow>[] = [
        { id: "name", header: "Name", accessorFn: nameAccessor },
      ];

      const { result } = renderHook(() => useClipboardTable({ data, columns }));
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });
      expect(clip.getText()).toBe("Alice\nBob");
      const readsAfterFirstCopy = nameAccessor.mock.calls.length;

      await act(async () => {
        await result.current.copySelection({ includeHeaders: true });
      });
      expect(clip.getText()).toBe("Name\nAlice\nBob");
      // Fast path reused the cached body — no extra accessor reads.
      expect(nameAccessor.mock.calls.length).toBe(readsAfterFirstCopy);
    });

    it("rebuilds (does not reuse) when the selection changed since the last copy", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const nameAccessor = vi.fn((row: TestRow) => row.name);
      const columns: GridColumn<TestRow>[] = [
        { id: "name", header: "Name", accessorFn: nameAccessor },
      ];

      const { result } = renderHook(() => useClipboardTable({ data, columns }));
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 1 },
        }),
      );
      await act(async () => {
        await result.current.copySelection();
      });
      const readsAfterFirstCopy = nameAccessor.mock.calls.length;

      // Shrink the selection, then copy with headers — cache no longer matches.
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        }),
      );
      await act(async () => {
        await result.current.copySelection({ includeHeaders: true });
      });
      expect(clip.getText()).toBe("Name\nAlice");
      expect(nameAccessor.mock.calls.length).toBeGreaterThan(
        readsAfterFirstCopy,
      );
    });

    it("rebuilds (does not prepend) when the clipboard changed since the copy", async () => {
      const clip = stubClipboard();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const nameAccessor = vi.fn((row: TestRow) => row.name);
      const columns: GridColumn<TestRow>[] = [
        { id: "name", header: "Name", accessorFn: nameAccessor },
      ];

      const { result } = renderHook(() => useClipboardTable({ data, columns }));
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 1 },
        }),
      );
      await act(async () => {
        await result.current.copySelection();
      });

      // User copies something else (different length) before clicking "headers".
      clip.setText("unrelated clipboard text");

      await act(async () => {
        await result.current.copySelection({ includeHeaders: true });
      });
      // Rebuilt from the grid, not prepended onto the unrelated content.
      expect(clip.getText()).toBe("Name\nAlice\nBob");
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

      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "id", header: "ID" },
        {
          accessorKey: "name",
          header: "Name",
          meta: { copyValue: (v) => String(v).toUpperCase() },
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
        requestedRows: 2,
        rows: 2,
        cols: 3,
        allRows: true,
        allCols: true,
        columnIds: ["id", "name", "value"],
        includeHeaders: false,
      });
    });

    it("reports includeHeaders: true when copying with headers", async () => {
      stubClipboard();
      const onClipboardCopy = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onClipboardCopy }),
      );
      act(() => result.current.selectRange(single(0, 0)));

      await act(async () => {
        await result.current.copySelection({ includeHeaders: true });
      });

      expect(onClipboardCopy).toHaveBeenCalledWith(
        expect.objectContaining({ includeHeaders: true }),
      );
    });
  });

  describe("copy row cap", () => {
    const LAZY_CAP = 1000; // LAZY_ROW_MODEL_THRESHOLD
    const makeRows = (n: number): TestRow[] =>
      Array.from({ length: n }, (_, i) => ({
        id: String(i),
        name: `n${i}`,
        value: String(i),
      }));

    it("copies the whole selection on a large lazy table (no cap by default)", async () => {
      const clip = stubClipboard();
      const onClipboardCopy = vi.fn();
      const data = makeRows(LAZY_CAP + 500); // 1500, over threshold → lazy

      const { result } = renderHook(() =>
        useClipboardTable({ data, lazyRowModel: true, onClipboardCopy }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: data.length - 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      const written = clip.getText().split("\n");
      expect(written).toHaveLength(data.length);
      expect(written[0]).toBe("0");
      expect(written[data.length - 1]).toBe(String(data.length - 1));

      expect(onClipboardCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedRows: data.length,
          rows: data.length,
          allRows: true,
        }),
      );
    });

    it("caps copy at maxClipboardRows when set, reporting both counts", async () => {
      const clip = stubClipboard();
      const onClipboardCopy = vi.fn();
      const data = makeRows(LAZY_CAP + 500);

      const { result } = renderHook(() =>
        useClipboardTable({
          data,
          lazyRowModel: true,
          onClipboardCopy,
          maxClipboardRows: LAZY_CAP,
        }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: data.length - 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      const written = clip.getText().split("\n");
      expect(written).toHaveLength(LAZY_CAP);
      expect(written[0]).toBe("0");
      expect(written[LAZY_CAP - 1]).toBe(String(LAZY_CAP - 1));

      expect(onClipboardCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedRows: data.length,
          rows: LAZY_CAP,
          allRows: true,
        }),
      );
    });

    it("does not cap non-lazy tables (rows === requestedRows)", async () => {
      const clip = stubClipboard();
      const onClipboardCopy = vi.fn();
      // Over the threshold by row count, but lazyRowModel not enabled.
      const data = makeRows(LAZY_CAP + 200);

      const { result } = renderHook(() =>
        useClipboardTable({ data, onClipboardCopy }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 0, row: data.length - 1 },
        }),
      );

      await act(async () => {
        await result.current.copySelection();
      });

      expect(clip.getText().split("\n")).toHaveLength(data.length);
      expect(onClipboardCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedRows: data.length,
          rows: data.length,
        }),
      );
    });
  });

  describe("lazy paste (uncapped, no materialization)", () => {
    const THRESHOLD = 1000; // LAZY_ROW_MODEL_THRESHOLD
    const makeRows = (n: number): TestRow[] =>
      Array.from({ length: n }, (_, i) => ({
        id: String(i),
        name: `n${i}`,
        value: String(i),
      }));

    it("fills a single column across all rows without materializing rows", async () => {
      stubClipboard();
      const onChange = vi.fn();
      const data = makeRows(THRESHOLD + 500); // 1500, lazy

      const { result } = renderHook(() =>
        useClipboardTable({ data, lazyRowModel: true, onChange }),
      );
      // Whole "name" column selected.
      act(() =>
        result.current.selectRange({
          min: { col: 1, row: 0 },
          max: { col: 1, row: data.length - 1 },
        }),
      );
      await act(async () => {
        await result.current.applyPaste("x");
      });

      const written = onChange.mock.calls[0][0] as TestRow[];
      expect(written).toHaveLength(data.length);
      expect(written[0].name).toBe("x");
      expect(written[data.length - 1].name).toBe("x");
      // Indices resolved without creating Row objects.
      const model = result.current.getRowModel() as LazyRowModel<TestRow>;
      expect(model.getMaterializedRows()).toHaveLength(0);
    });

    it("writes every row of a large multi-column paste (no cap)", async () => {
      stubClipboard();
      const onChange = vi.fn();
      const onClipboardPaste = vi.fn();
      const data = makeRows(THRESHOLD + 500);

      const { result } = renderHook(() =>
        useClipboardTable({
          data,
          lazyRowModel: true,
          onChange,
          onClipboardPaste,
        }),
      );
      // First two columns across all rows; a 2-column value tiles down.
      act(() =>
        result.current.selectRange({
          min: { col: 0, row: 0 },
          max: { col: 1, row: data.length - 1 },
        }),
      );
      await act(async () => {
        await result.current.applyPaste("a\tb");
      });

      const written = onChange.mock.calls[0][0] as TestRow[];
      expect(written).toHaveLength(data.length);
      expect(written[0].id).toBe("a");
      expect(written[0].name).toBe("b");
      // Past the old cap → still written (no truncation).
      expect(written[THRESHOLD].id).toBe("a");
      expect(written[data.length - 1].id).toBe("a");
      // And no Row objects were materialized to resolve indices.
      const model = result.current.getRowModel() as LazyRowModel<TestRow>;
      expect(model.getMaterializedRows()).toHaveLength(0);

      expect(onClipboardPaste).toHaveBeenCalledWith(
        expect.objectContaining({ rows: data.length }),
      );
    });

    it("caps the paste when maxClipboardRows is set, reporting requestedRows", async () => {
      stubClipboard();
      const onChange = vi.fn();
      const onClipboardPaste = vi.fn();
      const data = makeRows(THRESHOLD + 500); // 1500

      const { result } = renderHook(() =>
        useClipboardTable({
          data,
          lazyRowModel: true,
          onChange,
          onClipboardPaste,
          maxClipboardRows: THRESHOLD,
        }),
      );
      act(() =>
        result.current.selectRange({
          min: { col: 1, row: 0 },
          max: { col: 1, row: data.length - 1 },
        }),
      );
      await act(async () => {
        await result.current.applyPaste("x");
      });

      const written = onChange.mock.calls[0][0] as TestRow[];
      expect(written[0].name).toBe("x");
      expect(written[THRESHOLD - 1].name).toBe("x");
      expect(written[THRESHOLD].name).toBe(`n${THRESHOLD}`); // past cap → unchanged
      expect(onClipboardPaste).toHaveBeenCalledWith(
        expect.objectContaining({
          rows: THRESHOLD,
          requestedRows: data.length,
        }),
      );
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

    it("extends the data array when pasting at an offset position", async () => {
      stubClipboard("Row1\nRow2\nRow3");
      const onChange = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange, autoExtendOnPaste: true }),
      );
      // Start pasting at row 1 (not row 0) — needs rows 1, 2, 3
      act(() => result.current.selectRange(single(1, 1)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Row1", value: "200" },
        { id: "", name: "Row2", value: "" },
        { id: "", name: "Row3", value: "" },
      ]);
    });

    it("does nothing when the clipboard is empty", async () => {
      stubClipboard("");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      act(() => result.current.selectRange(single(0, 0)));

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("does nothing when there is no selection", async () => {
      stubClipboard("X");
      const onChange = vi.fn();
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      // No selectRange — selection remains null

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("tiles with partial repetition when the selection is not a clean multiple", async () => {
      stubClipboard("A\nB");
      const onChange = vi.fn();
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
        { id: "3", name: "Carol", value: "300" },
      ];

      const { result } = renderHook(() =>
        useClipboardTable({ data, onChange }),
      );
      // 3-row selection, 2-row clipboard → A, B, A
      act(() =>
        result.current.selectRange({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 2 },
        }),
      );

      await act(async () => {
        await result.current.pasteSelection();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "A", value: "100" },
        { id: "2", name: "B", value: "200" },
        { id: "3", name: "A", value: "300" },
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

      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "id", header: "ID", meta: { isReadOnly: true } },
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

      const columns: GridColumn<TestRow>[] = [
        { accessorKey: "id", header: "ID" },
        {
          accessorKey: "name",
          header: "Name",
          meta: { pasteValue: (v: string) => v.toUpperCase() },
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
