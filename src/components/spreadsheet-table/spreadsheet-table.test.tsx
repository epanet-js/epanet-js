import userEvent from "@testing-library/user-event";
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { keyColumn } from "react-datasheet-grid";
import {
  SpreadsheetTable,
  SpreadsheetTableRef,
  createFloatColumn,
} from "./index";

// Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

type TestRow = { value: number };

const columns = [
  {
    ...keyColumn("value", createFloatColumn({ deleteValue: 0 })),
    title: "Value",
  },
];

const createRow = (): TestRow => ({ value: 0 });

const getGutterCells = (container: HTMLElement) => {
  return Array.from(
    container.querySelectorAll(".dsg-cell-gutter:not(.dsg-cell-header)"),
  );
};

describe("SpreadsheetTable", () => {
  describe("keyboard row deletion", () => {
    it("deletes a single row when selected via gutter and pressing Delete", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <SpreadsheetTable
          data={[{ value: 1.0 }, { value: 0.8 }, { value: 0.6 }]}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn
        />,
      );

      // The grid has a focusable container that receives keyboard events
      const focusableGrid = container.querySelector(
        "[tabindex='0']",
      ) as HTMLElement;
      const gutterCells = getGutterCells(container);

      // Click on the first row's gutter to select the full row
      await user.click(gutterCells[0]);
      // Focus the grid and send keyboard event
      focusableGrid.focus();
      await user.keyboard("{Delete}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([{ value: 0.8 }, { value: 0.6 }]);
      });
    });

    it("deletes all rows when selected via select-all and pressing Delete", async () => {
      const user = setupUser();
      const onChange = vi.fn();
      const ref = createRef<SpreadsheetTableRef>();

      const { container } = render(
        <SpreadsheetTable
          ref={ref}
          data={[{ value: 1.0 }, { value: 0.8 }, { value: 0.6 }]}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn
        />,
      );

      const focusableGrid = container.querySelector(
        "[tabindex='0']",
      ) as HTMLElement;

      // Programmatically select all rows using the ref
      ref.current?.setSelection({
        min: { col: 0, row: 0 },
        max: { col: 0, row: 2 },
      });

      focusableGrid.focus();
      await user.keyboard("{Delete}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([]);
      });
    });

    it("deletes rows using Backspace key", async () => {
      const user = setupUser();
      const onChange = vi.fn();

      const { container } = render(
        <SpreadsheetTable
          data={[{ value: 1.0 }, { value: 0.8 }, { value: 0.6 }]}
          columns={columns}
          onChange={onChange}
          createRow={createRow}
          gutterColumn
        />,
      );

      const focusableGrid = container.querySelector(
        "[tabindex='0']",
      ) as HTMLElement;
      const gutterCells = getGutterCells(container);

      await user.click(gutterCells[0]);
      focusableGrid.focus();
      await user.keyboard("{Backspace}");

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([{ value: 0.8 }, { value: 0.6 }]);
      });
    });
  });
});
