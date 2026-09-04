import { clampDataGridStateToRowCount } from "./grid-state";

describe("clampDataGridStateToRowCount", () => {
  it("returns undefined when there is no saved state", () => {
    expect(clampDataGridStateToRowCount(undefined, 10)).toBeUndefined();
  });

  it("keeps positions that are still in range", () => {
    const state = {
      activeCell: { col: 1, row: 3 },
      selection: { min: { col: 0, row: 2 }, max: { col: 1, row: 3 } },
    };

    expect(clampDataGridStateToRowCount(state, 10)).toEqual(state);
  });

  it("clamps positions beyond the last row", () => {
    const state = {
      activeCell: { col: 1, row: 40 },
      selection: { min: { col: 0, row: 30 }, max: { col: 1, row: 40 } },
    };

    const clamped = clampDataGridStateToRowCount(state, 5);

    expect(clamped?.activeCell).toEqual({ col: 1, row: 4 });
    expect(clamped?.selection).toEqual({
      min: { col: 0, row: 4 },
      max: { col: 1, row: 4 },
    });
  });

  it("clears cursor and selection when there are no rows", () => {
    const state = {
      scrollTop: 80,
      activeCell: { col: 1, row: 2 },
      selection: { min: { col: 0, row: 0 }, max: { col: 1, row: 2 } },
    };

    expect(clampDataGridStateToRowCount(state, 0)).toEqual({
      scrollTop: 80,
      selection: null,
      activeCell: null,
    });
  });

  it("preserves sorting and column sizing untouched", () => {
    const state = {
      sorting: [{ id: "label", desc: true }],
      columnSizing: { label: 220 },
    };

    expect(clampDataGridStateToRowCount(state, 3)).toMatchObject(state);
  });
});
