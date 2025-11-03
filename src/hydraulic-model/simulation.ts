import { Junction } from "./asset-types";
import { JunctionSimulation } from "./asset-types/junction";
import { Pipe, PipeSimulation } from "./asset-types/pipe";
import { Tank, TankSimulation } from "./asset-types/tank";
import { Pump, PumpSimulation } from "./asset-types/pump";
import { Valve, ValveSimulation } from "./asset-types/valve";
import { HydraulicModel } from "./hydraulic-model";

export interface ResultsReader {
  getValve: (valveId: string) => ValveSimulation | null;
  getPump: (pumpId: string) => PumpSimulation | null;
  getJunction: (junctionId: string) => JunctionSimulation | null;
  getPipe: (pipe: string) => PipeSimulation | null;
  getTank: (tank: string) => TankSimulation | null;
}

export const attachSimulation = (
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader,
) => {
  const newAssets = new Map();
  hydraulicModel.assets.forEach((asset) => {
    const stringId = String(asset.id);
    switch (asset.type) {
      case "valve":
        (asset as Valve).setSimulation(simulation.getValve(stringId));
        break;
      case "pipe":
        (asset as Pipe).setSimulation(simulation.getPipe(stringId));
        break;
      case "junction":
        (asset as Junction).setSimulation(simulation.getJunction(stringId));
        break;
      case "pump":
        (asset as Pump).setSimulation(simulation.getPump(stringId));
        break;
      case "reservoir":
        break;
      case "tank":
        (asset as Tank).setSimulation(simulation.getTank(stringId));
        break;
    }
    newAssets.set(asset.id, asset);
  });

  hydraulicModel.assets = newAssets;
};
