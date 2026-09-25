import { describe, it, expect } from "vitest";
import {
  Demand,
  getJunctionDemands,
  calculateAverageDemand,
  createEmptyDemands,
} from "./demands";
import { Patterns } from "./patterns";

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
    const patterns: Patterns = new Map();

    expect(calculateAverageDemand(demands, patterns)).toEqual(25);
  });

  it("calculates average demand of zero for empty demands", () => {
    const demands: Demand[] = [];
    const patterns: Patterns = new Map();

    expect(calculateAverageDemand(demands, patterns)).toEqual(0);
  });
});
