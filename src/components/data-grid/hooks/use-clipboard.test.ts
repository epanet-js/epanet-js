/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useClipboard } from "./use-clipboard";
import { GridColumn, GridSelection } from "../types";

type TestRow = { id: string; name: string; value: string };

const createTestColumns = (): GridColumn[] => [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const createTestRow = (): TestRow => ({
  id: "",
  name: "",
  value: "",
});

describe("useClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pasteFromClipboard", () => {
    it("pastes content into selected cells", async () => {
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const onChange = vi.fn();
      const selection: GridSelection = {
        min: { col: 1, row: 0 },
        max: { col: 1, row: 0 },
      };

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("Updated"),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Updated", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ]);
    });

    it("extends data array when pasting content that exceeds current rows", async () => {
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];
      const onChange = vi.fn();
      const selection: GridSelection = {
        min: { col: 1, row: 0 },
        max: { col: 1, row: 0 },
      };

      // Clipboard has 3 rows, but data only has 1 row
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("Row1\nRow2\nRow3"),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Row1", value: "100" },
        { id: "", name: "Row2", value: "" },
        { id: "", name: "Row3", value: "" },
      ]);
    });

    it("extends data array when pasting at offset position", async () => {
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const onChange = vi.fn();
      // Start pasting at row 1
      const selection: GridSelection = {
        min: { col: 1, row: 1 },
        max: { col: 1, row: 1 },
      };

      // Clipboard has 3 rows, starting at row 1 means we need rows 1, 2, 3
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("Row1\nRow2\nRow3"),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Row1", value: "200" },
        { id: "", name: "Row2", value: "" },
        { id: "", name: "Row3", value: "" },
      ]);
    });

    it("pastes multi-column content", async () => {
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];
      const onChange = vi.fn();
      const selection: GridSelection = {
        min: { col: 0, row: 0 },
        max: { col: 0, row: 0 },
      };

      // Tab-separated values for multiple columns
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("A\tB\tC\nD\tE\tF"),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).toHaveBeenCalledWith([
        { id: "A", name: "B", value: "C" },
        { id: "D", name: "E", value: "F" },
      ]);
    });

    it("does not paste into disabled columns", async () => {
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];
      const onChange = vi.fn();
      const selection: GridSelection = {
        min: { col: 0, row: 0 },
        max: { col: 0, row: 0 },
      };

      const columns: GridColumn[] = [
        { accessorKey: "id", header: "ID", disabled: true },
        { accessorKey: "name", header: "Name" },
        { accessorKey: "value", header: "Value" },
      ];

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("NewId\tNewName"),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns,
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      // ID should not change because column is disabled
      expect(onChange).toHaveBeenCalledWith([
        { id: "1", name: "NewName", value: "100" },
      ]);
    });

    it("does nothing when no selection", async () => {
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];
      const onChange = vi.fn();

      const { result } = renderHook(() =>
        useClipboard({
          selection: null,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("does nothing when clipboard is empty", async () => {
      const data: TestRow[] = [{ id: "1", name: "Alice", value: "100" }];
      const onChange = vi.fn();
      const selection: GridSelection = {
        min: { col: 0, row: 0 },
        max: { col: 0, row: 0 },
      };

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue(""),
        },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange,
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.pasteFromClipboard();
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("copyToClipboard", () => {
    it("copies selected cells to clipboard", async () => {
      const data: TestRow[] = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
      ];
      const selection: GridSelection = {
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      };

      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection,
          columns: createTestColumns(),
          data,
          onChange: vi.fn(),
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.copyToClipboard();
      });

      expect(writeText).toHaveBeenCalledWith("1\tAlice\n2\tBob");
    });

    it("does nothing when no selection", async () => {
      const writeText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const { result } = renderHook(() =>
        useClipboard({
          selection: null,
          columns: createTestColumns(),
          data: [],
          onChange: vi.fn(),
          createRow: createTestRow,
        }),
      );

      await act(async () => {
        await result.current.copyToClipboard();
      });

      expect(writeText).not.toHaveBeenCalled();
    });
  });
});
