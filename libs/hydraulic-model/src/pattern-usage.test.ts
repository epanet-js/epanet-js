import { describe, it, expect } from "vitest";
import { isPatternInUse } from "./pattern-usage";
import type { Asset } from "./asset-types";
import { createEmptyDemands, type Demand } from "./demands";
import { initializeHydraulicModel } from "./hydraulic-model";
import type { Patterns, PatternType } from "./patterns";
import { buildJunction } from "./test-helpers";

describe("isPatternInUse", () => {
  const IDS = { PATTERN: 10, OTHER_PATTERN: 11, J1: 1, CP1: 2, CP2: 3 };

  it("detects a junction demand pattern when customer points have demands", () => {
    const hydraulicModel = aModel({
      patterns: patterns(
        [IDS.PATTERN, "demand"],
        [IDS.OTHER_PATTERN, "demand"],
      ),
      assets: [buildJunction({ id: IDS.J1 })],
      junctionDemands: [[IDS.J1, [{ baseDemand: 1, patternId: IDS.PATTERN }]]],
      customerDemands: [
        [IDS.CP1, [{ baseDemand: 1, patternId: IDS.OTHER_PATTERN }]],
      ],
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("checks every customer point, not just the first", () => {
    const hydraulicModel = aModel({
      patterns: patterns([IDS.PATTERN, "demand"]),
      customerDemands: [
        [IDS.CP1, [{ baseDemand: 1 }]],
        [IDS.CP2, [{ baseDemand: 1, patternId: IDS.PATTERN }]],
      ],
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects a quality source pattern", () => {
    const hydraulicModel = aModel({
      patterns: patterns([IDS.PATTERN, "qualitySourceStrength"]),
      assets: [
        buildJunction({ id: IDS.J1, chemicalSourcePatternId: IDS.PATTERN }),
      ],
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects an uncategorized pattern", () => {
    const hydraulicModel = aModel({
      patterns: patterns([IDS.PATTERN, undefined]),
      assets: [buildJunction({ id: IDS.J1 })],
      junctionDemands: [[IDS.J1, [{ baseDemand: 1, patternId: IDS.PATTERN }]]],
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects the global energy price pattern", () => {
    const hydraulicModel = aModel({
      patterns: patterns([IDS.PATTERN, "energyPrice"]),
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN, IDS.PATTERN)).toBe(true);
  });

  it("ignores patterns nothing references", () => {
    const hydraulicModel = aModel({
      patterns: patterns(
        [IDS.PATTERN, "demand"],
        [IDS.OTHER_PATTERN, "demand"],
      ),
      assets: [buildJunction({ id: IDS.J1 })],
      junctionDemands: [
        [IDS.J1, [{ baseDemand: 1, patternId: IDS.OTHER_PATTERN }]],
      ],
    });

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN, null)).toBe(false);
  });
});

const patterns = (...entries: [number, PatternType | undefined][]): Patterns =>
  new Map(
    entries.map(([id, type]) => [
      id,
      { id, label: `PAT${id}`, type, multipliers: [1] },
    ]),
  );

const aModel = ({
  patterns,
  assets = [],
  junctionDemands = [],
  customerDemands = [],
}: {
  patterns: Patterns;
  assets?: Asset[];
  junctionDemands?: [number, Demand[]][];
  customerDemands?: [number, Demand[]][];
}) =>
  initializeHydraulicModel({
    patterns,
    assets: new Map(assets.map((asset) => [asset.id, asset])),
    demands: {
      ...createEmptyDemands(),
      junctions: new Map(junctionDemands),
      customerPoints: new Map(customerDemands),
    },
  });
