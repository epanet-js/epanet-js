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
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
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
      .aJunction(IDS.J1, { elevation: 100, baseDemand: 10 })
      .aJunction(IDS.J2, { elevation: 150, baseDemand: 20 })
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

    const demandStat = findQuantityStat(junctionData.demands, "baseDemand");
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
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
        diameter: 300,
        length: 1000,
        roughness: 130,
      })
      .aPipe(IDS.P2, {
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
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
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
        initialStatus: "open",
      })
      .aPipe(IDS.P2, {
        startNodeId: String(IDS.J2),
        endNodeId: String(IDS.J3),
        initialStatus: "closed",
      })
      .aPipe(IDS.P3, {
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J3),
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
      .aPipe(IDS.P1, { startNodeId: String(IDS.R1), endNodeId: String(IDS.J1) })
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
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
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
        startNodeId: String(IDS.J1),
        endNodeId: String(IDS.J2),
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
});
