import { describe, it, expect } from "vitest";
import { computeAssetsStats } from "./asset-stats";
import type {
  PropertyStats,
  QuantityStats,
  CategoryStats,
  BooleanStats,
} from "./summary-stats";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { createMockResultsReader } from "src/__helpers__/state";

describe("computeAssetsStats (light summary)", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const find = (stats: PropertyStats[], property: string): PropertyStats => {
    const stat = stats.find((s) => s.property === property);
    expect(stat, `expected stat for ${property}`).toBeDefined();
    return stat as PropertyStats;
  };

  const compute = (
    hydraulicModel: ReturnType<HydraulicModelBuilder["build"]>,
  ) =>
    computeAssetsStats(
      Array.from(hydraulicModel.assets.values()),
      units,
      formatting,
      hydraulicModel,
      defaultSimulationSettings,
      null,
    );

  it("groups assets by type and counts them", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const result = compute(hydraulicModel);

    expect(result.counts.junction).toBe(2);
    expect(result.counts.pipe).toBe(1);
    expect(result.counts.pump).toBe(0);
  });

  it("reports a single distinct value when all assets share it", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 100 })
      .build();

    const result = compute(hydraulicModel);
    const elevation = find(
      result.data.junction.modelAttributes,
      "elevation",
    ) as QuantityStats;

    expect(elevation.type).toBe("quantity");
    expect(elevation.distinctCount).toBe(1);
    expect(elevation.singleValue).toBe(100);
  });

  it("reports multiple distinct values without retaining them or ids", () => {
    const IDS = { J1: 1, J2: 2, J3: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 150 })
      .aJunction(IDS.J3, { elevation: 150 })
      .build();

    const result = compute(hydraulicModel);
    const elevation = find(
      result.data.junction.modelAttributes,
      "elevation",
    ) as QuantityStats;

    expect(elevation.distinctCount).toBe(2);
    expect(elevation.singleValue).toBeNull();
    // memory-light: no per-value id buckets are retained
    expect(elevation).not.toHaveProperty("values");
    expect(elevation).not.toHaveProperty("seen");
  });

  it("retains the distinct value set for material (openCategory)", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "PVC",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "Steel",
      })
      .build();

    const result = compute(hydraulicModel);
    const material = find(
      result.data.pipe.modelAttributes,
      "material",
    ) as CategoryStats;

    expect(material.type).toBe("category");
    expect(material.distinctCount).toBe(2);
    expect([...material.distinctValues].sort()).toEqual(["PVC", "Steel"]);
  });

  it("counts empties into an empty bucket with a label (no ids)", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        material: "PVC",
      })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const result = compute(hydraulicModel);
    const material = find(
      result.data.pipe.modelAttributes,
      "material",
    ) as CategoryStats;

    expect(material.emptyBucket).toBeDefined();
    expect(material.emptyBucket?.label).toBe("none");
    expect(material.emptyBucket?.count).toBe(1);
    expect(material.emptyBucket).not.toHaveProperty("ids");
  });

  it("summarizes boolean topology as a single value", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .build();

    const result = compute(hydraulicModel);
    const isEnabled = find(
      result.data.junction.activeTopology,
      "isEnabled",
    ) as BooleanStats;

    expect(isEnabled.type).toBe("boolean");
    expect(isEnabled.distinctCount).toBe(1);
    expect(isEnabled.singleValue).toBe("yes");
  });

  it("excludes simulation results when there are none", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 100 })
      .aJunction(IDS.J2, { elevation: 150 })
      .build();

    const result = compute(hydraulicModel);
    expect(result.data.junction.simulationResults).toHaveLength(0);
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

    const result = computeAssetsStats(
      Array.from(hydraulicModel.assets.values()),
      units,
      formatting,
      hydraulicModel,
      defaultSimulationSettings,
      simulationResults,
    );

    const pressure = find(
      result.data.junction.simulationResults,
      "pressure",
    ) as QuantityStats;
    expect(pressure.distinctCount).toBe(2);
  });

  it("counts pipes with null length in the empty bucket", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, P3: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, length: 1000 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2, length: 500 })
      .aPipe(IDS.P3, { startNodeId: IDS.J1, endNodeId: IDS.J2, length: null })
      .build();

    const result = compute(hydraulicModel);
    const length = find(
      result.data.pipe.modelAttributes,
      "length",
    ) as QuantityStats;

    expect(length.distinctCount).toBe(2);
    expect(length.emptyBucket?.label).toBe("none");
    expect(length.emptyBucket?.count).toBe(1);
  });
});
