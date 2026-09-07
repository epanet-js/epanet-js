import type { Table } from "@tanstack/react-table";
import type { DataGridState } from "../types";
import {
  captureGridState,
  clampDataGridStateToRowCount,
  restoreGridScroll,
  toInitialTableState,
} from "./grid-state";

const aTable = (state: Record<string, unknown>) =>
  ({ getState: () => state }) as unknown as Table<Record<string, unknown>>;

describe("toInitialTableState", () => {
  it("is empty when there is nothing saved", () => {
    expect(toInitialTableState(undefined, 10)).toEqual({});
  });

  it("carries sorting and column sizing straight through", () => {
    const saved: DataGridState = {
      sorting: [{ id: "label", desc: true }],
      columnSizing: { label: 220 },
    };

    expect(toInitialTableState(saved, 10)).toMatchObject(saved);
  });

  it("nests selection and cursor under the features that own them", () => {
    const saved: DataGridState = {
      selection: { min: { col: 0, row: 1 }, max: { col: 2, row: 3 } },
      activeCell: { col: 1, row: 2 },
    };

    expect(toInitialTableState(saved, 10)).toEqual({
      cellRangeSelection: { range: saved.selection },
      cellEditing: { activeCell: saved.activeCell, editMode: false },
    });
  });

  it("omits keys that were never saved, so defaults apply", () => {
    expect(toInitialTableState({ scrollTop: 10 }, 10)).toEqual({});
  });
});

describe("toInitialTableState clamping", () => {
  it("clamps a cursor that outlived its rows", () => {
    const saved: DataGridState = { activeCell: { col: 1, row: 40 } };

    expect(toInitialTableState(saved, 5)).toEqual({
      cellEditing: { activeCell: { col: 1, row: 4 }, editMode: false },
    });
  });

  it("clears the cursor when the grid has no rows", () => {
    const saved: DataGridState = { activeCell: { col: 1, row: 2 } };

    expect(toInitialTableState(saved, 0)).toEqual({
      cellRangeSelection: { range: null },
      cellEditing: { activeCell: null, editMode: false },
    });
  });
});

describe("clampDataGridStateToRowCount", () => {
  it("returns undefined when there is no saved state", () => {
    expect(clampDataGridStateToRowCount(undefined, 10)).toBeUndefined();
  });

  it("keeps positions that are still in range", () => {
    const state: DataGridState = {
      activeCell: { col: 1, row: 3 },
      selection: { min: { col: 0, row: 2 }, max: { col: 1, row: 3 } },
    };

    expect(clampDataGridStateToRowCount(state, 10)).toEqual(state);
  });

  it("preserves sorting and column sizing untouched", () => {
    const state: DataGridState = {
      sorting: [{ id: "label", desc: true }],
      columnSizing: { label: 220 },
    };

    expect(clampDataGridStateToRowCount(state, 3)).toMatchObject(state);
  });
});

describe("captureGridState", () => {
  it("reads each field from where its feature keeps it", () => {
    const table = aTable({
      sorting: [{ id: "label", desc: false }],
      columnSizing: { label: 100 },
      cellRangeSelection: {
        range: { min: { col: 0, row: 0 }, max: { col: 1, row: 1 } },
      },
      cellEditing: { activeCell: { col: 1, row: 1 }, editMode: false },
    });

    const captured = captureGridState(table, { top: 40, left: 12 });

    expect(captured).toEqual({
      sorting: [{ id: "label", desc: false }],
      columnSizing: { label: 100 },
      selection: { min: { col: 0, row: 0 }, max: { col: 1, row: 1 } },
      activeCell: { col: 1, row: 1 },
      scrollTop: 40,
      scrollLeft: 12,
    });
  });

  it("records the offsets it was given", () => {
    const table = aTable({
      sorting: [],
      columnSizing: {},
      cellRangeSelection: { range: null },
      cellEditing: { activeCell: null, editMode: false },
    });

    const captured = captureGridState(table, { top: 0, left: 0 });

    expect(captured.scrollTop).toEqual(0);
    expect(captured.scrollLeft).toEqual(0);
  });
});

describe("restoreGridScroll", () => {
  it("applies the saved offsets", () => {
    const element = { scrollTop: 0, scrollLeft: 0 } as HTMLElement;

    restoreGridScroll(element, { scrollTop: 80, scrollLeft: 15 });

    expect(element.scrollTop).toEqual(80);
    expect(element.scrollLeft).toEqual(15);
  });

  it("leaves the element alone when an offset was not saved", () => {
    const element = { scrollTop: 7, scrollLeft: 9 } as HTMLElement;

    restoreGridScroll(element, { scrollTop: 80 });

    expect(element.scrollTop).toEqual(80);
    expect(element.scrollLeft).toEqual(9);
  });

  it("does nothing without an element or state", () => {
    expect(() => restoreGridScroll(null, { scrollTop: 1 })).not.toThrow();
    expect(() =>
      restoreGridScroll({ scrollTop: 0 } as HTMLElement, undefined),
    ).not.toThrow();
  });
});
