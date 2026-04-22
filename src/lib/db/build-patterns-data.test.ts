import { buildPatternsData } from "./build-patterns-data";

describe("buildPatternsData", () => {
  it("reconstructs patterns with typed multipliers", () => {
    const IDS = { P1: 1, P2: 2 } as const;

    const patterns = buildPatternsData([
      {
        id: IDS.P1,
        label: "Daily",
        type: "demand",
        multipliers: JSON.stringify([1, 0.8, 1.5]),
      },
      {
        id: IDS.P2,
        label: "Loose",
        type: null,
        multipliers: JSON.stringify([1]),
      },
    ]);

    expect(patterns.size).toBe(2);
    expect(patterns.get(IDS.P1)).toEqual({
      id: IDS.P1,
      label: "Daily",
      type: "demand",
      multipliers: [1, 0.8, 1.5],
    });
    expect(patterns.get(IDS.P2)).toEqual({
      id: IDS.P2,
      label: "Loose",
      multipliers: [1],
    });
  });

  it("returns an empty map for no rows", () => {
    expect(buildPatternsData([]).size).toBe(0);
  });
});
