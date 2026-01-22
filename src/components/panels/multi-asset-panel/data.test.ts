import { describe, it, expect } from "vitest";
import {
  computeMultiAssetData,
  QuantityStats,
  CategoryStats,
  AssetPropertyStats,
} from "./data";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets, Quantities } from "src/model-metadata/quantities-spec";

describe("computeMultiAssetData", () => {
  const quantities = new Quantities(presets.LPS);

  const findQuantityStat = (
    stats: AssetPropertyStats[],
    property: string,
  ): QuantityStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("quantity");
    return stat as QuantityStats;
  };

  const findCategoryStat = (
    stats: AssetPropertyStats[],
    property: string,
  ): CategoryStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat).toBeDefined();
    expect(stat?.type).toBe("category");
    return stat as CategoryStats;
  };

  it("groups assets by type", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    expect(result.data.junction).toBeDefined();
    expect(result.data.pipe).toBeDefined();
    expect(result.counts.junction).toBe(2);
    expect(result.counts.pipe).toBe(1);
  });

  it("computes junction stats with sections", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        elevation: 100,
        demands: [{ baseDemand: 10 }],
      })
      .aJunction(IDS.J2, {
        elevation: 150,
        demands: [{ baseDemand: 20 }],
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

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

    const demandStat = findQuantityStat(junctionData.demands, "averageDemand");
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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const simulationStats = result.data.junction.simulationResults;
    expect(simulationStats).toHaveLength(0);
  });

  it("includes simulation results when available", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        elevation: 100,
        simulation: { pressure: 50, head: 150, demand: 10 },
      })
      .aJunction(IDS.J2, {
        elevation: 150,
        simulation: { pressure: 60, head: 210, demand: 15 },
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const pipeData = result.data.pipe;
    expect(pipeData.modelAttributes).toBeDefined();
    expect(pipeData.simulationResults).toBeDefined();

    const diameterStat = findQuantityStat(pipeData.modelAttributes, "diameter");
    expect(diameterStat.min).toBe(200);
    expect(diameterStat.max).toBe(300);
    expect(diameterStat.unit).toBe("mm");
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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const statusStat = findCategoryStat(
      result.data.pipe.modelAttributes,
      "initialStatus",
    );
    expect(statusStat.values.get("pipe.open")).toBe(2);
    expect(statusStat.values.get("pipe.closed")).toBe(1);
  });

  it("handles empty asset arrays", () => {
    const hydraulicModel = HydraulicModelBuilder.empty();
    const result = computeMultiAssetData([], quantities, hydraulicModel);

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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const pumpData = result.data.pump;
    expect(pumpData.modelAttributes).toBeDefined();

    const typeStat = findCategoryStat(pumpData.modelAttributes, "pumpType");
    expect(typeStat.values.get("power")).toBe(1);
  });

  it("handles partial simulation results", () => {
    const IDS = { J1: 1, J2: 2, J3: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        elevation: 100,
        simulation: { pressure: 50, head: 150, demand: 10 },
      })
      .aJunction(IDS.J2, { elevation: 150 })
      .aJunction(IDS.J3, { elevation: 200 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const valveData = result.data.valve;
    const typeStat = findCategoryStat(valveData.modelAttributes, "valveType");
    expect(typeStat.values.get("valve.prv")).toBe(1);
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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const tankData = result.data.tank;
    expect(tankData.modelAttributes.length).toBeGreaterThan(0);

    const elevationStat = findQuantityStat(
      tankData.modelAttributes,
      "elevation",
    );
    expect(elevationStat.min).toBe(100);
    expect(elevationStat.unit).toBe("m");
  });

  it("computes reservoir stats", () => {
    const IDS = { R1: 1, R2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { elevation: 200 })
      .aReservoir(IDS.R2, { elevation: 250 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

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
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const isEnabledStat = findCategoryStat(
      result.data.pipe.activeTopology,
      "isEnabled",
    );
    expect(isEnabledStat.values.get("yes")).toBe(2);
    expect(isEnabledStat.values.get("no")).toBe(1);
  });

  describe("average demand calculation", () => {
    it("calculates average demand for junction with only constant demands", () => {
      const IDS = { J1: 1, J2: 2 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 10 }, { baseDemand: 20 }],
        })
        .aJunction(IDS.J2, {
          demands: [{ baseDemand: 30 }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
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
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 100, patternLabel: "pattern1" }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
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
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 60, patternLabel: "pattern1" }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      // baseDemand 60 * average multiplier 1.0 = 60
      expect(demandStat.min).toBe(60);
    });

    it("calculates average demand with mixed constant and pattern demands", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern with multipliers [2.0, 2.0] -> average = 2.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [2.0, 2.0])
        .aJunction(IDS.J1, {
          demands: [
            { baseDemand: 10 }, // constant -> 10
            { baseDemand: 20, patternLabel: "pattern1" }, // 20 * 2.0 = 40
          ],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      // 10 + 40 = 50
      expect(demandStat.min).toBe(50);
    });

    it("handles empty demands array", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { demands: [] })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      expect(demandStat.min).toBe(0);
      expect(demandStat.max).toBe(0);
    });

    it("treats missing pattern as constant (multiplier = 1)", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 50, patternLabel: "nonexistent" }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      // Treat as constant when pattern not found
      expect(demandStat.min).toBe(50);
    });

    it("computes statistics across multiple junctions with different average demands", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, PAT1: 10 } as const;
      // Pattern [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 1.5])
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] }) // avg = 10
        .aJunction(IDS.J2, { demands: [{ baseDemand: 20 }] }) // avg = 20
        .aJunction(IDS.J3, {
          demands: [{ baseDemand: 30, patternLabel: "pattern1" }],
        }) // avg = 30 * 1.0 = 30
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      expect(demandStat.min).toBe(10);
      expect(demandStat.max).toBe(30);
      expect(demandStat.mean).toBe(20); // (10 + 20 + 30) / 3 = 20
    });

    it("ignores global demand multiplier to average demand", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .demandMultiplier(2.0)
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 50 }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      expect(demandStat.min).toBe(50);
    });

    it("ignores global demand multiplier with pattern demands", () => {
      const IDS = { J1: 1, PAT1: 2 } as const;
      // Pattern [0.5, 1.5] -> average = 1.0
      const hydraulicModel = HydraulicModelBuilder.with()
        .demandMultiplier(3.0)
        .aDemandPattern(IDS.PAT1, "pattern1", [0.5, 1.5])
        .aJunction(IDS.J1, {
          demands: [{ baseDemand: 20, patternLabel: "pattern1" }],
        })
        .build();

      const assets = Array.from(hydraulicModel.assets.values());
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const demandStat = findQuantityStat(
        result.data.junction.demands,
        "averageDemand",
      );
      expect(demandStat.min).toBe(20);
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
      const result = computeMultiAssetData(assets, quantities, hydraulicModel);

      const diameterStat = findQuantityStat(
        result.data.pipe.modelAttributes,
        "diameter",
      );
      expect(diameterStat.min).toBe(300);
      expect(diameterStat.unit).toBe("mm");
    });
  });
});
