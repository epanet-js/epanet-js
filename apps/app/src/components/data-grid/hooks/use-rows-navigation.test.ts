/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { useRowsNavigation } from "./use-rows-navigation";

describe("useRowsNavigation", () => {
  const createKeyboardEvent = (
    key: string,
    options: Partial<React.KeyboardEvent> = {},
  ) =>
    ({
      key,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      ...options,
    }) as unknown as React.KeyboardEvent;

  const defaultOptions = {
    activeCell: { col: 1, row: 2 },
    rowCount: 5,
    colCount: 3,
    editMode: false as const,
    selectCells: vi.fn(),
    clearSelection: vi.fn(),
    blurGrid: vi.fn(),
    visibleRowCount: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("arrow keys", () => {
    it("moves up", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("ArrowUp");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 1,
        extend: false,
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("moves down", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("ArrowDown");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 3,
        extend: false,
      });
    });

    it("moves left", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("ArrowLeft");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 2,
        extend: false,
      });
    });

    it("moves right", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("ArrowRight");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 2,
        extend: false,
      });
    });

    it("does not move past top boundary", () => {
      const options = { ...defaultOptions, activeCell: { col: 1, row: 0 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowUp");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 0,
        extend: false,
      });
    });

    it("does not move past bottom boundary", () => {
      const options = { ...defaultOptions, activeCell: { col: 1, row: 4 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowDown");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 4,
        extend: false,
      });
    });

    it("does not move past left boundary", () => {
      const options = { ...defaultOptions, activeCell: { col: 0, row: 2 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowLeft");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 2,
        extend: false,
      });
    });

    it("does not move past right boundary", () => {
      const options = { ...defaultOptions, activeCell: { col: 2, row: 2 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowRight");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 2,
        extend: false,
      });
    });

    it("extends selection with shift key", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("ArrowDown", { shiftKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 3,
        extend: true,
      });
    });

    it("does nothing if no active cell", () => {
      const options = { ...defaultOptions, activeCell: null };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowDown");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
    });
  });

  describe("Home key", () => {
    it("moves to row start", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Home");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 2,
        extend: false,
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("moves to grid start with Ctrl", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Home", { ctrlKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 0,
        extend: false,
      });
    });

    it("moves to grid start with Meta (Mac)", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Home", { metaKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 0,
        extend: false,
      });
    });

    it("extends selection with shift", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Home", { shiftKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 2,
        extend: true,
      });
    });

    it("does nothing if no active cell (without modifier)", () => {
      const options = { ...defaultOptions, activeCell: null };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("Home");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
    });

    it("moves to grid start even without active cell when using Ctrl", () => {
      const options = { ...defaultOptions, activeCell: null };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("Home", { ctrlKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 0,
        extend: false,
      });
    });
  });

  describe("End key", () => {
    it("moves to row end", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("End");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 2,
        extend: false,
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("moves to grid end with Ctrl", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("End", { ctrlKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 4,
        extend: false,
      });
    });

    it("extends selection with shift", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("End", {
        shiftKey: true,
        ctrlKey: true,
      });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 4,
        extend: true,
      });
    });
  });

  describe("PageUp/PageDown", () => {
    it("moves up by visible row count", () => {
      const options = {
        ...defaultOptions,
        activeCell: { col: 1, row: 15 },
        rowCount: 100,
        visibleRowCount: 10,
      };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("PageUp");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 5,
        extend: false,
      });
    });

    it("moves down by visible row count", () => {
      const options = {
        ...defaultOptions,
        activeCell: { col: 1, row: 5 },
        rowCount: 100,
        visibleRowCount: 10,
      };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("PageDown");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 15,
        extend: false,
      });
    });

    it("does not go below row 0", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("PageUp");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 0,
        extend: false,
      });
    });

    it("does not go past last row", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("PageDown");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 4,
        extend: false,
      });
    });

    it("extends selection with shift", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("PageDown", { shiftKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 4,
        extend: true,
      });
    });
  });

  describe("Tab key", () => {
    it("moves right", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Tab");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 2,
        rowIndex: 2,
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("moves left with shift", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("Tab", { shiftKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 0,
        rowIndex: 2,
      });
    });

    it("tabs out at right edge", () => {
      const options = { ...defaultOptions, activeCell: { col: 2, row: 2 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("Tab");

      result.current(event);

      expect(options.clearSelection).toHaveBeenCalled();
      expect(options.blurGrid).toHaveBeenCalled();
      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("tabs out at left edge with shift", () => {
      const options = { ...defaultOptions, activeCell: { col: 0, row: 2 } };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("Tab", { shiftKey: true });

      result.current(event);

      expect(options.clearSelection).toHaveBeenCalled();
      expect(options.blurGrid).toHaveBeenCalled();
      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
    });

    it("does nothing if no active cell", () => {
      const options = { ...defaultOptions, activeCell: null };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("Tab");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
      expect(options.clearSelection).not.toHaveBeenCalled();
    });
  });

  describe("Space key", () => {
    it("selects row with Shift+Space", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent(" ", { shiftKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({ rowIndex: 2 });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("selects column with Ctrl+Space", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent(" ", { ctrlKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({ colIndex: 1 });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("does nothing without modifier", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent(" ");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
    });
  });

  describe("Ctrl+A", () => {
    it("selects all cells", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("a", { ctrlKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("selects all with uppercase A", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("A", { metaKey: true });

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith();
    });

    it("does nothing without modifier", () => {
      const { result } = renderHook(() => useRowsNavigation(defaultOptions));
      const event = createKeyboardEvent("a");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
    });
  });

  describe("edit mode", () => {
    it("skips navigation in full edit mode", () => {
      const options = { ...defaultOptions, editMode: "full" as const };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowDown");

      result.current(event);

      expect(defaultOptions.selectCells).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("handles navigation in quick edit mode without preventDefault", () => {
      const options = { ...defaultOptions, editMode: "quick" as const };
      const { result } = renderHook(() => useRowsNavigation(options));
      const event = createKeyboardEvent("ArrowDown");

      result.current(event);

      expect(defaultOptions.selectCells).toHaveBeenCalledWith({
        colIndex: 1,
        rowIndex: 3,
        extend: false,
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });
});
