import type { Patterns } from "src/hydraulic-model/patterns";
import { patternsToRows, toPatternRow } from "./to-rows";

describe("toPatternRow", () => {
  it("serializes multipliers as JSON and keeps type when present", () => {
    const row = toPatternRow({
      id: 1,
      label: "P1",
      type: "demand",
      multipliers: [1, 0.8, 1.2],
    });

    expect(row).toEqual({
      id: 1,
      label: "P1",
      type: "demand",
      multipliers: JSON.stringify([1, 0.8, 1.2]),
    });
  });

  it("writes null when type is not set", () => {
    const row = toPatternRow({
      id: 2,
      label: "NoType",
      multipliers: [1],
    });

    expect(row.type).toBeNull();
  });

  it("throws when multipliers contain NaN or Infinity", () => {
    expect(() =>
      toPatternRow({
        id: 7,
        label: "BadNaN",
        multipliers: [1, NaN, 3],
      }),
    ).toThrow(/multipliers must be an array of finite numbers/);

    expect(() =>
      toPatternRow({
        id: 8,
        label: "BadInf",
        multipliers: [Infinity],
      }),
    ).toThrow(/multipliers must be an array of finite numbers/);
  });

  it("throws when type is not a known pattern type", () => {
    expect(() =>
      toPatternRow({
        id: 9,
        label: "BadType",
        type: "unknown" as never,
        multipliers: [1],
      }),
    ).toThrow(/row does not match schema/);
  });
});

describe("patternsToRows", () => {
  it("serializes each pattern in the map", () => {
    const IDS = { P1: 1, P2: 2 } as const;
    const patterns: Patterns = new Map([
      [IDS.P1, { id: IDS.P1, label: "A", multipliers: [1, 2] }],
      [
        IDS.P2,
        {
          id: IDS.P2,
          label: "B",
          type: "energyPrice",
          multipliers: [0.1],
        },
      ],
    ]);

    const rows = patternsToRows(patterns);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(IDS.P1);
    expect(rows[1].id).toBe(IDS.P2);
    expect(rows[1].type).toBe("energyPrice");
  });
});
