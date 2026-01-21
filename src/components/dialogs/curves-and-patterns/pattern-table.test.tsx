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

    it("enables delete when there are multiple rows", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <PatternTable
          pattern={[1.0, 0.8]}
          patternTimestepSeconds={3600}
          onChange={onChange}
        />,
      );

      // Open the row actions menu for the first row
      const actionButtons = screen.getAllByRole("button", { name: /actions/i });
      await user.click(actionButtons[0]);

      // Delete should be enabled
      const deleteItem = screen.getByRole("menuitem", { name: /delete/i });
      expect(deleteItem).not.toHaveAttribute("data-disabled");
    });
  });

  describe("default pattern", () => {
    it("emits default multiplier when all rows are deleted", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      const { container } = render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8]}
          patternTimestepSeconds={3600}
          onChange={onChange}
        />,
      );

      const focusableGrid = container.querySelector(
        "[tabindex='0']",
      ) as HTMLElement;

      // Select all rows programmatically (2 columns: timestep, multiplier; 2 rows)
      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 1 },
      });

      focusableGrid.focus();
      await user.keyboard("{Delete}");

      // Should emit the default pattern with multiplier 1.0
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([1.0]);
      });
    });

    it("emits default multiplier when all rows are deleted via select all", async () => {
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

      const focusableGrid = container.querySelector(
        "[tabindex='0']",
      ) as HTMLElement;

      // Select all rows programmatically (2 columns: timestep, multiplier; 3 rows)
      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 1, row: 2 },
      });

      focusableGrid.focus();
      await user.keyboard("{Delete}");

      // Should emit the default pattern with multiplier 1.0
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([1.0]);
      });
    });
  });

  describe("selection handling", () => {
    it.skip("calls onSelectionChange when row is selected", async () => {
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();
      const ref = createRef<PatternTableRef>();

      render(
        <PatternTable
          ref={ref}
          pattern={[1.0, 0.8, 0.6]}
          patternTimestepSeconds={3600}
          onChange={onChange}
          onSelectionChange={onSelectionChange}
        />,
      );

      ref.current?.setSelection({
        min: { col: 0, row: 1 },
        max: { col: 1, row: 1 },
      });

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalled();
        const call = onSelectionChange.mock.calls[0][0];
        expect(call.min.row).toBe(1);
        expect(call.max.row).toBe(1);
      });
    });

    it.skip("provides selection data including row range", async () => {
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
        />,
      );

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
  });
});
