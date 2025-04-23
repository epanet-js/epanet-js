import { Junction } from "./asset-types";
import { JunctionSimulationProvider } from "./asset-types/junction";
import { Pipe, PipeSimulationProvider } from "./asset-types/pipe";
import {
  Pump,
  PumpSimulationProvider,
  PumpStatus,
  PumpStatusWarning,
} from "./asset-types/pump";
import { Valve, ValveSimulation, ValveStatus } from "./asset-types/valve";
import { HydraulicModel } from "./hydraulic-model";

export interface ResultsReader {
  getPressure: (nodeId: string) => number | null;
  getFlow: (linkId: string) => number | null;
  getVelocity: (linkId: string) => number | null;
  getHeadloss: (linkId: string) => number | null;
  getPumpStatus: (pumpId: string) => PumpStatus | null;
  getPumpStatusWarning: (pumpId: string) => PumpStatusWarning | null;
  getValveStatus: (valveId: string) => ValveStatus | null;
  getValve: (valveId: string) => ValveSimulation | null;
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
        (asset as Pipe).setSimulation(simulation as PipeSimulationProvider);
        break;
      case "junction":
        (asset as Junction).setSimulation(
          simulation as JunctionSimulationProvider,
        );
        break;
      case "pump":
        (asset as Pump).setSimulation(simulation as PumpSimulationProvider);
        break;
      case "reservoir":
        break;
    }
    newAssets.set(asset.id, asset);
  });

  hydraulicModel.assets = newAssets;
};
