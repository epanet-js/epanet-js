import { describe, it, expect } from "vitest";
import { computeMultiAssetData } from "./data";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets, Quantities } from "src/model-metadata/quantities-spec";

describe("computeMultiAssetData", () => {
  const quantities = new Quantities(presets.LPS);

  it("groups assets by type", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    expect(result.data.junction).toBeDefined();
    expect(result.data.pipe).toBeDefined();
    expect(result.counts.junction).toBe(2);
    expect(result.counts.pipe).toBe(1);
  });

  it("computes junction stats with sections", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 100, baseDemand: 10 })
      .aJunction("J2", { elevation: 150, baseDemand: 20 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const junctionData = result.data.junction;
    expect(junctionData.modelAttributes).toBeDefined();
    expect(junctionData.demands).toBeDefined();
    expect(junctionData.simulationResults).toBeDefined();

    const elevationStat = junctionData.modelAttributes.find(
      (s) => s.property === "elevation",
    );
    expect(elevationStat).toBeDefined();
    expect(elevationStat?.type).toBe("quantity");
    if (elevationStat?.type === "quantity") {
      expect(elevationStat.min).toBe(100);
      expect(elevationStat.max).toBe(150);
      expect(elevationStat.mean).toBe(125);
      expect(elevationStat.unit).toBe("m");
      expect(elevationStat.decimals).toBe(3);
    }

    const demandStat = junctionData.demands.find(
      (s) => s.property === "baseDemand",
    );
    expect(demandStat).toBeDefined();
    expect(demandStat?.type).toBe("quantity");
    if (demandStat?.type === "quantity") {
      expect(demandStat.min).toBe(10);
      expect(demandStat.max).toBe(20);
      expect(demandStat.unit).toBe("l/s");
    }
  });

  it("excludes null simulation results from stats", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 100 })
      .aJunction("J2", { elevation: 150 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const simulationStats = result.data.junction.simulationResults;
    expect(simulationStats).toHaveLength(0);
  });

  it("includes simulation results when available", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", {
        elevation: 100,
        simulation: { pressure: 50, head: 150, demand: 10 },
      })
      .aJunction("J2", {
        elevation: 150,
        simulation: { pressure: 60, head: 210, demand: 15 },
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const simulationStats = result.data.junction.simulationResults;
    expect(simulationStats.length).toBeGreaterThan(0);

    const pressureStat = simulationStats.find((s) => s.property === "pressure");
    expect(pressureStat).toBeDefined();
    expect(pressureStat?.type).toBe("quantity");
    if (pressureStat?.type === "quantity") {
      expect(pressureStat.min).toBe(50);
      expect(pressureStat.max).toBe(60);
      expect(pressureStat.unit).toBe("mwc");
    }
  });

  it("computes pipe stats with sections", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 300,
        length: 1000,
        roughness: 130,
      })
      .aPipe("P2", {
        startNodeId: "J1",
        endNodeId: "J2",
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

    const diameterStat = pipeData.modelAttributes.find(
      (s) => s.property === "diameter",
    );
    expect(diameterStat).toBeDefined();
    if (diameterStat?.type === "quantity") {
      expect(diameterStat.min).toBe(200);
      expect(diameterStat.max).toBe(300);
      expect(diameterStat.unit).toBe("mm");
    }
  });

  it("computes category stats for status properties", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        initialStatus: "open",
      })
      .aPipe("P2", {
        startNodeId: "J2",
        endNodeId: "J3",
        initialStatus: "closed",
      })
      .aPipe("P3", {
        startNodeId: "J1",
        endNodeId: "J3",
        initialStatus: "open",
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const statusStat = result.data.pipe.modelAttributes.find(
      (s) => s.property === "initialStatus",
    );
    expect(statusStat).toBeDefined();
    expect(statusStat?.type).toBe("category");
    if (statusStat?.type === "category") {
      expect(statusStat.values.get("pipe.open")).toBe(2);
      expect(statusStat.values.get("pipe.closed")).toBe(1);
    }
  });

  it("handles empty asset arrays", () => {
    const hydraulicModel = HydraulicModelBuilder.empty();
    const result = computeMultiAssetData([], quantities, hydraulicModel);

    expect(result.data.junction.modelAttributes).toEqual([]);
    expect(result.data.junction.demands).toEqual([]);
    expect(result.data.junction.simulationResults).toEqual([]);
  });

  it("handles mixed asset types", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 100 })
      .aReservoir("R1", { elevation: 200 })
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    expect(result.data.junction.modelAttributes.length).toBeGreaterThan(0);
    expect(result.data.reservoir.modelAttributes.length).toBeGreaterThan(0);
    expect(result.data.pipe.modelAttributes.length).toBeGreaterThan(0);
  });

  it("computes pump stats with type categories", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aPump("PU1", {
        startNodeId: "J1",
        endNodeId: "J2",
        definitionType: "power",
        power: 20,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const pumpData = result.data.pump;
    expect(pumpData.modelAttributes).toBeDefined();

    const typeStat = pumpData.modelAttributes.find(
      (s) => s.property === "pumpType",
    );
    expect(typeStat?.type).toBe("category");
    if (typeStat?.type === "category") {
      expect(typeStat.values.get("power")).toBe(1);
    }
  });

  it("handles partial simulation results", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", {
        elevation: 100,
        simulation: { pressure: 50, head: 150, demand: 10 },
      })
      .aJunction("J2", { elevation: 150 })
      .aJunction("J3", { elevation: 200 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const simulationStats = result.data.junction.simulationResults;
    const pressureStat = simulationStats.find((s) => s.property === "pressure");

    if (pressureStat?.type === "quantity") {
      expect(pressureStat.times).toBe(1);
      expect(pressureStat.min).toBe(50);
      expect(pressureStat.max).toBe(50);
    }
  });

  it("computes valve stats with valve type categories", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aValve("V1", {
        startNodeId: "J1",
        endNodeId: "J2",
        kind: "prv",
        setting: 50,
      })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const valveData = result.data.valve;
    const typeStat = valveData.modelAttributes.find(
      (s) => s.property === "valveType",
    );
    expect(typeStat?.type).toBe("category");
    if (typeStat?.type === "category") {
      expect(typeStat.values.get("valve.prv")).toBe(1);
    }
  });

  it("computes tank stats with sections", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank("T1", {
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

    const elevationStat = tankData.modelAttributes.find(
      (s) => s.property === "elevation",
    );
    expect(elevationStat).toBeDefined();
    if (elevationStat?.type === "quantity") {
      expect(elevationStat.min).toBe(100);
      expect(elevationStat.unit).toBe("m");
    }
  });

  it("computes reservoir stats", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("R1", { elevation: 200 })
      .aReservoir("R2", { elevation: 250 })
      .build();

    const assets = Array.from(hydraulicModel.assets.values());
    const result = computeMultiAssetData(assets, quantities, hydraulicModel);

    const reservoirData = result.data.reservoir;
    expect(reservoirData.modelAttributes.length).toBeGreaterThan(0);

    const elevationStat = reservoirData.modelAttributes.find(
      (s) => s.property === "elevation",
    );
    expect(elevationStat).toBeDefined();
    if (elevationStat?.type === "quantity") {
      expect(elevationStat.min).toBe(200);
      expect(elevationStat.max).toBe(250);
    }
  });
});
