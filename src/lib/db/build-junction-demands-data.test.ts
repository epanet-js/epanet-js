import { buildJunctionDemandsData } from "./build-junction-demands-data";

describe("buildJunctionDemandsData", () => {
  it("groups demand rows by junction preserving ordinal order", () => {
    const IDS = { J1: 1, J2: 2 } as const;

    const demands = buildJunctionDemandsData([
      {
        junction_id: IDS.J1,
        ordinal: 0,
        base_demand: 1,
        pattern_id: 9,
      },
      {
        junction_id: IDS.J1,
        ordinal: 1,
        base_demand: 2,
        pattern_id: null,
      },
      {
        junction_id: IDS.J2,
        ordinal: 0,
        base_demand: 5,
        pattern_id: null,
      },
    ]);

    expect(demands.get(IDS.J1)).toEqual([
      { baseDemand: 1, patternId: 9 },
      { baseDemand: 2, patternId: undefined },
    ]);
    expect(demands.get(IDS.J2)).toEqual([
      { baseDemand: 5, patternId: undefined },
    ]);
  });

  it("returns an empty map for no rows", () => {
    expect(buildJunctionDemandsData([]).size).toBe(0);
  });
});
