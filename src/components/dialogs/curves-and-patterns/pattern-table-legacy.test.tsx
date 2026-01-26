import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { createRef } from "react";
import {
  PatternTableLegacy,
  PatternTableRefLegacy,
} from "./pattern-table-legacy";

// Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

// Tests for the legacy react-datasheet-grid implementation
describe("PatternTableLegacy", () => {
  describe("row actions", () => {
    it("disables delete when there is only one row", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      render(
        <PatternTableLegacy
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
        <PatternTableLegacy
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
        <PatternTableLegacy
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
    const ref = createRef<PatternTableRefLegacy>();

    const { container } = render(
      <PatternTableLegacy
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
});
