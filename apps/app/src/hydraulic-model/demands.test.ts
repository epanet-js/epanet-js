import { describe, it, expect } from "vitest";
import {
  Demand,
  getJunctionDemands,
  calculateAverageDemand,
  createEmptyDemands,
} from "./demands";
import { getNextPatternId, Patterns } from "./patterns";

const createPatterns = (
  entries: Array<{ id: number; label: string; multipliers: number[] }>,
): Patterns => {
  return new Map(entries.map((e) => [e.id, e]));
};

describe("getNextPatternId", () => {
  describe("without startId", () => {
    it("returns 1 for empty patterns", () => {
      const patterns: Patterns = new Map();
      expect(getNextPatternId(patterns)).toBe(1);
    });

    it("returns next available id after existing patterns", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 2, label: "P2", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns)).toBe(3);
    });

    it("fills gaps in id sequence", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 3, label: "P3", multipliers: [1] },
      ]);
      // Without startId, it should start from a low number and find the first gap
      expect(getNextPatternId(patterns)).toBe(2);
    });
  });

  describe("with startId", () => {
    it("returns startId if not in use", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 5)).toBe(5);
    });

    it("increments from startId until finding unused id", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 2, label: "P2", multipliers: [1] },
        { id: 3, label: "P3", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 1)).toBe(4);
    });

    it("returns startId when patterns is empty", () => {
      const patterns: Patterns = new Map();
      expect(getNextPatternId(patterns, 10)).toBe(10);
    });

    it("returns 1 when startId is 0", () => {
      const patterns: Patterns = new Map();
      expect(getNextPatternId(patterns, 0)).toBe(1);
    });

    it("handles non-sequential ids correctly", () => {
      const patterns = createPatterns([
        { id: 5, label: "P5", multipliers: [1] },
        { id: 10, label: "P10", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 5)).toBe(6);
    });
  });
});

describe("getJunctionDemands", () => {
  it("returns empty demands when junction has no assignments", () => {
    const demands = createEmptyDemands();

    expect(getJunctionDemands(demands, 1)).toEqual([]);
  });

  it("can store and retrieve demands for a junction", () => {
    const junctionDemands: Demand[] = [{ baseDemand: 10 }];
    const demands = {
      ...createEmptyDemands(),
      junctions: new Map([[1, junctionDemands]]),
    };

    expect(getJunctionDemands(demands, 1)).toEqual([{ baseDemand: 10 }]);
  });

  it("supports demands array with multiple categories", () => {
    const junctionDemands: Demand[] = [
      { baseDemand: 50, patternId: 1 },
      { baseDemand: 30, patternId: 2 },
    ];
    const demands = {
      ...createEmptyDemands(),
      junctions: new Map([[1, junctionDemands]]),
    };

    const result = getJunctionDemands(demands, 1);
    expect(result).toHaveLength(2);
    expect(result[0].baseDemand).toBe(50);
    expect(result[0].patternId).toBe(1);
    expect(result[1].baseDemand).toBe(30);
    expect(result[1].patternId).toBe(2);
  });

  it("demand assignments for different junctions are independent", () => {
    const demands = {
      ...createEmptyDemands(),
      junctions: new Map([
        [1, [{ baseDemand: 50, patternId: 1 }]],
        [2, [{ baseDemand: 100 }]],
      ]),
    };

    const demandsForJunction1 = getJunctionDemands(demands, 1);
    const demandsForJunction2 = getJunctionDemands(demands, 2);

    expect(demandsForJunction1[0].baseDemand).toBe(50);
    expect(demandsForJunction2[0].baseDemand).toBe(100);
  });
});

describe("calculateAverageDemand", () => {
  it("calculates average demand without patterns", () => {
    const demands: Demand[] = [{ baseDemand: 25 }];
    const patterns = new Map();

    expect(calculateAverageDemand(demands, patterns)).toEqual(25);
  });

  it("calculates average demand of zero for empty demands", () => {
    const demands: Demand[] = [];
    const patterns = new Map();

    expect(calculateAverageDemand(demands, patterns)).toEqual(0);
  });
});
