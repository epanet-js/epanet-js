import { describe, it, expect } from "vitest";
import { computeAssetsStats } from "./asset-stats";
import type {
  QuantityStats,
  CategoryStats,
  BooleanStats,
  LiteralCategoryStats,
  PropertyStats,
} from "./stats";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { createMockResultsReader } from "src/__helpers__/state";

describe("computeMultiAssetData", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const findQuantityStat = (
    stats: PropertyStats[],
    property: string,
  ): QuantityStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("quantity");
    return stat as QuantityStats;
  };

  const findCategoryStat = (
    stats: PropertyStats[],
    property: string,
  ): CategoryStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("category");
    return stat as CategoryStats;
  };

  const findBooleanStat = (
    stats: PropertyStats[],
    property: string,
  ): BooleanStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("boolean");
    return stat as BooleanStats;
  };

  const findLiteralCategoryStat = (
    stats: PropertyStats[],
    property: string,
  ): LiteralCategoryStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("literalCategory");
    return stat as LiteralCategoryStats;
  };

  it("groups assets by type", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    expect(result.data.junction).toBeDefined();
    expect(result.data.pipe).toBeDefined();
    expect(result.counts.junction).toBe(2);
    expect(result.counts.pipe).toBe(1);
  });

  it("computes junction stats with sections", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
      .aJunction(IDS.J2, { elevation: 150 })
      .aJunctionDemand(IDS.J2, [{ baseDemand: 20 }])
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const junctionData = result.data.junction;
    expect(junctionData.modelAttributes).toBeDefined();
    expect(junctionData.demands).toBeDefined();
    expect(junctionData.simulationResults).toBeDefined();

    const elevationStat = findQuantityStat(
      junctionData.modelAttributes,
      "elevation",
    );
    expect(elevationStat.min).toBe(100);
    expect(elevationStat.max).toBe(150);
    expect(elevationStat.mean).toBe(125);
    expect(elevationStat.unit).toBe("m");
    expect(elevationStat.decimals).toBe(3);

    const demandStat = findQuantityStat(junctionData.demands, "directDemand");
    expect(demandStat.min).toBe(10);
    expect(demandStat.max).toBe(20);
    expect(demandStat.unit).toBe("l/s");
  });

  it("excludes null simulation results from stats", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 150 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const simulationStats = result.data.junction.simulationResults;
    expect(simulationStats).toHaveLength(0);
  });

  it("includes simulation results when available", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 150 })
      .build();
    const simulationResults = createMockResultsReader({
      junctions: {
        [IDS.J1]: { pressure: 50, head: 150, demand: 10 },
        [IDS.J2]: { pressure: 60, head: 210, demand: 15 },
      },
    });

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
      simulationResults,
    );

    const simulationStats = result.data.junction.simulationResults;
    expect(simulationStats.length).toBeGreaterThan(0);

    const pressureStat = findQuantityStat(simulationStats, "pressure");
    expect(pressureStat.min).toBe(50);
    expect(pressureStat.max).toBe(60);
    expect(pressureStat.unit).toBe("mwc");
  });

  it("computes pipe stats with sections", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 300,
        length: 1000,
        roughness: 130,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 200,
        length: 500,
        roughness: 100,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const pipeData = result.data.pipe;
    expect(pipeData.modelAttributes).toBeDefined();
    expect(pipeData.simulationResults).toBeDefined();

    const diameterStat = findQuantityStat(pipeData.modelAttributes, "diameter");
    expect(diameterStat.min).toBe(200);
    expect(diameterStat.max).toBe(300);
    expect(diameterStat.unit).toBe("mm");
  });

  it("computeMultiAssetData surfaces material and year stats", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "PVC",
        year: 1995,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "Steel",
        year: 2005,
      })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const materialStat = findCategoryStat(
      result.data.pipe.modelAttributes,
      "material",
    );
    expect(materialStat.values.get("PVC")).toHaveLength(1);
    expect(materialStat.values.get("Steel")).toHaveLength(1);
    expect(materialStat.emptyBucket).toBeUndefined();
    const yearStat = findQuantityStat(result.data.pipe.modelAttributes, "year");
    expect(yearStat.min).toBe(1995);
    expect(yearStat.max).toBe(2005);
    expect(yearStat.decimals).toBe(0);
    expect(yearStat.unit).toBeNull();
    expect(yearStat.emptyBucket).toBeUndefined();
  });

  it("counts pipes with unset material under an emptyBucket", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, P3: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "PVC",
      })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P3, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const materialStat = findCategoryStat(
      result.data.pipe.modelAttributes,
      "material",
    );
    expect(materialStat.values.get("PVC")).toHaveLength(1);
    expect(materialStat.emptyBucket?.label).toBe("none");
    expect(materialStat.emptyBucket?.ids).toEqual([IDS.P2, IDS.P3]);
  });

  it("counts an unset fixed-default optional field as its default value, not an empty bucket", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, minorLoss: 2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2, minorLoss: 5 })
      .build();
    // Simulate a value cleared in the editors (minor loss defaults to 0).
    hydraulicModel.assets.get(IDS.P2)!.setProperty("minorLoss", undefined);

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const minorLossStat = findQuantityStat(
      result.data.pipe.modelAttributes,
      "minorLoss",
    );
    expect(minorLossStat.values.get(2)).toEqual([IDS.P1]);
    expect(minorLossStat.values.get(0)).toEqual([IDS.P2]);
    expect(minorLossStat.min).toBe(0);
    expect(minorLossStat.max).toBe(2);
    expect(minorLossStat.times).toBe(2);
    expect(minorLossStat.emptyBucket).toBeUndefined();
  });

  it("counts pipes with unset year in emptyBucket and excludes them from min/max/mean", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, P3: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        year: 1995,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        year: 2005,
      })
      .aPipe(IDS.P3, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const yearStat = findQuantityStat(result.data.pipe.modelAttributes, "year");
    expect(yearStat.min).toBe(1995);
    expect(yearStat.max).toBe(2005);
    expect(yearStat.mean).toBe(2000);
    expect(yearStat.times).toBe(2);
    expect(yearStat.emptyBucket?.label).toBe("none");
    expect(yearStat.emptyBucket?.ids).toEqual([IDS.P3]);
  });

  it("counts pipes with null roughness in emptyBucket and excludes them from min/max/mean", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, P3: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        roughness: 130,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        roughness: 100,
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        roughness: null,
      })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const roughnessStat = findQuantityStat(
      result.data.pipe.modelAttributes,
      "roughness",
    );
    expect(roughnessStat.times).toBe(2);
    expect(roughnessStat.emptyBucket?.label).toBe("none");
    expect(roughnessStat.emptyBucket?.ids).toEqual([IDS.P3]);
  });

  it("surfaces roughness stat with only emptyBucket when every pipe is null", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        roughness: null,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        roughness: null,
      })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const roughnessStat = findQuantityStat(
      result.data.pipe.modelAttributes,
      "roughness",
    );
    expect(roughnessStat.values.size).toBe(0);
    expect(roughnessStat.emptyBucket?.ids).toEqual([IDS.P1, IDS.P2]);
  });

  it("surfaces material stat with only emptyBucket when no pipe has a material", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const materialStat = findCategoryStat(
      result.data.pipe.modelAttributes,
      "material",
    );
    expect(materialStat.values.size).toBe(0);
    expect(materialStat.emptyBucket?.ids).toEqual([IDS.P1, IDS.P2]);
  });

  it("includes unset chemicalSourceType in emptyBucket and skips strength/pattern for those assets", () => {
    const IDS = { J1: 1, J2: 2, J3: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        chemicalSourceType: "concen",
        chemicalSourceStrength: 5,
      })
      .aJunction(IDS.J2, { chemicalSourceType: "mass" })
      .aJunction(IDS.J3)
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const typeStat = findCategoryStat(
      result.data.junction.quality,
      "chemicalSourceType",
    );
    expect(typeStat.values.get("source.concen")).toHaveLength(1);
    expect(typeStat.values.get("source.mass")).toHaveLength(1);
    expect(typeStat.emptyBucket?.label).toBe("none");
    expect(typeStat.emptyBucket?.ids).toEqual([IDS.J3]);

    // J2 has a source type but no strength, so it lands in the empty bucket
    // (the field shows "0" as its placeholder). J3 has no source type, so
    // strength is skipped for it entirely.
    const strengthStat = findQuantityStat(
      result.data.junction.quality,
      "chemicalSourceStrength",
    );
    expect(strengthStat.values.get(5)).toEqual([IDS.J1]);
    expect(strengthStat.times).toBe(1);
    expect(strengthStat.emptyBucket?.label).toBe("none");
    expect(strengthStat.emptyBucket?.ids).toEqual([IDS.J2]);
  });

  it("groups pipes with unset bulk/wall reaction coefficients under globalDefault", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        bulkReactionCoeff: -0.5,
      })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const bulkStat = findQuantityStat(
      result.data.pipe.quality,
      "bulkReactionCoeff",
    );
    expect(bulkStat.values.get(-0.5)).toEqual([IDS.P1]);
    expect(bulkStat.emptyBucket?.label).toBe("globalDefault");
    expect(bulkStat.emptyBucket?.ids).toEqual([IDS.P2]);

    const wallStat = findQuantityStat(
      result.data.pipe.quality,
      "wallReactionCoeff",
    );
    expect(wallStat.emptyBucket?.label).toBe("globalDefault");
    expect(wallStat.emptyBucket?.ids).toEqual([IDS.P1, IDS.P2]);
  });

  it("groups reservoirs by head pattern with constant for those without one", () => {
    const IDS = { PAT: 1, R1: 2, R2: 3, R3: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPattern(IDS.PAT, "Daily Demand", [1, 1.2], "demand")
      .aReservoir(IDS.R1, { headPatternId: IDS.PAT })
      .aReservoir(IDS.R2, { headPatternId: IDS.PAT })
      .aReservoir(IDS.R3)
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const headPatternStat = findLiteralCategoryStat(
      result.data.reservoir.modelAttributes,
      "headPattern",
    );
    expect(headPatternStat.values.get("Daily Demand")).toEqual([
      IDS.R1,
      IDS.R2,
    ]);
    expect(headPatternStat.emptyBucket?.label).toBe("constant");
    expect(headPatternStat.emptyBucket?.ids).toEqual([IDS.R3]);
  });

  it("surfaces speedPattern only for pumps with a speedPatternId", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      PAT: 3,
      PU1: 4,
      PU2: 5,
      PU3: 6,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPattern(IDS.PAT, "Daytime", [1, 1.5], "demand")
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        speedPatternId: IDS.PAT,
      })
      .aPump(IDS.PU2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        speedPatternId: IDS.PAT,
      })
      .aPump(IDS.PU3, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const speedPatternStat = findLiteralCategoryStat(
      result.data.pump.modelAttributes,
      "speedPattern",
    );
    expect(speedPatternStat.values.get("Daytime")).toEqual([IDS.PU1, IDS.PU2]);
    expect(speedPatternStat.emptyBucket?.label).toBe("constant");
    expect(speedPatternStat.emptyBucket?.ids).toEqual([IDS.PU3]);
  });

  it("includes speed for all pumps regardless of speed pattern", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      PAT: 3,
      PU1: 4,
      PU2: 5,
      PU3: 6,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPattern(IDS.PAT, "Daytime", [1, 1.5], "demand")
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        speed: 1.2,
      })
      .aPump(IDS.PU2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        speed: 0.8,
      })
      .aPump(IDS.PU3, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        speed: 1,
        speedPatternId: IDS.PAT,
      })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const speedStat = findQuantityStat(
      result.data.pump.modelAttributes,
      "speed",
    );
    expect(speedStat.values.get(1.2)).toEqual([IDS.PU1]);
    expect(speedStat.values.get(0.8)).toEqual([IDS.PU2]);
    expect(speedStat.values.get(1)).toEqual([IDS.PU3]);
    expect(speedStat.min).toBe(0.8);
    expect(speedStat.max).toBe(1.2);
    expect(speedStat.times).toBe(3);
    expect(speedStat.emptyBucket).toBeUndefined();
  });

  it("shows speedPattern with all pumps in constant bucket when none use a speed pattern", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3, PU2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.PU1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.PU2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const assets = Array.from(hydraulicModel.assets.values());

    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const speedPatternStat = findLiteralCategoryStat(
      result.data.pump.modelAttributes,
      "speedPattern",
    );
    expect(speedPatternStat.values.size).toBe(0);
    expect(speedPatternStat.emptyBucket?.label).toBe("constant");
    expect(speedPatternStat.emptyBucket?.ids).toEqual([IDS.PU1, IDS.PU2]);
  });

  it("computes category stats for status properties", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, P3: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        initialStatus: "open",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        initialStatus: "closed",
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J3,
        initialStatus: "open",
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const statusStat = findCategoryStat(
      result.data.pipe.modelAttributes,
      "initialStatus",
    );
    expect(statusStat.values.get("pipe.open")).toHaveLength(2);
    expect(statusStat.values.get("pipe.closed")).toHaveLength(1);
  });

  it("handles empty asset arrays", () => {
    const hydraulicModel = HydraulicModelBuilder.empty();
    const result = computeAssetsStats([], units, formatting, hydraulicModel);

    expect(result.data.junction.modelAttributes).toEqual([]);
    expect(result.data.junction.demands).toEqual([]);
    expect(result.data.junction.simulationResults).toEqual([]);
  });

  it("handles mixed asset types", () => {
    const IDS = { J1: 1, R1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aReservoir(IDS.R1, { elevation: 200 })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    expect(result.data.junction.modelAttributes.length).toBeGreaterThan(0);
    expect(result.data.reservoir.modelAttributes.length).toBeGreaterThan(0);
    expect(result.data.pipe.modelAttributes.length).toBeGreaterThan(0);
  });

  it("computes pump stats with type categories", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "power",
        power: 20,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const pumpData = result.data.pump;
    expect(pumpData.modelAttributes).toBeDefined();

    const typeStat = findCategoryStat(pumpData.modelAttributes, "pumpType");
    expect(typeStat.values.get("power")).toHaveLength(1);
  });

  it("maps curveId to namedCurve in pumpType", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3, PU2: 4, C1: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPumpCurve({
        id: IDS.C1,
        label: "Curve A",
        points: [
          { x: 0, y: 40 },
          { x: 100, y: 30 },
          { x: 200, y: 10 },
          { x: 250, y: 0 },
        ],
      })
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "power",
        power: 50,
      })
      .aPump(IDS.PU2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "curveId",
        curveId: IDS.C1,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const typeStat = findCategoryStat(
      result.data.pump.modelAttributes,
      "pumpType",
    );
    expect(typeStat.values.size).toBe(2);
    expect(typeStat.values.has("power")).toBe(true);
    expect(typeStat.values.has("namedCurve")).toBe(true);
  });

  it("classifies standard curve pumps in pumpType", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "standardCurve",
        curve: [
          { x: 0, y: 40 },
          { x: 150, y: 30 },
          { x: 300, y: 0 },
        ],
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const typeStat = findCategoryStat(
      result.data.pump.modelAttributes,
      "pumpType",
    );
    expect(typeStat.values.has("standardCurve")).toBe(true);
  });

  it("shows curve label in pumpName for named curve pumps", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3, C1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPumpCurve({
        id: IDS.C1,
        label: "Main Pump Curve",
        points: [
          { x: 0, y: 40 },
          { x: 100, y: 30 },
          { x: 200, y: 10 },
          { x: 250, y: 0 },
        ],
      })
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "curveId",
        curveId: IDS.C1,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const curveStat = findLiteralCategoryStat(
      result.data.pump.modelAttributes,
      "pumpName",
    );
    expect(curveStat.values.size).toBe(1);
    expect(curveStat.values.has("Main Pump Curve")).toBe(true);
  });

  it("hides pumpName when no pumps use named curves", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "power",
        power: 50,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const nameStat = result.data.pump.modelAttributes.find(
      (s) => s.property === "pumpName",
    );
    expect(nameStat).toBeUndefined();
  });

  it("groups pumps by curve label and empty in pumpName stats", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3, PU2: 4, PU3: 5, C1: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPumpCurve({
        id: IDS.C1,
        label: "Shared Curve",
        points: [
          { x: 0, y: 40 },
          { x: 100, y: 30 },
          { x: 200, y: 10 },
          { x: 250, y: 0 },
        ],
      })
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "curveId",
        curveId: IDS.C1,
      })
      .aPump(IDS.PU2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "curveId",
        curveId: IDS.C1,
      })
      .aPump(IDS.PU3, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        definitionType: "power",
        power: 75,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const curveStat = findLiteralCategoryStat(
      result.data.pump.modelAttributes,
      "pumpName",
    );
    expect(curveStat.values.size).toBe(1);
    expect(curveStat.values.get("Shared Curve")).toHaveLength(2);
    expect(curveStat.emptyBucket?.label).toBe("none");
    expect(curveStat.emptyBucket?.ids).toHaveLength(1);
  });

  it("handles partial simulation results", () => {
    const IDS = { J1: 1, J2: 2, J3: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 150 })
      .aJunction(IDS.J3, { elevation: 200 })
      .build();
    const simulationResults = createMockResultsReader({
      junctions: {
        [IDS.J1]: { pressure: 50, head: 150, demand: 10 },
      },
    });

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
      simulationResults,
    );

    const simulationStats = result.data.junction.simulationResults;
    const pressureStat = findQuantityStat(simulationStats, "pressure");

    expect(pressureStat.times).toBe(1);
    expect(pressureStat.min).toBe(50);
    expect(pressureStat.max).toBe(50);
  });

  it("computes valve stats with valve type categories", () => {
    const IDS = { J1: 1, J2: 2, V1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aValve(IDS.V1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        kind: "prv",
        setting: 50,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const valveData = result.data.valve;
    const typeStat = findCategoryStat(valveData.modelAttributes, "valveType");
    expect(typeStat.values.get("valve.prv")).toHaveLength(1);
  });

  it("computes tank stats with sections", () => {
    const IDS = { T1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank(IDS.T1, {
        elevation: 100,
        initialLevel: 10,
        minLevel: 0,
        maxLevel: 20,
        diameter: 10,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const tankData = result.data.tank;
    expect(tankData.modelAttributes.length).toBeGreaterThan(0);

    const elevationStat = findQuantityStat(
      tankData.modelAttributes,
      "elevation",
    );
    expect(elevationStat.min).toBe(100);
    expect(elevationStat.unit).toBe("m");
  });

  it("hides volumeCurve when no tanks use curve-based definitions", () => {
    const IDS = { T1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank(IDS.T1, {
        elevation: 100,
        initialLevel: 10,
        minLevel: 0,
        maxLevel: 20,
        diameter: 10,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const curveStat = result.data.tank.modelAttributes.find(
      (s) => s.property === "volumeCurve",
    );
    expect(curveStat).toBeUndefined();
  });

  it("computes reservoir stats", () => {
    const IDS = { R1: 1, R2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { elevation: 200 })
      .aReservoir(IDS.R2, { elevation: 250 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const reservoirData = result.data.reservoir;
    expect(reservoirData.modelAttributes.length).toBeGreaterThan(0);

    const elevationStat = findQuantityStat(
      reservoirData.modelAttributes,
      "elevation",
    );
    expect(elevationStat.min).toBe(200);
    expect(elevationStat.max).toBe(250);
  });

  it("tracks isEnabled status with mixed active/inactive assets", () => {
    const IDS = { P1: 1, P2: 2, P3: 3, J1: 4, J2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, isActive: true })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .aPipe(IDS.P3, { startNodeId: IDS.J1, endNodeId: IDS.J2, isActive: true })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeAssetsStats(
      assets,
      units,
      formatting,
      hydraulicModel,
    );

    const isEnabledStat = findBooleanStat(
      result.data.pipe.activeTopology,
      "isEnabled",
    );
    expect(isEnabledStat.values.get("yes")).toHaveLength(2);
    expect(isEnabledStat.values.get("no")).toHaveLength(1);
  });

  describe("average demand calculation", () => {
    it("calculates average demand for junction with only constant demands", () => {
      const IDS = { J1: 1, J2: 2 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }, { baseDemand: 20 }])
        .aJunction(IDS.J2)
        .aJunctionDemand(IDS.J2, [{ baseDemand: 30 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      expect(demandStat.min).toBe(30); // J1: 10+20=30, J2: 30
      expect(demandStat.max).toBe(30);
      expect(demandStat.mean).toBe(30);
      expect(demandStat.unit).toBe("l/s");
    });

    it("calculates average demand with pattern multipliers", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern with multipliers [0.5, 1.0, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 1.0, 1.5])
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 100, patternId: IDS.PAT1 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      // baseDemand 100 * average multiplier 1.0 = 100
      expect(demandStat.min).toBe(100);
      expect(demandStat.max).toBe(100);
    });

    it("calculates average demand with non-uniform pattern multipliers", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern with multipliers [0.5, 0.5, 2.0] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 0.5, 2.0])
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 60, patternId: IDS.PAT1 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      // baseDemand 60 * average multiplier 1.0 = 60
      expect(demandStat.min).toBe(60);
    });

    it("calculates average demand with mixed constant and pattern demands", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern with multipliers [2.0, 2.0] -> average = 2.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [2.0, 2.0])
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [
          { baseDemand: 10 }, // constant -> 10
          { baseDemand: 20, patternId: IDS.PAT1 }, // 20 * 2.0 = 40
        ])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      // 10 + 40 = 50
      expect(demandStat.min).toBe(50);
    });

    it("handles empty demands array", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      expect(demandStat.min).toBe(0);
      expect(demandStat.max).toBe(0);
    });

    it("treats missing pattern as constant (multiplier = 1)", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50, patternId: 404 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      // Treat as constant when pattern not found
      expect(demandStat.min).toBe(50);
    });

    it("computes statistics across multiple junctions with different average demands", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, PAT1: 10 } as const;
      // Pattern [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 1.5])
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }]) // avg = 10
        .aJunction(IDS.J2)
        .aJunctionDemand(IDS.J2, [{ baseDemand: 20 }]) // avg = 20
        .aJunction(IDS.J3)
        .aJunctionDemand(IDS.J3, [{ baseDemand: 30, patternId: IDS.PAT1 }]) // avg = 30 * 1.0 = 30
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      expect(demandStat.min).toBe(10);
      expect(demandStat.max).toBe(30);
      expect(demandStat.mean).toBe(20); // (10 + 20 + 30) / 3 = 20
    });

    it("ignores global demand multiplier to average demand", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      expect(demandStat.min).toBe(50);
    });

    it("ignores global demand multiplier with pattern demands", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 1.5])
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 20, patternId: IDS.PAT1 }])
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "directDemand",
      );
      expect(demandStat.min).toBe(20);
    });
  });

  describe("customer point demand calculation with patterns", () => {
    it("calculates customer demand using average demand with patterns", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4, PAT1: 5 } as const;
      // Pattern with multipliers [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "residential", [0.5, 1.5])
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [
          { baseDemand: 100, patternId: IDS.PAT1 },
        ])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      // baseDemand 100 * average multiplier 1.0 = 100
      expect(customerDemandStat.min).toBe(100);
      expect(customerDemandStat.max).toBe(100);
    });

    it("calculates customer demand with non-uniform pattern", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4, PAT1: 5 } as const;
      // Pattern with multipliers [0.5, 1.0, 1.5, 2.0] -> average = 1.25
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "variable", [0.5, 1.0, 1.5, 2.0])
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [
          { baseDemand: 100, patternId: IDS.PAT1 },
        ])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      // baseDemand 100 * average multiplier 1.25 = 125
      expect(customerDemandStat.min).toBe(125);
    });

    it("calculates customer demand with multiple demands per customer point", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4, PAT1: 5 } as const;
      // Pattern [2.0, 2.0] -> average = 2.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "high", [2.0, 2.0])
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [
          { baseDemand: 10 }, // constant -> 10
          { baseDemand: 20, patternId: IDS.PAT1 }, // 20 * 2.0 = 40
        ])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      // 10 + 40 = 50
      expect(customerDemandStat.min).toBe(50);
    });

    it("sums customer demands from multiple customer points with patterns", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4, CP2: 5, PAT1: 5 } as const;
      // Pattern [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "residential", [0.5, 1.5])
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [
          { baseDemand: 30, patternId: IDS.PAT1 },
        ])
        .aCustomerPoint(IDS.CP2, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP2, [{ baseDemand: 20 }])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      // CP1: 30 * 1.0 = 30, CP2: 20 -> total = 50
      expect(customerDemandStat.min).toBe(50);
    });

    it("calculates pipe customer demand using average demand with patterns", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4, PAT1: 5 } as const;
      // Pattern with multipliers [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "commercial", [0.5, 1.5])
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [
          { baseDemand: 80, patternId: IDS.PAT1 },
        ])
        .build();

      const pipes = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "pipe",
      );
      const result = computeAssetsStats(
        pipes,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.pipe.demands,
        "customerDemand",
      );
      // baseDemand 80 * average multiplier 1.0 = 80
      expect(customerDemandStat.min).toBe(80);
    });

    it("handles customer point with missing pattern gracefully", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 50, patternId: 404 }])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      // Missing pattern treated as constant (multiplier = 1)
      expect(customerDemandStat.min).toBe(50);
    });

    it("handles customer point with constant demand (no pattern)", () => {
      const IDS = { J1: 1, P1: 2, J2: 3, CP1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
        .build();

      const junctions = Array.from(hydraulicModel.assets.values()).filter(
        (a) => a.type === "junction",
      );
      const result = computeAssetsStats(
        junctions,
        units,
        formatting,
        hydraulicModel,
      );

      const customerDemandStat = findQuantityStat(
        result.data.junction.demands,
        "customerDemand",
      );
      expect(customerDemandStat.min).toBe(25);
    });
  });

  describe("other asset types unchanged", () => {
    it("computes pipe stats the same as non-EPS version", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          diameter: 300,
          length: 1000,
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeAssetsStats(
        assets,
        units,
        formatting,
        hydraulicModel,
      );

      const diameterStat = findQuantityStat(
        result.data.pipe.modelAttributes,
        "diameter",
      );
      expect(diameterStat.min).toBe(300);
      expect(diameterStat.unit).toBe("mm");
    });
  });
});
