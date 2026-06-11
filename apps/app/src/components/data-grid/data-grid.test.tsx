import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { DataGrid, type DataGridRef } from "./data-grid";
import { booleanColumn } from "./cells/boolean-cell";
import { floatColumn } from "./cells/float-cell";
import { filterableSelectColumn } from "./cells/filterable-select-cell";
import { textColumn } from "./cells/text-cell";
import type { GridColumn } from "./types";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

type TestRow = {
  id: number;
  label: string;
  value: number | null;
  category: number | null;
  active: boolean | null;
};

const categoryOptions = [
  { value: 0, label: "Category A" },
  { value: 1, label: "Category B" },
  { value: 2, label: "Category C" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: GridColumn<TestRow>[] = [
  textColumn("label", { header: "Label", size: 80, isReadOnly: true }),
  floatColumn("value", { header: "Value", size: 100, emptyValue: null }),
  booleanColumn("active", { header: "Active", size: 80, emptyValue: false }),
  filterableSelectColumn("category", {
    header: "Category",
    options: categoryOptions,
    placeholder: "Select...",
    minOptionsForSearch: 10, // Disable search for simpler tests
    emptyValue: null,
  }),
];

let nextId = 0;
beforeEach(() => {
  nextId = 0;
});
const createRow = (): TestRow => ({
  id: ++nextId,
  label: "",
  value: null,
  category: null,
  active: null,
});

const defaultData: TestRow[] = [
  { id: 1, label: "Row 1", value: 10.5, category: 0, active: true },
  { id: 2, label: "Row 2", value: 20.5, category: 1, active: false },
  { id: 3, label: "Row 3", value: 30.5, category: 2, active: true },
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
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
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

      const gutterCells = container.querySelectorAll('[role="rowheader"]');
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
        expect.objectContaining({
          label: "",
          value: null,
          category: null,
          active: null,
        }),
      ]);
    });

    it("selects the new row when add button is clicked", async () => {
      const user = setupUser();
      const onSelectionChange = vi.fn();

      function Wrapper() {
        const [data, setData] = useState<TestRow[]>(defaultData);
        return (
          <DataGrid
            data={data}
            columns={columns}
            onChange={setData}
            createRow={createRow}
            addRowLabel="Add row"
            onSelectionChange={onSelectionChange}
          />
        );
      }

      render(<Wrapper />);

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
          max: { col: 3, row: 0 },
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

  describe("row deletion", () => {
    it("calls onDelete with the selected rows when pressing Delete with full row selected", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onDelete = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          onDelete={onDelete}
          createRow={createRow}
          gutterColumn="numbered"
        />,
      );

      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[0]);

      await user.keyboard("{Delete}");

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledTimes(1);
      });
      const rows = onDelete.mock.calls[0][0] as TestRow[];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ label: "Row 1", value: 10.5 });
      expect(onChange).not.toHaveBeenCalled();
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

    it("clears cell values on a partial selection (not full row)", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
        />,
      );

      // Click the value cell in row 1 (cell index = row*cols + col = 1*4 + 1 = 5)
      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[5]);

      // Press Delete
      await user.keyboard("{Delete}");

      await waitFor(() => {
        const result = onChange.mock.calls[0][0] as TestRow[];
        // All three rows still present, only row 1's value got cleared to null
        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({ label: "Row 1", value: 10.5 });
        expect(result[1]).toMatchObject({ label: "Row 2", value: null });
        expect(result[2]).toMatchObject({ label: "Row 3", value: 30.5 });
      });
    });

    it("treats Backspace the same as Delete for clearing", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
        />,
      );

      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[5]);

      await user.keyboard("{Backspace}");

      await waitFor(() => {
        const result = onChange.mock.calls[0][0] as TestRow[];
        expect(result[1]).toMatchObject({ value: null });
      });
    });

    it("skips read-only columns when clearing a selection that includes them", async () => {
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

      // Select the full row (covers all cols including the read-only label)
      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[1]);

      // Full-row selection deletes the row entirely, not clears.
      // To test the clear path with read-only, select all cells of a row by
      // selecting a non-full-row range: click value then shift-click last col.
      onChange.mockClear();

      const cells = container.querySelectorAll('[role="gridcell"]');
      // Click value of row 1 (index 5), then shift-click last col (index 7)
      await user.click(cells[5]);
      await user.keyboard("{Shift>}");
      await user.click(cells[7]);
      await user.keyboard("{/Shift}");

      await user.keyboard("{Delete}");

      await waitFor(() => {
        const result = onChange.mock.calls.at(-1)?.[0] as TestRow[];
        // label is read-only — must be preserved
        expect(result[1].label).toBe("Row 2");
        // value, active, category should be cleared
        expect(result[1]).toMatchObject({
          value: null,
          active: false,
          category: null,
        });
      });
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

      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      const firstGutter = gutterCells[0];
      await user.click(firstGutter);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 3, row: 0 },
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

      const gutterCells = container.querySelectorAll('[role="rowheader"]');

      // Click first gutter row
      await user.click(gutterCells[0]);
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 3, row: 0 },
        });
      });

      // Shift+click third gutter row — should extend to rows 0–2, all columns
      await user.keyboard("[ShiftLeft>]");
      await user.click(gutterCells[2]);
      await user.keyboard("[/ShiftLeft]");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 3, row: 2 },
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

      const gutterCells = container.querySelectorAll('[role="rowheader"]');
      await user.click(gutterCells[0]);
      await user.keyboard("[ShiftLeft>]");
      await user.click(gutterCells[2]);
      await user.keyboard("[/ShiftLeft]");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 0, row: 0 },
          max: { col: 3, row: 2 },
        });
      });

      // Escape collapses to active cell — should be at col 0 (not rightmost col 3), row 2 (last clicked row)
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
        expect(selectedCells.length).toBe(12); // 3 rows x 4 columns
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
  });

  describe("autoAddNewRows", () => {
    it("adds a new row when pressing Enter on the last row while editing", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const testData: TestRow[] = [
        { id: 1, label: "Row 1", value: 10, category: null, active: null },
      ];

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
          expect.objectContaining({ value: 25, label: "Row 1" }),
          expect.objectContaining({ value: null, label: "" }),
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

      // Row 0 (10.5) is not the last row
      const cell = screen.getByDisplayValue("10.5");
      await user.dblClick(cell);

      await waitFor(() => {
        expect(screen.getByDisplayValue("10.5")).not.toHaveAttribute(
          "readonly",
        );
      });

      const input = screen.getByDisplayValue("10.5");
      await user.clear(input);
      await user.type(input, "25{Enter}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ value: 25, label: "Row 1" }),
          ]),
        );
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
      const testData: TestRow[] = [
        { id: 1, label: "Row 1", value: 10, category: null, active: null },
      ];

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
        expect(onChange).toHaveBeenCalledWith([
          expect.objectContaining({ value: 25, label: "Row 1" }),
        ]);
      });

      // Should never have been called with a 2-element array
      const hasExtraRow = onChange.mock.calls.some(
        (call: TestRow[][]) => call[0].length > 1,
      );
      expect(hasExtraRow).toBe(false);
    });
  });

  describe("quick edit mode (typing to edit)", () => {
    it("enters quick edit when typing on active float cell", async () => {
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

      // Click to select the value cell (column 1, row 0)
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type a digit - should enter quick edit mode
      await user.keyboard("5");

      // Should see input with the typed character
      await waitFor(() => {
        // In quick edit mode, input is replaced by the new typed in value
        expect(valueCell).toHaveValue("5");
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });

    it("commits and navigates down on ArrowDown in quick edit mode", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click to select the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit, then arrow down
      await user.keyboard("99{ArrowDown}");

      // Should commit the value
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ value: 99 })]),
        );
      });

      // Should navigate to cell below
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 1 },
          max: { col: 1, row: 1 },
        });
      });

      // Edit mode should be exited (input is readonly)
      expect(valueCell).toHaveAttribute("readonly");
    });

    it("commits and navigates right on ArrowRight in quick edit mode", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click to select the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit, then arrow right
      await user.keyboard("1{ArrowRight}");

      // Should commit the value
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });

      // Should navigate to cell on right (active column)
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 2, row: 0 },
          max: { col: 2, row: 0 },
        });
      });
    });

    it("commits and navigates on Tab in quick edit mode", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click to select the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit, then Tab
      await user.keyboard("5{Tab}");

      // Should commit and navigate
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 2, row: 0 },
          max: { col: 2, row: 0 },
        });
      });
    });

    it("commits value when clicking on a different cell during quick edit", async () => {
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

      // Click to select the first value cell (now an input)
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit mode
      await user.keyboard("99");

      // Verify we're in edit mode with the updated value
      await waitFor(() => {
        expect(valueCell).toHaveValue("99");
      });

      // Click on a different cell (second row's value cell)
      const otherValueCell = screen.getByDisplayValue("20.5");
      await user.click(otherValueCell);

      // Should have committed the value from the first cell
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 1, value: 99 }),
          ]),
        );
      });
    });
  });

  describe("full edit mode (Enter to edit)", () => {
    it("enters full edit when pressing Enter on active float cell", async () => {
      const user = setupUser();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Click to select the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Press Enter to enter full edit mode
      await user.keyboard("{Enter}");

      // Should be in edit mode (not readonly)
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
        expect(valueCell).toHaveValue("10.5");
      });
    });

    it("enters full edit on double-click", async () => {
      const user = setupUser();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Double-click the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.dblClick(valueCell);

      // Should enter full edit mode
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
        expect(valueCell).toHaveValue("10.5");
      });
    });

    it("arrow keys move cursor in full edit mode (do not navigate)", async () => {
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

      // Click to select the value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      onSelectionChange.mockClear();

      // Press Enter to enter full edit mode
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });

      // Arrow keys should NOT navigate (they move cursor in input)
      await user.keyboard("{ArrowLeft}{ArrowRight}{ArrowUp}{ArrowDown}");

      // Selection should not have changed
      expect(onSelectionChange).not.toHaveBeenCalled();

      // Should still be in edit mode
      expect(valueCell).not.toHaveAttribute("readonly");
    });

    it("Enter commits and moves down in full edit mode", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click to select, Enter to edit
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });

      // Clear and type new value, then Enter to commit
      await user.clear(valueCell);
      await user.type(valueCell, "99.9{Enter}");

      // Should commit
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ value: 99.9 })]),
        );
      });

      // Should move down
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenLastCalledWith({
          min: { col: 1, row: 1 },
          max: { col: 1, row: 1 },
        });
      });
    });
  });

  describe("cross-cell edit mode transitions", () => {
    it("quick edit works on float cell after selecting filterable-select via mouse", async () => {
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

      // Click on category button - this selects the cell and opens the popover
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Select an option by clicking (get option from the listbox)
      const listbox = screen.getByRole("listbox");
      const optionB = listbox.querySelector('[role="option"]:nth-child(2)')!;
      await user.click(optionB);

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Now click on a float cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit mode
      await user.keyboard("7");

      // Should enter quick edit and show input with the character
      await waitFor(() => {
        expect(valueCell).toHaveValue("7");
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });

    it("quick edit works on float cell after closing filterable-select with Tab", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click on category button to select and open
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Close with Tab (commits current selection and moves to next cell)
      await user.keyboard("{Tab}");

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("quick edit works on float cell after closing filterable-select with Enter", async () => {
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

      // Click on category button to open
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Navigate and select with Enter
      await user.keyboard("{ArrowDown}{Enter}");

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Should have committed the selection
      expect(onChange).toHaveBeenCalled();

      // Now click on a float cell and try quick edit
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit
      await user.keyboard("8");

      // Should be in quick edit mode (input not readonly)
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });

    it("quick edit works on float cell after closing filterable-select with Escape", async () => {
      const user = setupUser();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Click on category button to open
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Close with Escape (no commit)
      await user.keyboard("{Escape}");

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Click on a float cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Type to enter quick edit
      await user.keyboard("9");

      // Should be in quick edit mode (input not readonly)
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });

    it("keyboard navigation to float cell after select allows quick edit", async () => {
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

      // Start at category cell via button click (opens popover)
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Click outside to close (commit) - click on a read-only cell
      await user.click(screen.getByText("Row 1"));

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Navigate with arrow key to value cell (from label col 0, go right to value col 1)
      await user.keyboard("{ArrowRight}");

      // Type to quick edit
      await user.keyboard("4");

      // Should enter quick edit (input not readonly)
      const valueCell = screen.getByDisplayValue(/4/);
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });
  });

  describe("filterable-select quick mode", () => {
    it("typing on active select cell opens popover with search pre-filled", async () => {
      const user = setupUser();

      // Use many options to enable search
      const manyOptions = [
        { value: 0, label: "Alpha" },
        { value: 1, label: "Beta" },
        { value: 2, label: "Gamma" },
        { value: 3, label: "Delta" },
        { value: 4, label: "Epsilon" },
        { value: 5, label: "Zeta" },
        { value: 6, label: "Eta" },
        { value: 7, label: "Theta" },
        { value: 8, label: "Iota" },
      ];

      const columnsWithSearch: GridColumn<TestRow>[] = [
        textColumn("label", { header: "Label", size: 80, isReadOnly: true }),
        filterableSelectColumn("category", {
          header: "Category",
          options: manyOptions,
          placeholder: "Select...",
          minOptionsForSearch: 8,
        }),
      ];

      const data: TestRow[] = [
        { id: 1, label: "Row 1", value: null, category: 0, active: null },
      ];

      render(
        <DataGrid
          data={data}
          columns={columnsWithSearch}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Click to select category cell
      const categoryCell = screen.getByText("Alpha");
      await user.click(categoryCell);

      // Type a character to open in quick mode
      await user.keyboard("B");

      // Popover should open with search showing "B"
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
        const searchInput = screen.getByPlaceholderText("Search…");
        expect(searchInput).toHaveValue("B");
      });

      // Only "Beta" should be visible (filtered)
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent("Beta");
    });

    it("Enter commits highlighted option in filterable-select", async () => {
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

      // Click on category button to open popover
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Navigate down and press Enter
      await user.keyboard("{ArrowDown}{Enter}");

      // Should commit Category B (index 1)
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 1, category: 1 }),
          ]),
        );
      });

      // Popover should close
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("focus management", () => {
    it("grid receives focus after closing filterable-select popover", async () => {
      const user = setupUser();

      render(
        <DataGrid
          data={defaultData}
          columns={columns}
          onChange={vi.fn()}
          createRow={createRow}
        />,
      );

      // Click on category button to open popover
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Close with Enter
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Grid should have focus (or be able to receive keyboard input)
      expect(screen.getByRole("grid")).toBeInTheDocument();

      // Click on value cell and type to verify grid can receive input
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);
      await user.keyboard("1");

      // Should be able to edit (grid received focus properly)
      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });
    });

    it("keyboard navigation works after closing filterable-select", async () => {
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

      // Click on category button to open popover
      const buttons = screen.getAllByRole("button");
      const categoryButton = buttons.find((b) =>
        b.textContent?.includes("Category A"),
      )!;
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Close with Escape
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      onSelectionChange.mockClear();

      // Arrow navigation should work
      await user.keyboard("{ArrowDown}");

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith({
          min: { col: 3, row: 1 },
          max: { col: 3, row: 1 },
        });
      });
    });
  });

  describe("boolean cell editing", () => {
    it("clicking a boolean cell toggles the value and focuses the checkbox", async () => {
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

      // Row 1 starts with active=true; click toggles to false.
      const checkboxes = screen
        .getAllByRole("checkbox")
        .filter((c) => !c.hasAttribute("disabled"));
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      const lastCall = onChange.mock.lastCall![0] as TestRow[];
      expect(lastCall[0].active).toBe(false);

      // After click the checkbox keeps focus (this is the regression we
      // fixed — the grid div used to steal it).
      expect(document.activeElement).toBe(checkboxes[0]);
    });

    it("toggles the boolean cell with Space after navigating to it", async () => {
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

      // Click the value cell on row 1, then arrow-right to reach the boolean column (col 2).
      await user.click(screen.getByDisplayValue("10.5"));
      await user.keyboard("{ArrowRight}");

      // Space on the focused checkbox toggles the value.
      await user.keyboard(" ");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      const lastCall = onChange.mock.lastCall![0] as TestRow[];
      expect(lastCall[0].active).toBe(false);
    });
  });

  describe("Escape key behavior in edit mode", () => {
    it("Escape in quick edit mode discards changes", async () => {
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

      // Click on value cell
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);

      // Enter quick edit by typing
      await user.keyboard("999");

      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });

      // Press Escape to discard
      await user.keyboard("{Escape}");

      // Edit mode should end (input should be readonly again)
      await waitFor(() => {
        expect(valueCell).toHaveAttribute("readonly");
      });

      // onChange should not have been called (value not committed)
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Escape in full edit mode discards changes", async () => {
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

      // Click on value cell and Enter to full edit
      const valueCell = screen.getByDisplayValue("10.5");
      await user.click(valueCell);
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(valueCell).not.toHaveAttribute("readonly");
      });

      // Clear and type new value
      await user.clear(valueCell);
      await user.type(valueCell, "999");

      // Press Escape to discard
      await user.keyboard("{Escape}");

      // Edit mode should end (input should be readonly again)
      await waitFor(() => {
        expect(valueCell).toHaveAttribute("readonly");
      });

      // onChange should not have been called with the new value
      expect(onChange).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ value: 999 })]),
      );
    });
  });
});
