import type { Curves } from "src/hydraulic-model/curves";
import { curvesToRows, toCurveRow } from "./to-rows";

describe("toCurveRow", () => {
  it("serializes points as JSON and keeps type when present", () => {
    const row = toCurveRow({
      id: 1,
      label: "C1",
      type: "volume",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
    });

    expect(row).toEqual({
      id: 1,
      label: "C1",
      type: "volume",
      points: JSON.stringify([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ]),
    });
  });

  it("writes null when type is not set", () => {
    const row = toCurveRow({
      id: 2,
      label: "NoType",
      points: [{ x: 1, y: 1 }],
    });

    expect(row.type).toBeNull();
  });

  it("throws when points contain NaN or Infinity", () => {
    expect(() =>
      toCurveRow({
        id: 7,
        label: "BadNaN",
        points: [{ x: 1, y: NaN }],
      }),
    ).toThrow(/points must be an array of \{x,y\} with finite numbers/);

    expect(() =>
      toCurveRow({
        id: 8,
        label: "BadInf",
        points: [{ x: Infinity, y: 0 }],
      }),
    ).toThrow(/points must be an array of \{x,y\} with finite numbers/);
  });

  it("throws when type is not a known curve type", () => {
    expect(() =>
      toCurveRow({
        id: 9,
        label: "BadType",
        type: "unknown" as never,
        points: [{ x: 0, y: 0 }],
      }),
    ).toThrow(/row does not match schema/);
  });
});

describe("curvesToRows", () => {
  it("serializes each curve in the map", () => {
    const IDS = { C1: 1, C2: 2 } as const;
    const curves: Curves = new Map([
      [
        IDS.C1,
        {
          id: IDS.C1,
          label: "A",
          type: "pump",
          points: [{ x: 0, y: 100 }],
        },
      ],
      [
        IDS.C2,
        {
          id: IDS.C2,
          label: "B",
          points: [{ x: 1, y: 2 }],
        },
      ],
    ]);

    const rows = curvesToRows(curves);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(IDS.C1);
    expect(rows[0].type).toBe("pump");
    expect(rows[1].id).toBe(IDS.C2);
    expect(rows[1].type).toBeNull();
  });
});
