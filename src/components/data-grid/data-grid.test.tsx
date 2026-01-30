import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { DataGrid } from "./data-grid";
import { floatColumn } from "./cells/float-cell";
import { textReadonlyColumn } from "./cells/text-readonly-cell";
import type { DataGridRef, GridColumn } from "./types";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

type TestRow = { value: number | null; label: string };

const columns: GridColumn[] = [
  textReadonlyColumn("label", { header: "Label", size: 80 }),
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
          gutterColumn
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
    it("exposes setActiveCell method", async () => {
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

      ref.current?.setActiveCell({ col: 1, row: 1 });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 1, row: 1 },
          max: { col: 1, row: 1 },
        });
      });
    });

    it("exposes setSelection method", async () => {
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

      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 2 },
      });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 2 },
        });
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

      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });

      await waitFor(() => {
        expect(ref.current?.selection).toEqual({
          min: { col: 0, row: 0 },
          max: { col: 1, row: 1 },
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
      const cell = screen.getByText("1");
      await user.dblClick(cell);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
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
      const cell = screen.getByText("10.5");
      await user.dblClick(cell);

      // Wait for input to appear
      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Type new value (input is auto-selected so typing replaces content)
      const input = screen.getByRole("textbox");
      // Use tripleClick to select all then type to replace
      await user.tripleClick(input);
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
      const cell = screen.getByText("1");
      await user.dblClick(cell);

      // Wait for edit mode and type new value then escape
      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });
      const input = screen.getByRole("textbox");
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
          gutterColumn
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

    it("does not delete rows when lockRows is true", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn
          lockRows
        />,
      );

      // Select full row by clicking the gutter
      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[0]);

      // Press Delete
      await user.keyboard("{Delete}");

      // Should not delete rows, but may clear cell values
      expect(onChange).not.toHaveBeenCalledWith([
        { value: 0.8, label: "Row 2" },
        { value: 0.6, label: "Row 3" },
      ]);
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
          gutterColumn
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

      // Set up multi-cell selection (2x2)
      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });

      await waitFor(() => {
        // Verify multiple cells are selected via aria-selected
        const selectedCells = container.querySelectorAll(
          '[role="gridcell"][aria-selected="true"]',
        );
        expect(selectedCells.length).toBe(4);
      });

      // Focus the grid and press Escape
      const grid = screen.getByRole("grid");
      grid.focus();
      await user.keyboard("{Escape}");

      // Should reduce to single cell (the active cell at max position)
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 1 },
          max: { col: 1, row: 1 },
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
});
