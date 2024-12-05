import { HydraulicModel } from "./hydraulic-model";

export interface ResultsReader {
  getPressure: (nodeId: string) => number;
  getFlow: (linkId: string) => number;
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
