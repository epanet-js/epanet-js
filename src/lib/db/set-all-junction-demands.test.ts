import type { JunctionAssignedDemands } from "src/hydraulic-model/demands";
import {
  junctionDemandsToRows,
  toJunctionDemandRow,
} from "./set-all-junction-demands";

describe("toJunctionDemandRow", () => {
  it("passes the pattern id through when present", () => {
    const row = toJunctionDemandRow(5, { baseDemand: 3, patternId: 42 }, 0);

    expect(row).toEqual({
      junction_id: 5,
      ordinal: 0,
      base_demand: 3,
      pattern_id: 42,
    });
  });

  it("writes null when pattern id is undefined", () => {
    const row = toJunctionDemandRow(5, { baseDemand: 1.5 }, 1);

    expect(row.pattern_id).toBeNull();
  });
});

describe("junctionDemandsToRows", () => {
  it("expands each junction's demands into ordered rows", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const junctions: JunctionAssignedDemands = new Map([
      [IDS.J1, [{ baseDemand: 1 }, { baseDemand: 2, patternId: 9 }]],
      [IDS.J2, [{ baseDemand: 5 }]],
    ]);

    const rows = junctionDemandsToRows(junctions);

    expect(rows).toEqual([
      { junction_id: IDS.J1, ordinal: 0, base_demand: 1, pattern_id: null },
      { junction_id: IDS.J1, ordinal: 1, base_demand: 2, pattern_id: 9 },
      { junction_id: IDS.J2, ordinal: 0, base_demand: 5, pattern_id: null },
    ]);
  });
});
