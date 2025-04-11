import { PumpStatus } from "./asset-types/pump";
import { HydraulicModel } from "./hydraulic-model";

export interface ResultsReader {
  getPressure: (nodeId: string) => number | null;
  getFlow: (linkId: string) => number | null;
  getVelocity: (linkId: string) => number | null;
  getHeadloss: (linkId: string) => number | null;
  getPumpStatus: (pumpId: string) => PumpStatus | null;
}

export const attachSimulation = (
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader,
) => {
  const newAssets = new Map();
  hydraulicModel.assets.forEach((asset) => {
    asset.setSimulation(simulation);
    newAssets.set(asset.id, asset);
  });

  hydraulicModel.assets = newAssets;
};
