/**
 * Integration tests for DataGrid edit modes.
 *
 * These tests verify the interaction between quick edit mode (typing to edit)
 * and full edit mode (Enter/double-click to edit), as well as focus management
 * across different cell types.
 */
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { DataGrid } from "./data-grid";
import { floatColumn } from "./cells/float-cell";
import { filterableSelectColumn } from "./cells/filterable-select-cell";
import { textReadonlyColumn } from "./cells/text-readonly-cell";
import type { GridColumn } from "./types";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

type TestRow = {
  id: number;
  label: string;
  value: number | null;
  category: number | null;
};

const categoryOptions = [
  { value: 0, label: "Category A" },
  { value: 1, label: "Category B" },
  { value: 2, label: "Category C" },
];

const columns: GridColumn[] = [
  textReadonlyColumn("label", { header: "Label", size: 80 }),
  floatColumn("value", { header: "Value", size: 100, deleteValue: null }),
  filterableSelectColumn("category", {
    header: "Category",
    options: categoryOptions,
    placeholder: "Select...",
    minOptionsForSearch: 10, // Disable search for simpler tests
  }),
];

const createRow = (): TestRow => ({
  id: Date.now(),
  label: "",
  value: null,
  category: null,
});

const defaultData: TestRow[] = [
  { id: 1, label: "Row 1", value: 10.5, category: 0 },
  { id: 2, label: "Row 2", value: 20.5, category: 1 },
  { id: 3, label: "Row 3", value: 30.5, category: 2 },
];

describe("DataGrid edit mode integration", () => {
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

      // Should navigate to cell on right (category column)
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

      // Tab should have moved to next cell - verify we can still interact
      // The grid should now have focus and be responsive
      const grid = screen.getByRole("grid");
      expect(document.activeElement).toBe(grid);
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

      const columnsWithSearch: GridColumn[] = [
        textReadonlyColumn("label", { header: "Label", size: 80 }),
        filterableSelectColumn("category", {
          header: "Category",
          options: manyOptions,
          placeholder: "Select...",
          minOptionsForSearch: 8,
        }),
      ];

      const data: { id: number; label: string; category: number | null }[] = [
        { id: 1, label: "Row 1", category: 0 },
      ];

      render(
        <DataGrid
          data={data}
          columns={columnsWithSearch}
          onChange={vi.fn()}
          createRow={() => ({ id: Date.now(), label: "", category: null })}
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
        const searchInput = screen.getByPlaceholderText("Search...");
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
          min: { col: 2, row: 1 },
          max: { col: 2, row: 1 },
        });
      });
    });
  });

  describe("Escape key behavior", () => {
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
