import { buildCurvesData } from "./builders";

describe("buildCurvesData", () => {
  it("reconstructs curves with typed points", () => {
    const IDS = { C1: 1, C2: 2 } as const;

    const curves = buildCurvesData([
      {
        id: IDS.C1,
        label: "PumpA",
        type: "pump",
        points: JSON.stringify([
          { x: 0, y: 100 },
          { x: 50, y: 80 },
          { x: 100, y: 0 },
        ]),
      },
      {
        id: IDS.C2,
        label: "Loose",
        type: null,
        points: JSON.stringify([{ x: 1, y: 2 }]),
      },
    ]);

    expect(curves.size).toBe(2);
    expect(curves.get(IDS.C1)).toEqual({
      id: IDS.C1,
      label: "PumpA",
      type: "pump",
      points: [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 0 },
      ],
    });
    expect(curves.get(IDS.C2)).toEqual({
      id: IDS.C2,
      label: "Loose",
      points: [{ x: 1, y: 2 }],
    });
  });

  it("returns an empty map for no rows", () => {
    expect(buildCurvesData([]).size).toBe(0);
  });

  it("throws when points are not valid JSON", () => {
    expect(() =>
      buildCurvesData([
        { id: 1, label: "Bad", type: null, points: "not-json" },
      ]),
    ).toThrow(/points is not valid JSON/);
  });

  it("throws when points are not an array of {x,y} with finite numbers", () => {
    expect(() =>
      buildCurvesData([
        {
          id: 1,
          label: "Bad",
          type: null,
          points: JSON.stringify([{ x: 1, y: "oops" }]),
        },
      ]),
    ).toThrow(/points must be an array of \{x,y\} with finite numbers/);

    expect(() =>
      buildCurvesData([
        {
          id: 1,
          label: "Bad",
          type: null,
          points: JSON.stringify([{ x: 1 }]),
        },
      ]),
    ).toThrow(/points must be an array of \{x,y\} with finite numbers/);
  });
});
