import { Junction } from "./asset-types";
import { JunctionSimulation } from "./asset-types/junction";
import { Pipe, PipeSimulation } from "./asset-types/pipe";
import { Pump, PumpSimulation } from "./asset-types/pump";
import { Valve, ValveSimulation } from "./asset-types/valve";
import { HydraulicModel } from "./hydraulic-model";

export interface ResultsReader {
  getValve: (valveId: string) => ValveSimulation | null;
  getPump: (pumpId: string) => PumpSimulation | null;
  getJunction: (junctionId: string) => JunctionSimulation | null;
  getPipe: (pipe: string) => PipeSimulation | null;
}

export const attachSimulation = (
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader,
) => {
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
    }
    newAssets.set(asset.id, asset);
  });

  hydraulicModel.assets = newAssets;
};
