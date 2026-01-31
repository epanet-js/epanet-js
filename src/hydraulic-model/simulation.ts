import { Junction } from "./asset-types";
import { Pipe } from "./asset-types/pipe";
import { Tank } from "./asset-types/tank";
import { Pump } from "./asset-types/pump";
import { Valve } from "./asset-types/valve";
import { HydraulicModel, updateHydraulicModelAssets } from "./hydraulic-model";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import type { ResultsReader } from "src/simulation/results-reader";

export type { ResultsReader } from "src/simulation/results-reader";

export const attachSimulation = withDebugInstrumentation(
  (
    hydraulicModel: HydraulicModel,
    simulation: ResultsReader,
  ): HydraulicModel => {
    const newAssets = new Map();
    hydraulicModel.assets.forEach((asset) => {
      switch (asset.type) {
        case "valve":
          (asset as Valve).setSimulation(simulation.getValve(asset.id));
          break;
        case "pipe":
          (asset as Pipe).setSimulation(simulation.getPipe(asset.id));
          break;
        case "junction":
          (asset as Junction).setSimulation(simulation.getJunction(asset.id));
          break;
        case "pump":
          (asset as Pump).setSimulation(simulation.getPump(asset.id));
          break;
        case "reservoir":
          break;
        case "tank":
          (asset as Tank).setSimulation(simulation.getTank(asset.id));
          break;
      }
      newAssets.set(asset.id, asset);
    });

    return updateHydraulicModelAssets(hydraulicModel, newAssets);
  },
  {
    name: "SIMULATION:ATTACH_TO_MODEL",
    maxDurationMs: 100,
  },
);
