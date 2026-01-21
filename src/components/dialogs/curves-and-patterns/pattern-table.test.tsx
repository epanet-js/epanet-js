import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { PatternTable, PatternTableRef } from "./pattern-table";

// Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("PatternTable", () => {
  describe("row actions", () => {
    it("disables delete when there is only one row", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <PatternTable
          pattern={[1.0]}
          patternTimestepSeconds={3600}
          onChange={onChange}
        />,
      );

      // Open the row actions menu
      await user.click(screen.getByRole("button", { name: /actions/i }));

      // Delete should be disabled
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });
      expect(deleteItem).toHaveAttribute("data-disabled");
    });

    it("inserts a row above the current row", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <PatternTable
          pattern={[3.0, 0.8]}
          patternTimestepSeconds={3600}
          onChange={onChange}
        />,
      );

      // Open the row actions menu for the second row
      const actionButtons = screen.getAllByRole("button", { name: /actions/i });
      await user.click(actionButtons[1]);

      // Click "Insert row above"
      await user.click(
        screen.getByRole("menuitem", { name: /insert row above/i }),
      );

      // Should insert a new row with default multiplier 1.0 above row 1
      expect(onChange).toHaveBeenCalledWith([3.0, 1.0, 0.8]);
    });

    it("inserts a row below the current row", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <PatternTable
          pattern={[2.0, 0.8]}
          patternTimestepSeconds={3600}
          onChange={onChange}
        />,
      );

      // Open the row actions menu for the first row
      const actionButtons = screen.getAllByRole("button", { name: /actions/i });
      await user.click(actionButtons[0]);

      // Click "Insert row below"
      await user.click(
        screen.getByRole("menuitem", { name: /insert row below/i }),
      );

      // Should insert a new row with default multiplier 1.0 below row 0
      expect(onChange).toHaveBeenCalledWith([2.0, 1.0, 0.8]);
    });
  });

  it("patterns always have default multiplier when all rows are deleted", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const ref = createRef<PatternTableRef>();

    const { container } = render(
      <PatternTable
        ref={ref}
        pattern={[1.0, 0.8, 0.6]}
        patternTimestepSeconds={3600}
        onChange={onChange}
      />,
    );

    // Click on a cell to establish focus context
    const cell = container.querySelector(".dsg-cell:not(.dsg-cell-header)");
    await user.click(cell!);

    // Select all rows programmatically (2 columns: timestep, multiplier; 3 rows)
    ref.current?.setSelection({
      min: { col: 0, row: 0 },
      max: { col: 1, row: 2 },
    });

    await user.keyboard("{Delete}");

    // Should emit the default pattern with multiplier 1.0
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([1.0]);
    });
  });

  describe("selection handling", () => {
    it("calls onSelectionChange when row is selected", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      const { container } = render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click on a cell to establish focus context
      const cell = container.querySelector(".dsg-cell:not(.dsg-cell-header)");
      await user.click(cell!);

      // Select row 1 programmatically
      ref.current?.setSelection({
        min: { col: 0, row: 1 },
        max: { col: 1, row: 1 },
      });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
        const lastCall =
          onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
        expect(lastCall[0].min.row).toBe(1);
        expect(lastCall[0].max.row).toBe(1);
      });
    });

    it("provides selection data including row range", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      const { container } = render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6, 0.4]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          onSelectionChange={onSelectionChange}
        />,
      );

      // Click on a cell to establish user interaction context
      const cell = container.querySelector(".dsg-cell:not(.dsg-cell-header)");
      await user.click(cell!);

      // Select rows 1-2 (0-indexed)
      ref.current?.setSelection({
        min: { col: 0, row: 1 },
        max: { col: 1, row: 2 },
      });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
        const selection = onSelectionChange.mock.calls[0][0];
        expect(selection.min.row).toBe(1);
        expect(selection.max.row).toBe(2);
        expect(selection.min.col).toBe(0);
        expect(selection.max.col).toBe(1);
      });
    });

    it("does not invoke handler when selection has same values", () => {
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6, 0.4]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          onSelectionChange={onSelectionChange}
          selection={{ min: { row: 0, col: 0 }, max: { row: 0, col: 1 } }}
        />,
      );

      // Clear mock to ignore initial render callback
      onSelectionChange.mockClear();

      // Set selection to same values as the controlled selection prop
      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 0 },
      });

      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("syncs selection prop changes to grid", async () => {
      const onChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      const { rerender } = render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6, 0.4]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          selection={{ min: { row: 0, col: 0 }, max: { row: 0, col: 1 } }}
        />,
      );

      // Spy on the grid's setSelection method
      const setSelectionSpy = vi.spyOn(ref.current!, "setSelection");

      // Change the selection prop to row 2
      rerender(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6, 0.4]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          selection={{ min: { row: 2, col: 0 }, max: { row: 2, col: 1 } }}
        />,
      );

      await waitFor(() => {
        expect(setSelectionSpy).toHaveBeenCalledWith({
          min: { row: 2, col: 0 },
          max: { row: 2, col: 1 },
        });
      });
    });
  });
});
