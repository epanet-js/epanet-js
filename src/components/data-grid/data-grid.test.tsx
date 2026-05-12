import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { DataGrid } from "./data-grid";
import { floatColumn } from "./cells/float-cell";
import { textColumn } from "./cells/text-cell";
import type { DataGridRef, GridColumn } from "./types";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

type TestRow = { value: number | null; label: string };

const columns: GridColumn[] = [
  textColumn("label", { header: "Label", size: 80, isReadOnly: true }),
  floatColumn("value", { header: "Value", size: 100, deleteValue: 0 }),
];

const createRow = (): TestRow => ({ value: 0, label: "" });

const defaultData: TestRow[] = [
  { value: 1.0, label: "Row 1" },
  { value: 0.8, label: "Row 2" },
  { value: 0.6, label: "Row 3" },
];

describe("DataGrid", () => {
  describe("rendering", () => {
    it("renders column headers", () => {
      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      expect(screen.getByText("Label")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
    });

    it("renders row data", () => {
      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      expect(screen.getByText("Row 1")).toBeInTheDocument();
      expect(screen.getByText("Row 2")).toBeInTheDocument();
      expect(screen.getByText("Row 3")).toBeInTheDocument();
    });

    it("renders empty state when data is empty", () => {
      const emptyState = <div data-testid="empty-state">No data</div>;

      render(
        <DataGrid
          data={[]}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          emptyState={emptyState}
        />,
      );

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("renders gutter column with row numbers when enabled", () => {
      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          gutterColumn="numbered"
        />,
      );

      // Gutter cells have text-xs class
      const gutterCells = container.querySelectorAll(".text-xs");
      const gutterTexts = Array.from(gutterCells).map((el) => el.textContent);
      expect(gutterTexts).toContain("1");
      expect(gutterTexts).toContain("2");
      expect(gutterTexts).toContain("3");
    });

    it("renders add row button when addRowLabel is provided", () => {
      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          addRowLabel="Add row"
        />,
      );

      expect(
        screen.getByRole("button", { name: /add row/i }),
      ).toBeInTheDocument();
    });
  });

  describe("add row", () => {
    it("calls onChange with new row when add button is clicked", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          addRowLabel="Add row"
        />,
      );

      await user.click(screen.getByRole("button", { name: /add row/i }));

      expect(onChange).toHaveBeenCalledWith([
        ...defaultData,
        { value: 0, label: "" },
      ]);
    });

    it("selects the new row when add button is clicked", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          addRowLabel="Add row"
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click add row button (grid is not focused yet)
      await user.click(screen.getByRole("button", { name: /add row/i }));

      // Should select the new row (index 3), not the first row (index 0)
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 3 },
          max: { col: 1, row: 3 },
        });
      });
    });
  });

  describe("cell selection", () => {
    it("selects a cell on click", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      const cell = screen.getByText("Row 1");
      await user.click(cell);

      expect(onSelectionChange).toHaveBeenCalledWith({
        min: { col: 0, row: 0 },
        max: { col: 0, row: 0 },
      });
    });
  });

  describe("ref methods", () => {
    it("exposes selectCells method", async () => {
      const ref = createRef<DataGridRef>();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      ref.current?.selectCells({ colIndex: 0 });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 2 },
        });
      });
    });

    it("exposes clearSelection method", async () => {
      const ref = createRef<DataGridRef>();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      ref.current?.selectCells({ colIndex: 0 });
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
      });

      onSelectionChange.mockClear();
      ref.current?.clearSelection();

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith(null);
      });
    });

    it("exposes selection property", async () => {
      const ref = createRef<DataGridRef>();

      render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      ref.current?.selectCells({ rowIndex: 0 });

      await waitFor(() => {
        expect(ref.current?.selection).toEqual({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 0 },
        });
      });
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with arrow key", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click on first cell to select it
      const cell = screen.getByText("Row 1");
      await user.click(cell);

      await user.keyboard("{ArrowDown}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 1 },
          max: { col: 0, row: 1 },
        });
      });
    });

    it("navigates right with arrow key", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      const cell = screen.getByText("Row 1");
      await user.click(cell);
      await user.keyboard("{ArrowRight}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 0 },
        });
      });
    });

    it("navigates with Tab key", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      const cell = screen.getByText("Row 1");
      await user.click(cell);
      await user.keyboard("{Tab}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 0 },
        });
      });
    });
  });

  describe("cell editing", () => {
    it("enters edit mode on double click", async () => {
      const user = setupUser();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Double click on editable cell (value column)
      const cell = screen.getByDisplayValue("1");
      await user.dblClick(cell);

      await waitFor(() => {
        // In edit mode, the input becomes editable (not readonly)
        expect(screen.getByDisplayValue("1")).not.toHaveAttribute("readonly");
      });
    });

    it("commits value on Enter", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      // Use distinct values to avoid ambiguity in finding cells
      const testData = [
        { value: 10.5, label: "Row 1" },
        { value: 20.5, label: "Row 2" },
      ];

      render(
        <DataGrid
          data={testData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
        />,
      );

      // Double click to edit - find cell with value 10.5 (formatted as "10.5")
      const cell = screen.getByDisplayValue("10.5");
      await user.dblClick(cell);

      // Wait for edit mode (input becomes editable)
      await waitFor(() => {
        expect(screen.getByDisplayValue("10.5")).not.toHaveAttribute(
          "readonly",
        );
      });

      // Clear and type new value
      const input = screen.getByDisplayValue("10.5");
      await user.clear(input);
      await user.type(input, "25{Enter}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([
          { value: 25, label: "Row 1" },
          { value: 20.5, label: "Row 2" },
        ]);
      });
    });

    it("discards value on Escape", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
        />,
      );

      // Double click to edit
      const cell = screen.getByDisplayValue("1");
      await user.dblClick(cell);

      // Wait for edit mode (input becomes editable)
      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).not.toHaveAttribute("readonly");
      });
      const input = screen.getByDisplayValue("1");
      await user.clear(input);
      await user.type(input, "999");
      await user.keyboard("{Escape}");

      // onChange should not be called with the new value
      expect(onChange).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ value: 999 })]),
      );
    });
  });

  describe("row deletion", () => {
    it("deletes selected rows when pressing Delete with full row selected", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn="numbered"
        />,
      );

      // Select full row by clicking the gutter
      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[0]);

      // Press Delete
      await user.keyboard("{Delete}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([
          { value: 0.8, label: "Row 2" },
          { value: 0.6, label: "Row 3" },
        ]);
      });
    });

    it("does not delete rows or clear values when readOnly is true", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn="numbered"
          readOnly
        />,
      );

      // Select full row by clicking the gutter
      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[0]);

      // Press Delete
      await user.keyboard("{Delete}");

      // Should not trigger any changes in readOnly mode
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("gutter row selection", () => {
    it("selects entire row when clicking gutter", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          gutterColumn="numbered"
          onSelectionChange={onSelectionChange}
        />,
      );

      // Find gutter cells by their class (text-xs and cursor-pointer)
      const gutterCells = container.querySelectorAll(".text-xs.cursor-pointer");
      const firstGutter = gutterCells[0];
      await user.click(firstGutter);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 0 },
        });
      });
    });
  });

  describe("column header selection", () => {
    it("selects entire column when clicking column header", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      const labelHeader = screen.getByRole("columnheader", { name: "Label" });
      await user.click(labelHeader);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 2 },
        });
      });
    });

    it("active cell is at row 0 when selecting a full column", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();
      const ref = createRef<DataGridRef>();

      render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click a cell in the last row first
      await user.click(screen.getByText("Row 3"));
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 2 },
          max: { col: 0, row: 2 },
        });
      });

      // Now click column header — active cell should be at row 0, not row 2
      const labelHeader = screen.getByRole("columnheader", { name: "Label" });
      await user.click(labelHeader);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 2 },
        });
      });

      // Pressing Escape should collapse to active cell at row 0
      const grid = screen.getByRole("grid");
      grid.focus();
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });
    });

    it("extends column selection with shift+click on another column header", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click first column header
      await user.click(screen.getByRole("columnheader", { name: "Label" }));
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 2 },
        });
      });

      // Shift+click second column header — should extend to both columns, all rows
      await user.keyboard("[ShiftLeft>]");
      await user.click(screen.getByRole("columnheader", { name: "Value" }));
      await user.keyboard("[/ShiftLeft]");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 2 },
        });
      });
    });
  });

  describe("gutter shift+click selection", () => {
    it("extends row selection with shift+click on gutter", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          gutterColumn="numbered"
          onSelectionChange={onSelectionChange}
        />,
      );

      const gutterCells = container.querySelectorAll(".text-xs.cursor-pointer");

      // Click first gutter row
      await user.click(gutterCells[0]);
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 0 },
        });
      });

      // Shift+click third gutter row — should extend to rows 0–2, all columns
      await user.keyboard("[ShiftLeft>]");
      await user.click(gutterCells[2]);
      await user.keyboard("[/ShiftLeft]");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 2 },
        });
      });
    });

    it("active cell stays in first column after shift+click on gutter", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();
      const ref = createRef<DataGridRef>();

      const { container } = render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          gutterColumn="numbered"
          onSelectionChange={onSelectionChange}
        />,
      );

      const gutterCells = container.querySelectorAll(".text-xs.cursor-pointer");
      await user.click(gutterCells[0]);
      await user.keyboard("[ShiftLeft>]");
      await user.click(gutterCells[2]);
      await user.keyboard("[/ShiftLeft]");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 2 },
        });
      });

      // Escape collapses to active cell — should be at col 0 (not rightmost col 1), row 2 (last clicked row)
      const grid = screen.getByRole("grid");
      grid.focus();
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 2 },
          max: { col: 0, row: 2 },
        });
      });
    });
  });

  describe("escape key handling", () => {
    it("reduces multi-cell selection to single active cell on first Escape", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();
      const ref = createRef<DataGridRef>();

      const { container } = render(
        <DataGrid
          ref={ref}
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Set up multi-cell selection (select all)
      ref.current?.selectCells();

      await waitFor(() => {
        // Verify multiple cells are selected via aria-selected
        const selectedCells = container.querySelectorAll(
          '[role="gridcell"][aria-selected="true"]',
        );
        expect(selectedCells.length).toBe(6); // 3 rows x 2 columns
      });

      // Focus the grid and press Escape
      const grid = screen.getByRole("grid");
      grid.focus();
      await user.keyboard("{Escape}");

      // Should reduce to single cell (the active cell at min position)
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });

      // Verify only one cell is now selected via aria-selected
      const selectedCells = container.querySelectorAll(
        '[role="gridcell"][aria-selected="true"]',
      );
      expect(selectedCells.length).toBe(1);
    });

    it("clears selection and blurs grid on Escape with single cell selected", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click on a cell to select it
      const cell = screen.getByText("Row 1");
      await user.click(cell);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });

      // Verify cell is selected via aria-selected
      expect(
        container.querySelectorAll('[role="gridcell"][aria-selected="true"]')
          .length,
      ).toBe(1);

      // Press Escape to clear selection
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith(null);
      });

      // Verify no cells are selected via aria-selected
      expect(
        container.querySelectorAll('[role="gridcell"][aria-selected="true"]')
          .length,
      ).toBe(0);
    });
  });

  describe("read-only mode", () => {
    it("does not show add row button when readOnly is true", () => {
      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          addRowLabel="Add row"
          readOnly
        />,
      );

      expect(
        screen.queryByRole("button", { name: /add row/i }),
      ).not.toBeInTheDocument();
    });

    it("does not show row actions when readOnly is true", () => {
      const rowActions = [
        { label: "Delete", icon: null, onSelect: vi.fn() },
        { label: "Duplicate", icon: null, onSelect: vi.fn() },
      ];

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          rowActions={rowActions}
          readOnly
        />,
      );

      expect(
        screen.queryByRole("button", { name: /actions/i }),
      ).not.toBeInTheDocument();
    });

    it("does not start editing when Enter is pressed in readOnly mode", async () => {
      const user = setupUser();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          readOnly
        />,
      );

      // Click a cell to select it
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]); // Click the value column (editable)

      // Press Enter
      await user.keyboard("{Enter}");

      // All float cell inputs should remain readonly (editing mode should not activate)
      const inputs = screen.getAllByRole("textbox");
      inputs.forEach((input) => {
        expect(input).toHaveAttribute("readonly");
      });
    });

    it("does not start editing when typing a character in readOnly mode", async () => {
      const user = setupUser();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          readOnly
        />,
      );

      // Click a cell to select it
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]); // Click the value column (editable)

      // Type a character
      await user.keyboard("5");

      // All float cell inputs should remain readonly (editing mode should not activate)
      const inputs = screen.getAllByRole("textbox");
      inputs.forEach((input) => {
        expect(input).toHaveAttribute("readonly");
      });
    });

    it("can still select cells when readOnly is true", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
          readOnly
        />,
      );

      // Click a cell to select it
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[0]);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });

      // Verify cell is selected via aria-selected
      expect(
        container.querySelectorAll('[role="gridcell"][aria-selected="true"]')
          .length,
      ).toBe(1);
    });

    it("can still navigate with arrow keys when readOnly is true", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
          readOnly
        />,
      );

      // Click a cell to select it
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[0]);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 0, row: 0 },
        });
      });

      // Navigate right
      await user.keyboard("{ArrowRight}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 0 },
          max: { col: 1, row: 0 },
        });
      });
    });

    it("does not paste when readOnly is true", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      // Mock clipboard with valid data
      const clipboardData = "999";
      vi.spyOn(navigator.clipboard, "readText").mockResolvedValue(
        clipboardData,
      );

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          readOnly
        />,
      );

      // Click a cell to select it (the value column which is editable)
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]);

      // Try to paste with Ctrl+V
      await user.keyboard("{Control>}v{/Control}");

      // onChange should not be called in readOnly mode
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("autoAddNewRows", () => {
    it("adds a new row when pressing Enter on the last row while editing", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const testData: TestRow[] = [{ value: 10, label: "Row 1" }];

      render(
        <DataGrid
          data={testData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          autoAddNewRows
        />,
      );

      const cell = screen.getByDisplayValue("10");
      await user.dblClick(cell);

      await waitFor(() => {
        expect(screen.getByDisplayValue("10")).not.toHaveAttribute("readonly");
      });

      const input = screen.getByDisplayValue("10");
      await user.clear(input);
      await user.type(input, "25{Enter}");

      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith([
          { value: 25, label: "Row 1" },
          { value: 0, label: "" },
        ]);
      });
    });

    it("does not add a row when pressing Enter on a non-last row", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          autoAddNewRows
        />,
      );

      const cell = screen.getByDisplayValue("1");
      await user.dblClick(cell);

      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).not.toHaveAttribute("readonly");
      });

      const input = screen.getByDisplayValue("1");
      await user.clear(input);
      await user.type(input, "25{Enter}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([
          { value: 25, label: "Row 1" },
          { value: 0.8, label: "Row 2" },
          { value: 0.6, label: "Row 3" },
        ]);
      });

      // Should never have been called with a 4-element array
      const hasExtraRow = onChange.mock.calls.some(
        (call: TestRow[][]) => call[0].length > 3,
      );
      expect(hasExtraRow).toBe(false);
    });

    it("does not add a row when autoAddNewRows is not set", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const testData: TestRow[] = [{ value: 10, label: "Row 1" }];

      render(
        <DataGrid
          data={testData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
        />,
      );

      const cell = screen.getByDisplayValue("10");
      await user.dblClick(cell);

      await waitFor(() => {
        expect(screen.getByDisplayValue("10")).not.toHaveAttribute("readonly");
      });

      const input = screen.getByDisplayValue("10");
      await user.clear(input);
      await user.type(input, "25{Enter}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([{ value: 25, label: "Row 1" }]);
      });

      // Should never have been called with a 2-element array
      const hasExtraRow = onChange.mock.calls.some(
        (call: TestRow[][]) => call[0].length > 1,
      );
      expect(hasExtraRow).toBe(false);
    });
  });
});
