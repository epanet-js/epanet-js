import { describe, it, expect } from "vitest";
import { computeAssetsStats, emptyComputedMultiAssetData } from "./asset-stats";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";

describe("computeAssetsStats (FLAG_STATS_PERF stub)", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  it("returns empty sections and zero counts regardless of selection", () => {
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
      defaultSimulationSettings,
      null,
    );

    expect(result).toEqual(emptyComputedMultiAssetData());
    expect(result.counts.junction).toBe(0);
    expect(result.counts.pipe).toBe(0);
    expect(result.data.junction.modelAttributes).toEqual([]);
    expect(result.data.pipe.simulationResults).toEqual([]);
  });
});
